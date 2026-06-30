import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { Webhook } from '@payos/node';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PAYOS_LINK_TTL_MS, IOT_FEE_AMOUNT } from '@app/common';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
  ) {}

  async createOrder(engravingIds: string[], userId: string, packageType: string) {
    if (!engravingIds?.length) {
      throw new BadRequestException('At least one engravingId is required');
    }

    const engravings = await this.prisma.engravings.findMany({
      where: { id: { in: engravingIds } },
      include: {
        engraving_versions_engraving_versions_engraving_idToengravings: {
          orderBy: { version_number: 'desc' },
          take: 1,
        },
      },
    });

    if (engravings.length !== engravingIds.length) {
      throw new NotFoundException('One or more engravings not found');
    }

    for (const e of engravings) {
      if (e.user_id !== userId) {
        throw new ForbiddenException(
          `Engraving ${e.id} does not belong to this user (userId: ${userId})`,
        );
      }
      if (e.order_id) {
        throw new BadRequestException(
          `Engraving ${e.id} is already linked to an order`,
        );
      }
    }

    const captureRoute = packageType === 'SW' ? 'ONLINE' : 'OFFLINE';
    const initialStatus = captureRoute === 'ONLINE'
      ? 'AWAITING_SUBMIT'
      : 'AWAITING_DEPOSIT_1';

    let designDraftId: string | null = null;
    if (engravings[0].unique_product_id) {
      const draft = await this.prisma.design_drafts.findUnique({
        where: { design_code: engravings[0].unique_product_id },
        select: { id: true },
      });
      designDraftId = draft?.id ?? null;
    }

    const orderId = randomUUID();
    const orderCode = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const price = await this.calculatePrice(engravings[0]);

    const order = await this.prisma.orders.create({
      data: {
        id: orderId,
        order_code: orderCode,
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

    await this.prisma.engravings.updateMany({
      where: { id: { in: engravingIds } },
      data: { order_id: orderId },
    });

    return { order: await this.mapOrder(order) };
  }

  async getOrder(id: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        engravings: {
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
    engravingIds?: string[],
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id },
      include: {
        engravings: {
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

    // Determine target engravings: if engravingIds provided and non-empty, filter; else all
    const targetEngravings =
      engravingIds && engravingIds.length > 0
        ? order.engravings.filter((e) => engravingIds.includes(e.id))
        : order.engravings;

    if (targetEngravings.length === 0) {
      throw new BadRequestException('No matching engravings found for review');
    }

    if (action === 'approve') {
      for (const engraving of targetEngravings) {
        const latest =
          engraving
            .engraving_versions_engraving_versions_engraving_idToengravings[0];
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
      }

      // Update qr_memories with biometric display settings
      for (const engraving of targetEngravings) {
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
      }

      // Check if all engravings in order are APPROVED
      const allEngravings = await this.prisma.engravings.findMany({
        where: { order_id: id },
      });
      const allApproved = allEngravings.every((e) => e.status === 'APPROVED');

      const updateData: Record<string, unknown> = {
        approved_by_manager_id: managerId,
      };
      if (note) updateData.note = note;
      if (allApproved) {
        updateData.status = 'AWAITING_DEPOSIT';
      }

      const updated = await this.prisma.orders.update({
        where: { id },
        data: updateData,
      });

      return { order: await this.mapOrder(updated) };
    }

    if (action === 'reject') {
      for (const engraving of targetEngravings) {
        const latest =
          engraving
            .engraving_versions_engraving_versions_engraving_idToengravings[0];
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
              status: 'PENDING',
            },
          });
        }
      }

      // Check if ALL engravings are now REJECTED
      const allEngravings = await this.prisma.engravings.findMany({
        where: { order_id: id },
      });
      const allRejected = allEngravings.every((e) => e.status === 'REJECTED');

      const updateData: Record<string, unknown> = {
        approved_by_manager_id: managerId,
      };
      if (note) updateData.note = note;
      if (allRejected) {
        updateData.status = 'REVISION_REQUIRED';
      }

      const updated = await this.prisma.orders.update({
        where: { id },
        data: updateData,
      });

      return { order: await this.mapOrder(updated) };
    }

    throw new BadRequestException('Action must be "approve" or "reject"');
  }

  async submitOrder(id: string) {
    const order = await this.prisma.orders.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (!['AWAITING_SUBMIT', 'AWAITING_CAPTURE'].includes(order.status ?? '')) {
      throw new BadRequestException(
        'Order must be in AWAITING_SUBMIT or AWAITING_CAPTURE to submit',
      );
    }

    const updated = await this.prisma.orders.update({
      where: { id },
      data: { status: 'PENDING_REVIEW' },
    });

    return { order: await this.mapOrder(updated) };
  }

  async attachBiometric(
    engravingId: string,
    biometricType: string,
    rawFileUrl: string,
  ) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: engravingId },
      include: { orders: true },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (!engraving.order_id) {
      throw new BadRequestException('Engraving not linked to an order');
    }

    if (engraving.orders?.status !== 'AWAITING_CAPTURE') {
      throw new BadRequestException(
        'Order must be in AWAITING_CAPTURE status to attach biometrics',
      );
    }

    const packageTypes = (engraving.orders.package_type ?? '').split('+');
    if (!packageTypes.includes(biometricType)) {
      throw new BadRequestException(
        `Biometric type ${biometricType} not in package ${engraving.orders.package_type}`,
      );
    }

    const processedSvgUrl = await this.processBiometric(biometricType, rawFileUrl, engravingId);

    const requiredChannel = biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING';

    const biometric = await this.prisma.engraving_biometrics.create({
      data: {
        id: randomUUID(),
        engraving_id: engravingId,
        biometric_type: biometricType,
        required_channel: requiredChannel,
        raw_file_url: rawFileUrl,
        processed_svg_url: processedSvgUrl,
        extra_data: {},
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
    if (biometricType === 'SW') {
      // TODO: call Python process-audio via BiometricService gRPC
      return rawFileUrl;
    }
    if (biometricType === 'FP') {
      // TODO: call Python process-fingerprint via BiometricService gRPC
      return rawFileUrl;
    }
    return rawFileUrl;
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

    const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'];
    if (!allowedPhases.includes(paymentPhase)) {
      throw new BadRequestException(
        'paymentPhase must be DEPOSIT_1, DEPOSIT_2, or REMAINING',
      );
    }

    let amount = 0;
    if (paymentPhase === 'DEPOSIT_1') {
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
      where: { order_id: orderId, payment_phase: paymentPhase, status: 'PENDING' },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      const ageMs = existing.created_at
        ? Date.now() - existing.created_at.getTime()
        : Infinity;

      if (ageMs < PAYOS_LINK_TTL_MS && existing.qr_code && existing.payment_url) {
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
        } catch { /* proceed */ }
      }
      await this.prisma.payments.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });
    }

    const payosOrderCode = Number(`${Date.now()}${Math.floor(Math.random() * 100)}`);
    console.log(`[PayOS] Creating payment link: orderCode=${payosOrderCode}, amount=${amount}`);
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

  async handlePayOSWebhook(input: {
    webhookBody: string;
  }) {
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
        newStatus = 'AWAITING_CAPTURE';
      } else if (payment.payment_phase === 'DEPOSIT_2') {
        newStatus = 'DEPOSIT_PAID';
      } else if (payment.payment_phase === 'REMAINING') {
        newStatus = 'COMPLETED';
      }

      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          paid_amount: newPaidAmount,
          remaining_amount: remainingAmount >= 0 ? remainingAmount : 0,
          status: newStatus,
        },
      });
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

  private mapTask(task: Record<string, any>): Record<string, any> {
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

    const engraving = await this.prisma.engravings.findFirst({
      where: { order_id: orderId },
    });
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
      const order = await this.prisma.orders.findUnique({
        where: { id: task.order_id },
      });

      const remainingAmount = Number(order?.remaining_amount ?? 0);
      if (remainingAmount > 0) {
        await this.prisma.orders.update({
          where: { id: task.order_id },
          data: { status: 'AWAITING_REMAINING' },
        });
      } else {
        await this.prisma.orders.update({
          where: { id: task.order_id },
          data: { status: 'COMPLETED' },
        });
      }
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
      engravings: [],
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
    engravings?: Array<{
      id: string;
      order_id?: string | null;
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
    }>;
  }) {
    const base = await this.mapOrder(order);

    return {
      ...base,
      engravings: (order.engravings ?? []).map((e) => ({
        id: e.id,
        orderId: e.order_id ?? '',
        userId: e.user_id ?? '',
        productId: e.product_id ?? '',
        uniqueProductId: e.unique_product_id ?? '',
        approvedVersionId: e.approved_version_id ?? '',
        status: e.status ?? '',
        versions: (
          e.engraving_versions_engraving_versions_engraving_idToengravings ?? []
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
      })),
    };
  }
}
