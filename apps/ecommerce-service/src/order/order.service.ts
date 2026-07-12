import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { Webhook } from '@payos/node';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PAYOS_LINK_TTL_MS, IOT_FEE_AMOUNT } from '@app/common';

// === Internal record types ===
interface TaskRecord {
  id: string;
  order_id: string;
  engraving_id: string;
  assigned_jeweler_id: string | null;
  task_name: string | null;
  task_description: string | null;
  status: string | null;
  note: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date | null;
  users?: { full_name: string | null } | null;
}

interface ShipmentRecord {
  id: string;
  order_id: string;
  delivery_method: string | null;
  status: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  shipping_address_text: string | null;
  estimated_delivery_at: Date | null;
  delivered_at: Date | null;
  created_at: Date | null;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOrder(engravingId: string, userId: string) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: engravingId },
      include: {
        engraving_versions_engraving_versions_engraving_idToengravings: {
          orderBy: { version_number: 'desc' },
          take: 1,
        },
        order: true,
      },
    });

    if (!engraving) throw new NotFoundException('Engraving not found');
    if (engraving.user_id !== userId) {
      throw new ForbiddenException('Engraving does not belong to this user');
    }
    if (engraving.order) {
      throw new BadRequestException('Engraving already has an order');
    }

    // Derive packageType từ selected_biometrics
    const version =
      engraving
        .engraving_versions_engraving_versions_engraving_idToengravings[0];
    const selected =
      version?.selected_biometrics?.split(',').filter(Boolean) ?? [];
    if (selected.length === 0) {
      throw new BadRequestException(
        'No biometrics selected. Please set selectedBiometrics via PATCH config first.',
      );
    }
    const packageType = selected.join('_'); // ["SW","FP"] → "SW_FP"

    const captureRoute = packageType === 'SW' ? 'ONLINE' : 'OFFLINE';
    const initialStatus =
      captureRoute === 'ONLINE' ? 'AWAITING_SUBMIT' : 'AWAITING_DEPOSIT_1';

    let designDraftId: string | null = null;
    if (engraving.unique_product_id) {
      const draft = await this.prisma.design_drafts.findUnique({
        where: { design_code: engraving.unique_product_id },
        select: { id: true },
      });
      designDraftId = draft?.id ?? null;
    }

    const orderId = randomUUID();
    const orderCode = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const price = await this.calculatePrice(engraving);

    const order = await this.prisma.orders.create({
      data: {
        id: orderId,
        order_code: orderCode,
        engraving_id: engravingId,
        user_id: userId,
        design_draft_id: designDraftId,
        capture_route: captureRoute,
        design_source: 'MOBILE',
        package_type: packageType,
        status: initialStatus,
        subtotal: price.subtotal,
        service_fee: price.serviceFee,
        extra_fee: price.extraFee,
        discount_amount: price.discountAmount,
        total_price: price.totalPrice,
        paid_amount: 0,
        remaining_amount: price.totalPrice,
      },
    });

    return { order: await this.mapOrder(order) };
  }

  async getOrder(id: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        engraving: {
          include: {
            engraving_versions_engraving_versions_engraving_idToengravings: {
              orderBy: { version_number: 'desc' },
            },
            engraving_biometrics: true,
          },
        },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { order: await this.mapOrderFull(order) };
  }

  async getMyOrders(userId: string, page: number, limit: number) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          payments: true,
        },
      }),
      this.prisma.orders.count({ where: { user_id: userId } }),
    ]);

    return {
      orders: await Promise.all(orders.map((o) => this.mapOrder(o))),
      total,
      page,
      limit,
    };
  }

  async reviewOrder(
    id: string,
    action: string,
    note: string,
    managerId: string,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        engraving: {
          include: {
            engraving_versions_engraving_versions_engraving_idToengravings: {
              orderBy: { version_number: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Order must be in PENDING_REVIEW status');
    }

    const engraving = order.engraving;
    if (!engraving) throw new BadRequestException('Order has no engraving');

    const latest =
      engraving
        .engraving_versions_engraving_versions_engraving_idToengravings[0];

    if (action === 'approve') {
      if (latest && latest.status !== 'APPROVED') {
        await this.prisma.engraving_versions.update({
          where: { id: latest.id },
          data: {
            status: 'APPROVED',
            manager_id: managerId,
            reviewed_at: new Date(),
          },
        });
        await this.prisma.engravings.update({
          where: { id: engraving.id },
          data: { approved_version_id: latest.id, status: 'APPROVED' },
        });
      }

      // Update qr_memories with biometric display settings
      const biometrics = await this.prisma.engraving_biometrics.findMany({
        where: { engraving_id: engraving.id },
      });
      if (biometrics.length > 0) {
        const displaySettings: Record<string, unknown> = {};
        for (const b of biometrics) {
          displaySettings[b.biometric_type] = {
            processedSvgUrl: b.processed_svg_url,
            rawFileUrl: b.raw_file_url,
            extraData: b.extra_data,
          };
        }
        await this.prisma.qr_memories.updateMany({
          where: { engraving_id: engraving.id },
          data: {
            biometric_display_settings:
              displaySettings as Prisma.InputJsonValue,
          },
        });
      }

      const updated = await this.prisma.orders.update({
        where: { id },
        data: {
          status: 'AWAITING_DEPOSIT',
          approved_by_manager_id: managerId,
          ...(note ? { note } : {}),
        },
      });

      this.eventEmitter.emit('order.approved', { orderId: id });

      return { order: await this.mapOrder(updated) };

      return { order: await this.mapOrder(updated) };
    }

    if (action === 'reject') {
      if (latest) {
        await this.prisma.engraving_versions.update({
          where: { id: latest.id },
          data: {
            status: 'REJECTED',
            manager_id: managerId,
            manager_note: note || null,
            reviewed_at: new Date(),
          },
        });

        await this.prisma.engravings.update({
          where: { id: engraving.id },
          data: { status: 'REJECTED' },
        });

        const newVersionId = randomUUID();
        await this.prisma.engraving_versions.create({
          data: {
            id: newVersionId,
            engraving_id: engraving.id,
            version_number: latest.version_number + 1,
            selected_material_id: latest.selected_material_id,
            selected_gemstone_id: latest.selected_gemstone_id,
            ring_size: latest.ring_size,
            ring_style: latest.ring_style,
            ring_shape: latest.ring_shape,
            customization_config:
              latest.customization_config as Prisma.InputJsonValue,
            selected_biometrics: latest.selected_biometrics,
            status: 'PENDING',
          },
        });
      }

      const updated = await this.prisma.orders.update({
        where: { id },
        data: {
          status: 'REVISION_REQUIRED',
          approved_by_manager_id: managerId,
          ...(note ? { note } : {}),
        },
      });

      this.eventEmitter.emit('order.rejected', { orderId: id, note: note ?? '' });

      return { order: await this.mapOrder(updated) };
    }

    throw new BadRequestException('Action must be "approve" or "reject"');
  }

  async submitOrder(id: string) {
    const order = await this.prisma.orders.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (
      !['AWAITING_SUBMIT', 'REVISION_REQUIRED'].includes(order.status ?? '')
    ) {
      throw new BadRequestException(
        'Order must be in AWAITING_SUBMIT or REVISION_REQUIRED to submit',
      );
    }

    // Nếu resubmit từ REVISION_REQUIRED, reset engraving status
    if (order.status === 'REVISION_REQUIRED') {
      await this.prisma.engravings.updateMany({
        where: {
          order: { id: id },
          status: 'REJECTED',
        },
        data: { status: 'PENDING' },
      });
    }

    // Validate: tất cả biometric trong package đã được upload chưa
    const engraving = await this.prisma.engravings.findFirst({
      where: { order: { id } },
      include: {
        engraving_versions_engraving_versions_engraving_idToengravings: {
          orderBy: { version_number: 'desc' },
          take: 1,
        },
      },
    });

    if (engraving) {
      const version =
        engraving
          .engraving_versions_engraving_versions_engraving_idToengravings[0];
      const selected =
        version?.selected_biometrics?.split(',').filter(Boolean) ?? [];
      if (selected.length > 0) {
        const uploaded = await this.prisma.engraving_biometrics.findMany({
          where: {
            engraving_id: engraving.id,
            status: 'CAPTURED',
          },
          select: { biometric_type: true },
        });
        const uploadedTypes = new Set(uploaded.map((b) => b.biometric_type));
        const missing = selected.filter((t: string) => !uploadedTypes.has(t));
        if (missing.length > 0) {
          throw new BadRequestException(
            `Missing biometric data: ${missing.join(', ')}. Please upload before submitting.`,
          );
        }
      }
    }

    const updated = await this.prisma.orders.update({
      where: { id },
      data: { status: 'PENDING_REVIEW' },
    });

    this.eventEmitter.emit('order.submitted', { orderId: id });

    return { order: await this.mapOrder(updated) };
  }

  async attachBiometric(
    engravingId: string,
    biometricType: string,
    rawFileUrl: string,
    extraData?: string,
  ) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: engravingId },
      include: { order: true },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (!engraving.order) {
      throw new BadRequestException('Engraving not linked to an order');
    }

    if (engraving.order.status !== 'AWAITING_SUBMIT') {
      throw new BadRequestException(
        'Order must be in AWAITING_SUBMIT status to attach biometrics',
      );
    }

    const packageTypes = (engraving.order.package_type ?? '').split('_');
    if (!packageTypes.includes(biometricType)) {
      throw new BadRequestException(
        `Biometric type ${biometricType} not in package ${engraving.order.package_type}`,
      );
    }

    const processedSvgUrl = await this.processBiometric(
      biometricType,
      rawFileUrl,
      engravingId,
    );

    const requiredChannel =
      biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING';

    let extraDataJson: Record<string, unknown> = {};
    if (extraData) {
      try {
        extraDataJson = JSON.parse(extraData) as Record<string, unknown>;
      } catch {
        throw new BadRequestException('extraData must be valid JSON');
      }
    }

    const biometric = await this.prisma.engraving_biometrics.create({
      data: {
        id: randomUUID(),
        engraving_id: engravingId,
        biometric_type: biometricType,
        required_channel: requiredChannel,
        raw_file_url: rawFileUrl,
        processed_svg_url: processedSvgUrl,
        extra_data: extraDataJson as Prisma.InputJsonValue,
        status: 'CAPTURED',
      },
    });

    return { biometric };
  }

  private async processBiometric(
    biometricType: string,
    rawFileUrl: string,
    engravingVersionId: string,
  ): Promise<string> {
    const baseUrl =
      process.env.BIOMETRIC_PROCESSING_URL ?? 'http://localhost:5051';

    if (biometricType === 'SW') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(`${baseUrl}/process-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl: rawFileUrl, engravingVersionId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Audio processing failed: ${await res.text()}`);
        }
        const data = (await res.json()) as { waveformUrl: string };
        return data.waveformUrl;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (biometricType === 'FP') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(`${baseUrl}/process-fingerprint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: rawFileUrl, engravingVersionId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Fingerprint processing failed: ${await res.text()}`);
        }
        const data = (await res.json()) as { processedSvgUrl: string };
        return data.processedSvgUrl;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return rawFileUrl; // HB — no processing needed
  }

  async initiatePayment(
    orderId: string,
    paymentPhase: string,
    returnUrl: string,
    cancelUrl: string,
    userId: string,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.user_id && order.user_id !== userId) {
      throw new ForbiddenException('You do not own this order');
    }
    if (!order.user_id && !order.guest_customer_id) {
      throw new ForbiddenException('Order has no identifiable owner');
    }

    const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'];
    if (!allowedPhases.includes(paymentPhase)) {
      throw new BadRequestException(
        'paymentPhase must be DEPOSIT_1, DEPOSIT_2, REMAINING, or FULL',
      );
    }

    let amount = 0;
    if (paymentPhase === 'FULL') {
      if (!order.guest_customer_id) {
        throw new BadRequestException(
          'FULL payment is only available for walk-in guests',
        );
      }
      amount = Number(order.total_price ?? 0);
      if (amount <= 0) throw new BadRequestException('Invalid total price');
    } else if (paymentPhase === 'DEPOSIT_1') {
      amount = IOT_FEE_AMOUNT;
    } else if (paymentPhase === 'DEPOSIT_2') {
      amount = Math.max(Math.round(Number(order.total_price ?? 0) * 0.3), 3000);
      if (Number(order.paid_amount ?? 0) >= amount) {
        throw new BadRequestException('Deposit already paid');
      }
    } else {
      amount = Number(order.remaining_amount ?? 0);
      if (amount <= 0) {
        throw new BadRequestException('No remaining amount to pay');
      }
    }

    // Idempotency: trả lại payment PENDING cũ nếu còn hạn
    const PAYOS_LINK_TTL_MS = DEFAULT_PAYOS_LINK_TTL_MS;
    const existing = await this.prisma.payments.findFirst({
      where: {
        order_id: orderId,
        payment_phase: paymentPhase,
        status: 'PENDING',
      },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      const ageMs = existing.created_at
        ? Date.now() - existing.created_at.getTime()
        : Infinity;

      if (
        ageMs < PAYOS_LINK_TTL_MS &&
        existing.qr_code &&
        existing.payment_url
      ) {
        console.log(`[PayOS] Reusing existing payment: id=${existing.id}`);
        return {
          payment: {
            id: existing.id,
            orderId: existing.order_id ?? '',
            paymentPhase: existing.payment_phase ?? '',
            amount: Number(existing.amount),
            method: existing.method ?? '',
            status: existing.status ?? '',
            payosTransactionId: existing.payos_transaction_id ?? '',
            paymentUrl: existing.payment_url ?? '',
            paidAt: existing.paid_at?.toISOString() ?? '',
            createdAt: existing.created_at?.toISOString() ?? '',
          },
          paymentUrl: existing.payment_url,
          qrCode: existing.qr_code,
        };
      }

      // Hết hạn → cancel trên PayOS + đánh dấu CANCELLED
      if (existing.payos_transaction_id) {
        try {
          await this.payOS.cancelPaymentLink(existing.payos_transaction_id);
        } catch {
          /* proceed */
        }
      }
      await this.prisma.payments.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });
    }

    const payosOrderCode = Number(
      `${Date.now()}${Math.floor(Math.random() * 100)}`,
    );
    console.log(
      `[PayOS] Creating payment link: orderCode=${payosOrderCode}, amount=${amount}`,
    );
    const payosResult = await this.payOS.createPaymentLink({
      orderCode: payosOrderCode,
      amount,
      description: `${paymentPhase === 'DEPOSIT_1' ? 'IoT' : paymentPhase === 'DEPOSIT_2' ? 'Cọc' : 'TT'} ${order.order_code}`,
      returnUrl,
      cancelUrl,
    });

    const payment = await this.prisma.payments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        payment_code: String(payosOrderCode),
        payment_phase: paymentPhase,
        amount,
        method: 'PAYOS',
        status: 'PENDING',
        payos_transaction_id: payosResult.transactionId,
        qr_code: payosResult.qrCode,
        payment_url: payosResult.paymentUrl,
      },
    });

    return {
      payment: {
        id: payment.id,
        orderId: payment.order_id ?? '',
        paymentPhase: payment.payment_phase ?? '',
        amount: Number(payment.amount),
        method: payment.method ?? '',
        status: payment.status ?? '',
        payosTransactionId: payment.payos_transaction_id ?? '',
        paymentUrl: payment.payment_url ?? '',
        paidAt: payment.paid_at?.toISOString() ?? '',
        createdAt: payment.created_at?.toISOString() ?? '',
      },
      paymentUrl: payosResult.paymentUrl,
      qrCode: payosResult.qrCode,
    };
  }

  async handlePayOSWebhook(input: { webhookBody: string }) {
    const webhook = JSON.parse(input.webhookBody) as Webhook;

    const webhookData = await this.payOS.verifyWebhook({
      code: webhook.code,
      desc: webhook.desc,
      success: webhook.success,
      data: webhook.data,
      signature: webhook.signature,
    });

    if (!webhookData) {
      console.warn('[PayOS] Invalid webhook signature, ignoring');
      return { success: false };
    }

    const orderCode = webhookData.orderCode;
    const payment = await this.prisma.payments.findFirst({
      where: { payment_code: String(orderCode) },
    });
    if (!payment) {
      console.warn('[PayOS] Payment not found for orderCode:', orderCode);
      return { success: false };
    }

    const order = await this.prisma.orders.findUnique({
      where: { id: payment.order_id ?? undefined },
    });
    if (!order) {
      console.warn('[PayOS] Order not found for payment:', payment.id);
      return { success: false };
    }

    const isSuccess = webhookData.code === '00';

    await this.prisma.payments.update({
      where: { id: payment.id },
      data: {
        status: isSuccess ? 'PAID' : 'FAILED',
        paid_at: isSuccess ? new Date() : null,
      },
    });

    if (isSuccess) {
      const amount = webhookData.amount;
      const newPaidAmount = Number(order.paid_amount ?? 0) + amount;
      const totalPrice = Number(order.total_price ?? 0);
      const remainingAmount = totalPrice - newPaidAmount;

      let newStatus = order.status;
      if (payment.payment_phase === 'DEPOSIT_1') {
        newStatus = 'AWAITING_SUBMIT';
      } else if (payment.payment_phase === 'DEPOSIT_2') {
        newStatus = 'DEPOSIT_PAID';
      } else if (payment.payment_phase === 'REMAINING') {
        newStatus = 'READY_FOR_DELIVERY';
      } else if (payment.payment_phase === 'FULL') {
        newStatus = 'DEPOSIT_PAID';
      }

      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          paid_amount: newPaidAmount,
          remaining_amount: remainingAmount >= 0 ? remainingAmount : 0,
          status: newStatus,
        },
      });

      // ponytail: chỉ emit cho payment đáng chú ý
      if (newStatus === 'DEPOSIT_PAID' || newStatus === 'READY_FOR_DELIVERY') {
        this.eventEmitter.emit('payment.confirmed', { orderId: order.id });
      }
    }

    return { success: true };
  }

  async cancelPayment(orderId: string, userId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.user_id && order.user_id !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    const payment = await this.prisma.payments.findFirst({
      where: { order_id: orderId, status: 'PENDING' },
      orderBy: { created_at: 'desc' },
    });
    if (!payment) {
      throw new BadRequestException('No pending payment found to cancel');
    }

    if (payment.payos_transaction_id) {
      try {
        await this.payOS.cancelPaymentLink(payment.payos_transaction_id);
      } catch {
        // Proceed with local cancel even if PayOS cancel fails
      }
    }

    await this.prisma.payments.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    return { success: true, orderCode: order.order_code ?? '' };
  }

  async cancelOrder(orderId: string, reason: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const cancellable = [
      'AWAITING_SUBMIT',
      'AWAITING_DEPOSIT_1',
      'PENDING_REVIEW',
      'REVISION_REQUIRED',
      'AWAITING_DEPOSIT',
      'DEPOSIT_PAID',
      'IN_PRODUCTION',
      'AWAITING_REMAINING',
      'PENDING_QC',
      'READY_FOR_DELIVERY',
    ];
    if (!cancellable.includes(order.status ?? '')) {
      throw new BadRequestException(
        `Order cannot be cancelled in status "${order.status}"`,
      );
    }

    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        note: reason ? `[Cancelled] ${reason}` : order.note,
      },
    });

    return { order: await this.mapOrder(updated) };
  }

  async manualPayment(
    orderId: string,
    data: { paymentPhase: string; amount: number; receivedBy: string },
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'];
    if (!allowedPhases.includes(data.paymentPhase)) {
      throw new BadRequestException(
        `Invalid paymentPhase: ${data.paymentPhase}`,
      );
    }

    const payment = await this.prisma.payments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        payment_code: `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payment_phase: data.paymentPhase,
        amount: data.amount,
        method: 'MANUAL',
        status: 'PAID',
        paid_at: new Date(),
      },
    });

    const newPaidAmount = Number(order.paid_amount ?? 0) + data.amount;
    const totalPrice = Number(order.total_price ?? 0);
    const remainingAmount = totalPrice - newPaidAmount;

    let newStatus = order.status;
    if (data.paymentPhase === 'DEPOSIT_1') newStatus = 'AWAITING_SUBMIT';
    else if (data.paymentPhase === 'DEPOSIT_2') newStatus = 'DEPOSIT_PAID';
    else if (data.paymentPhase === 'FULL') newStatus = 'DEPOSIT_PAID';
    else if (data.paymentPhase === 'REMAINING')
      newStatus = 'READY_FOR_DELIVERY';

    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        paid_amount: newPaidAmount,
        remaining_amount: remainingAmount >= 0 ? remainingAmount : 0,
        status: newStatus,
      },
    });

    if (newStatus === 'DEPOSIT_PAID' || newStatus === 'READY_FOR_DELIVERY') {
      this.eventEmitter.emit('payment.confirmed', { orderId });
    }

    return {
      payment: {
        id: payment.id,
        orderId: payment.order_id ?? '',
        paymentPhase: payment.payment_phase ?? '',
        amount: Number(payment.amount),
        method: payment.method ?? '',
        status: payment.status ?? '',
        payosTransactionId: payment.payos_transaction_id ?? '',
        paymentUrl: payment.payment_url ?? '',
        paidAt: payment.paid_at?.toISOString() ?? '',
        createdAt: payment.created_at?.toISOString() ?? '',
      },
      order: await this.mapOrder(updated),
    };
  }

  async getPaymentStatus(orderId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        order_code: true,
        total_price: true,
        paid_amount: true,
        remaining_amount: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payments = await this.prisma.payments.findMany({
      where: { order_id: orderId, status: 'PAID' },
      select: {
        payment_phase: true,
        amount: true,
        method: true,
        paid_at: true,
      },
      orderBy: { paid_at: 'desc' },
    });

    const phases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'].map(
      (phase) => {
        const paid = payments.find((p) => p.payment_phase === phase);
        return {
          phase,
          status: paid ? 'PAID' : 'PENDING',
          amount: paid ? Number(paid.amount) : null,
          method: paid?.method ?? null,
          paidAt: paid?.paid_at?.toISOString() ?? null,
        };
      },
    );

    return {
      orderId: order.id,
      orderCode: order.order_code,
      totalPrice: Number(order.total_price ?? 0),
      paidAmount: Number(order.paid_amount ?? 0),
      remainingAmount: Number(order.remaining_amount ?? 0),
      phases,
    };
  }

  private mapTask(task: TaskRecord) {
    return {
      id: task.id,
      orderId: task.order_id,
      engravingId: task.engraving_id,
      assignedJewelerId: task.assigned_jeweler_id ?? '',
      assignedJewelerName: task.users?.full_name ?? '',
      taskName: task.task_name ?? '',
      taskDescription: task.task_description ?? '',
      status: task.status ?? '',
      note: task.note ?? '',
      startedAt: task.started_at?.toISOString() ?? '',
      completedAt: task.completed_at?.toISOString() ?? '',
      createdAt: task.created_at?.toISOString() ?? '',
    };
  }

  async assignJeweler(orderId: string, jewelerId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: { engraving: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'DEPOSIT_PAID') {
      throw new BadRequestException(
        'Order must be DEPOSIT_PAID to assign jeweler',
      );
    }

    const jeweler = await this.prisma.users.findUnique({
      where: { id: jewelerId },
    });
    if (!jeweler) throw new NotFoundException('Jeweler not found');

    const engraving = order.engraving;
    if (!engraving) throw new NotFoundException('No engraving for order');

    const taskId = randomUUID();
    const task = await this.prisma.production_tasks.create({
      data: {
        id: taskId,
        order_id: orderId,
        engraving_id: engraving.id,
        assigned_jeweler_id: jewelerId,
        task_name: `Ring production - ${order.order_code}`,
        status: 'IN_PROGRESS',
        started_at: new Date(),
      },
      include: { users: { select: { full_name: true } } },
    });

    await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: 'IN_PRODUCTION' },
    });

    this.eventEmitter.emit('order.production_started', { orderId });

    return { task: this.mapTask(task) };
  }

  async updateProductionStatus(taskId: string, status: string, note: string) {
    const task = await this.prisma.production_tasks.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Production task not found');

    const updateData: Record<string, unknown> = { status };
    if (note) updateData.note = note;
    if (status === 'COMPLETED') updateData.completed_at = new Date();

    const updated = await this.prisma.production_tasks.update({
      where: { id: taskId },
      data: updateData,
    });

    if (status === 'COMPLETED') {
      await this.prisma.orders.update({
        where: { id: task.order_id },
        data: { status: 'PENDING_QC' },
      });
    }

    const taskWithUser = await this.prisma.production_tasks.findUnique({
      where: { id: taskId },
      include: { users: { select: { full_name: true } } },
    });

    return { task: this.mapTask(taskWithUser ?? updated) };
  }

  async getProductionTasks(query: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    jewelerId?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.orderId) where.order_id = query.orderId;
    if (query.jewelerId) where.assigned_jeweler_id = query.jewelerId;

    const [data, total] = await Promise.all([
      this.prisma.production_tasks.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { users: { select: { full_name: true } } },
      }),
      this.prisma.production_tasks.count({ where }),
    ]);

    return {
      data: data.map((t) => this.mapTask(t)) ?? [],
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit) || 0,
    };
  }

  // ===== MF-05: Delivery, Pickup & QR Memory =====

  async qcAcceptOrder(
    orderId: string,
    result: string,
    checklist: string | undefined,
    proofImages: string[] | undefined,
    note: string | undefined,
    managerId: string,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        engraving: true,
        production_tasks: {
          where: { status: 'COMPLETED' },
          orderBy: { completed_at: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'IN_PRODUCTION' && order.status !== 'PENDING_QC') {
      throw new BadRequestException('Order must be IN_PRODUCTION or PENDING_QC');
    }

    const completedTask = order.production_tasks?.[0];
    if (!completedTask?.completed_at) {
      throw new BadRequestException(
        'Production task must be completed before QC',
      );
    }

    // Luôn ghi lại qa_checks
    let checklistJson: Record<string, unknown> | undefined;
    if (checklist) {
      try {
        checklistJson = JSON.parse(checklist) as Record<string, unknown>;
      } catch {
        throw new BadRequestException('checklist must be valid JSON');
      }
    }

    await this.prisma.qa_checks.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        production_task_id: completedTask.id,
        checked_by_id: managerId,
        result,
        checklist: checklistJson as Prisma.InputJsonValue,
        proof_images: proofImages as Prisma.InputJsonValue,
        note: note ?? null,
        checked_at: new Date(),
      },
    });

    if (result === 'PASS') {
      const remaining = Number(order.remaining_amount ?? 0);
      const nextStatus =
        remaining > 0 ? 'AWAITING_REMAINING' : 'READY_FOR_DELIVERY';

      const updated = await this.prisma.orders.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      if (nextStatus === 'READY_FOR_DELIVERY') {
        this.eventEmitter.emit('order.ready_for_delivery', { orderId });
      }

      return { order: await this.mapOrder(updated) };
    }

    // FAIL → quay lại sản xuất
    await this.prisma.production_tasks.update({
      where: { id: completedTask.id },
      data: { status: 'IN_PROGRESS', completed_at: null, note: note ?? null },
    });

    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: 'IN_PRODUCTION' },
    });
    return { order: await this.mapOrder(updated) };
  }

  async initiateDelivery(data: {
    orderId: string;
    deliveryMethod: string;
    recipientName: string;
    recipientPhone: string;
    addressId?: string;
    shippingAddressText?: string;
    assignedDeliveryStaffId?: string;
    managerId: string;
  }) {
    const order = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'READY_FOR_DELIVERY') {
      throw new BadRequestException(
        'Order must be READY_FOR_DELIVERY to initiate delivery',
      );
    }

    // Check remaining amount
    const remaining = Number(order.remaining_amount ?? 0);
    if (remaining > 0) {
      throw new BadRequestException(
        `Order still has remaining payment of ${remaining}. Please complete payment first.`,
      );
    }

    // Check shipment — nếu đã có (guest flow MF-04), chỉ update order status
    const existing = await this.prisma.shipments.findFirst({
      where: { order_id: data.orderId },
    });

    if (existing) {
      if (existing.status !== 'PENDING') {
        throw new BadRequestException(
          'Shipment already in progress for this order',
        );
      }

      let newStatus = 'READY_FOR_DELIVERY';
      if (existing.delivery_method === 'PICKUP') {
        newStatus = 'READY_FOR_PICKUP';
      }

      await this.prisma.orders.update({
        where: { id: data.orderId },
        data: { status: newStatus },
      });

      return this.mapShipment(existing);
    }

    // Tạo shipment mới (MF-02/03 flow)

    const shipmentId = randomUUID();
    const shipment = await this.prisma.shipments.create({
      data: {
        id: shipmentId,
        order_id: data.orderId,
        delivery_method: data.deliveryMethod,
        status: 'PENDING',
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone,
        address_id: data.addressId ?? null,
        shipping_address_text: data.shippingAddressText ?? null,
        assigned_delivery_staff_id: data.assignedDeliveryStaffId ?? null,
      },
    });

    let newStatus = 'READY_FOR_DELIVERY';
    if (data.deliveryMethod === 'PICKUP') {
      newStatus = 'READY_FOR_PICKUP';
    }

    await this.prisma.orders.update({
      where: { id: data.orderId },
      data: { status: newStatus },
    });

    return this.mapShipment(shipment);
  }

  async updateShipmentStatus(data: {
    orderId: string;
    status: string;
    receiverName?: string;
    receiverPhone?: string;
    identityNote?: string;
    proofImageUrl?: string;
    trackingCode?: string;
    staffId: string;
  }) {
    const order = await this.prisma.orders.findUnique({
      where: { id: data.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const shipment = await this.prisma.shipments.findFirst({
      where: { order_id: data.orderId },
    });
    if (!shipment) {
      throw new BadRequestException('No shipment found for this order');
    }

    const deliveryMethod = shipment.delivery_method;

    if (data.status === 'SHIPPING') {
      if (deliveryMethod !== 'DELIVERY') {
        throw new BadRequestException(
          'Only DELIVERY shipments can be set to SHIPPING',
        );
      }
      if (order.status !== 'READY_FOR_DELIVERY') {
        throw new BadRequestException(
          'Order must be READY_FOR_DELIVERY to start shipping',
        );
      }

      await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: { status: 'SHIPPING' },
      });
      const updated = await this.prisma.orders.update({
        where: { id: data.orderId },
        data: { status: 'SHIPPING' },
      });
      return { order: await this.mapOrder(updated) };
    }

    if (data.status === 'DELIVERED') {
      if (deliveryMethod === 'PICKUP') {
        if (order.status !== 'READY_FOR_PICKUP') {
          throw new BadRequestException(
            'Order must be READY_FOR_PICKUP to confirm delivery',
          );
        }
        await this.prisma.pickup_records.create({
          data: {
            id: randomUUID(),
            order_id: data.orderId,
            store_staff_id: data.staffId,
            receiver_name: data.receiverName,
            receiver_phone: data.receiverPhone,
            identity_note: data.identityNote,
            proof_image_url: data.proofImageUrl,
            picked_up_at: new Date(),
          },
        });
      } else {
        // DELIVERY
        if (order.status !== 'SHIPPING') {
          throw new BadRequestException(
            'Order must be SHIPPING to confirm delivery',
          );
        }
        await this.prisma.shipments.update({
          where: { id: shipment.id },
          data: {
            status: 'DELIVERED',
            tracking_code: data.trackingCode,
            delivered_at: new Date(),
          },
        });
      }

      // Ghi nhận trạng thái DELIVERED trước khi complete
      await this.prisma.orders.update({
        where: { id: data.orderId },
        data: { status: 'DELIVERED' },
      });

      this.eventEmitter.emit('order.delivered', { orderId: data.orderId });

      // Auto-complete: warranty + unlock QR + COMPLETED
      return this.completeOrder(data.orderId);
    }

    throw new BadRequestException('Status must be SHIPPING or DELIVERED');
  }

  private async completeOrder(orderId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: { engraving: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.engraving)
      throw new BadRequestException('Order has no engraving');

    // 1. Activate warranty
    await this.prisma.warranties.create({
      data: {
        id: randomUUID(),
        engraving_id: order.engraving.id,
        order_id: orderId,
        warranty_code: `WAR-${order.order_code}`,
        warranty_type: 'STANDARD',
        issue_format: 'DIGITAL',
        warranty_scope: {
          description: '1 năm bảo hành chính hãng',
          coverage: ['manufacturing_defect'],
        },
        issue_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        activated_at: new Date(),
        status: 'ACTIVE',
      },
    });

    // 2. Unlock qr_memories
    await this.prisma.qr_memories.updateMany({
      where: { engraving_id: order.engraving.id, is_locked: true },
      data: { is_locked: false },
    });

    // 3. Set status to COMPLETED + DELIVERED
    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
      },
    });

    return { order: await this.mapOrder(updated) };
  }

  async getDeliveryInfo(orderId: string) {
    const shipment = await this.prisma.shipments.findFirst({
      where: { order_id: orderId },
      include: { users: true },
    });
    if (!shipment) throw new NotFoundException('No delivery info found');

    return this.mapShipment(shipment);
  }

  async getWarrantyInfo(orderId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const warranty = await this.prisma.warranties.findFirst({
      where: { order_id: orderId },
    });
    if (!warranty)
      throw new NotFoundException('No warranty found for this order');

    return {
      warranty: {
        id: warranty.id,
        engravingId: warranty.engraving_id,
        orderId: warranty.order_id,
        warrantyCode: warranty.warranty_code ?? '',
        warrantyType: warranty.warranty_type ?? '',
        issueDate: warranty.issue_date?.toISOString() ?? '',
        expiryDate: warranty.expiry_date?.toISOString() ?? '',
        activatedAt: warranty.activated_at?.toISOString() ?? '',
        status: warranty.status ?? '',
        warrantyScope: warranty.warranty_scope
          ? JSON.stringify(warranty.warranty_scope)
          : '',
      },
    };
  }

  async getProductionInfo(orderId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const task = await this.prisma.production_tasks.findFirst({
      where: { order_id: orderId },
      include: { users: { select: { full_name: true } } },
      orderBy: { created_at: 'desc' },
    });

    const qaCheck = await this.prisma.qa_checks.findFirst({
      where: { order_id: orderId },
      orderBy: { checked_at: 'desc' },
    });

    return {
      task: task ? this.mapTask(task) : null,
      qaCheck: qaCheck
        ? {
            id: qaCheck.id,
            orderId: qaCheck.order_id,
            result: qaCheck.result ?? '',
            checklist: qaCheck.checklist
              ? JSON.stringify(qaCheck.checklist)
              : '',
            proofImages: Array.isArray(qaCheck.proof_images)
              ? (qaCheck.proof_images as string[])
              : [],
            note: qaCheck.note ?? '',
            checkedAt: qaCheck.checked_at?.toISOString() ?? '',
            checkedByManagerId: qaCheck.checked_by_id ?? '',
          }
        : null,
    };
  }

  async lookupOrder(orderCode: string) {
    const order = await this.prisma.orders.findUnique({
      where: { order_code: orderCode },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    return { order: await this.mapOrder(order) };
  }

  private mapShipment(shipment: ShipmentRecord) {
    return {
      id: shipment.id,
      orderId: shipment.order_id,
      deliveryMethod: shipment.delivery_method ?? '',
      status: shipment.status ?? '',
      trackingCode: shipment.tracking_code ?? '',
      trackingUrl: shipment.tracking_url ?? '',
      recipientName: shipment.recipient_name ?? '',
      recipientPhone: shipment.recipient_phone ?? '',
      shippingAddressText: shipment.shipping_address_text ?? '',
      estimatedDeliveryAt: shipment.estimated_delivery_at?.toISOString() ?? '',
      deliveredAt: shipment.delivered_at?.toISOString() ?? '',
      createdAt: shipment.created_at?.toISOString() ?? '',
    };
  }

  private async calculatePrice(engraving: { product_id?: string | null }) {
    let subtotal = 0;
    let serviceFee = 0;
    const extraFee = 0;
    const discountAmount = 0;

    if (engraving.product_id) {
      const product = await this.prisma.products.findUnique({
        where: { id: engraving.product_id },
      });
      subtotal = product?.base_price ? Number(product.base_price) : 0;
    }

    serviceFee = Math.round(subtotal * 0.1);
    const totalPrice = subtotal + serviceFee + extraFee - discountAmount;

    return {
      subtotal,
      serviceFee,
      extraFee,
      discountAmount,
      totalPrice: Math.max(totalPrice, 0),
    };
  }

  private async mapOrder(order: {
    id: string;
    order_code: string;
    user_id?: string | null;
    design_draft_id?: string | null;
    capture_route?: string | null;
    design_source?: string | null;
    status?: string | null;
    subtotal?: unknown;
    service_fee?: unknown;
    extra_fee?: unknown;
    discount_amount?: unknown;
    total_price?: unknown;
    paid_amount?: unknown;
    remaining_amount?: unknown;
    note?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
    payments?: Array<{
      id: string;
      order_id: string | null;
      payment_phase: string | null;
      amount: unknown;
      method: string | null;
      status: string | null;
      payos_transaction_id: string | null;
      paid_at: Date | null;
      created_at: Date | null;
    }>;
  }) {
    const payments = order.payments ?? [];

    return {
      id: order.id,
      orderCode: order.order_code,
      userId: order.user_id ?? '',
      designDraftId: order.design_draft_id ?? '',
      captureRoute: order.capture_route ?? '',
      designSource: order.design_source ?? '',
      status: order.status ?? '',
      subtotal: Number(order.subtotal ?? 0),
      serviceFee: Number(order.service_fee ?? 0),
      extraFee: Number(order.extra_fee ?? 0),
      discountAmount: Number(order.discount_amount ?? 0),
      totalPrice: Number(order.total_price ?? 0),
      paidAmount: Number(order.paid_amount ?? 0),
      remainingAmount: Number(order.remaining_amount ?? 0),
      note: order.note ?? '',
      createdAt: order.created_at?.toISOString() ?? '',
      updatedAt: order.updated_at?.toISOString() ?? '',
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.order_id ?? '',
        paymentPhase: p.payment_phase ?? '',
        amount: Number(p.amount),
        method: p.method ?? '',
        status: p.status ?? '',
        payosTransactionId: p.payos_transaction_id ?? '',
        paymentUrl: '',
        paidAt: p.paid_at?.toISOString() ?? '',
        createdAt: p.created_at?.toISOString() ?? '',
      })),
    };
  }

  private async mapOrderFull(order: {
    id: string;
    order_code: string;
    user_id?: string | null;
    design_draft_id?: string | null;
    capture_route?: string | null;
    design_source?: string | null;
    status?: string | null;
    subtotal?: unknown;
    service_fee?: unknown;
    extra_fee?: unknown;
    discount_amount?: unknown;
    total_price?: unknown;
    paid_amount?: unknown;
    remaining_amount?: unknown;
    note?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
    payments?: Array<{
      id: string;
      order_id: string | null;
      payment_phase: string | null;
      amount: unknown;
      method: string | null;
      status: string | null;
      payos_transaction_id: string | null;
      paid_at: Date | null;
      created_at: Date | null;
    }>;
    engraving?: {
      id: string;
      user_id?: string | null;
      product_id?: string | null;
      unique_product_id?: string | null;
      approved_version_id?: string | null;
      status?: string | null;
      engraving_versions_engraving_versions_engraving_idToengravings?: Array<{
        id: string;
        engraving_id: string;
        version_number: number;
        selected_material_id?: string | null;
        selected_gemstone_id?: string | null;
        ring_size?: string | null;
        ring_style?: string | null;
        ring_shape?: string | null;
        customization_config?: unknown;
        selected_biometrics?: string | null;
        status?: string | null;
        manager_id?: string | null;
        manager_note?: string | null;
        reviewed_at?: Date | null;
        created_at?: Date | null;
      }>;
      engraving_biometrics?: Array<{
        id: string;
        engraving_id: string;
        biometric_type: string;
        required_channel: string;
        raw_file_url?: string | null;
        processed_svg_url?: string | null;
        extra_data?: unknown;
        status?: string | null;
      }>;
    } | null;
  }) {
    const base = await this.mapOrder(order);

    const e = order.engraving;
    return {
      ...base,
      engraving: e
        ? {
            id: e.id,
            orderId: order.id,
            userId: e.user_id ?? '',
            productId: e.product_id ?? '',
            uniqueProductId: e.unique_product_id ?? '',
            approvedVersionId: e.approved_version_id ?? '',
            status: e.status ?? '',
            versions: (
              e.engraving_versions_engraving_versions_engraving_idToengravings ??
              []
            ).map((v) => ({
              id: v.id,
              engravingId: v.engraving_id,
              versionNumber: v.version_number,
              selectedMaterialId: v.selected_material_id ?? '',
              selectedGemstoneId: v.selected_gemstone_id ?? '',
              ringSize: v.ring_size ?? '',
              ringStyle: v.ring_style ?? '',
              ringShape: v.ring_shape ?? '',
              customizationConfig: v.customization_config
                ? JSON.stringify(v.customization_config)
                : '',
              selectedBiometrics: v.selected_biometrics ?? '',
              status: v.status ?? '',
              managerId: v.manager_id ?? '',
              managerNote: v.manager_note ?? '',
              reviewedAt: v.reviewed_at?.toISOString() ?? '',
              createdAt: v.created_at?.toISOString() ?? '',
            })),
            biometrics: (e.engraving_biometrics ?? []).map((b) => ({
              id: b.id,
              engravingId: b.engraving_id,
              biometricType: b.biometric_type,
              requiredChannel: b.required_channel,
              rawFileUrl: b.raw_file_url ?? '',
              processedSvgUrl: b.processed_svg_url ?? '',
              extraData: b.extra_data ? JSON.stringify(b.extra_data) : '',
              status: b.status ?? '',
            })),
          }
        : null,
    };
  }
}
