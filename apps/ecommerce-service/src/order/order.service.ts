import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
  ) {}

  async createOrder(engravingIds: string[], userId: string) {
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

    const latestVersion =
      engravings[0]
        .engraving_versions_engraving_versions_engraving_idToengravings[0];

    if (!latestVersion) {
      throw new BadRequestException('Engraving has no versions');
    }

    const config = latestVersion.customization_config as Record<
      string,
      unknown
    > | null;
    const selectedBiometrics = (config?.selectedBiometrics as string[]) ?? [];
    const captureRoute = selectedBiometrics.includes('SW')
      ? 'ONLINE'
      : 'OFFLINE';
    let designDraftId: string | null = null;
    if (engravings[0].unique_product_id) {
      const draft = await this.prisma.design_drafts.findUnique({
        where: { design_code: engravings[0].unique_product_id },
        select: { id: true },
      });
      designDraftId = draft?.id ?? null;
    }

    const orderId = randomUUID();
    const orderCode = `BIORING-${Date.now().toString(36).toUpperCase()}`;

    const price = await this.calculatePrice(engravings[0]);

    const order = await this.prisma.orders.create({
      data: {
        id: orderId,
        order_code: orderCode,
        user_id: userId,
        design_draft_id: designDraftId,
        capture_route: captureRoute,
        design_source: 'MOBILE',
        status: 'PENDING_REVIEW',
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

    const allowedPhases = ['DEPOSIT', 'REMAINING'];
    if (!allowedPhases.includes(paymentPhase)) {
      throw new BadRequestException(
        'paymentPhase must be DEPOSIT or REMAINING',
      );
    }

    let amount = 0;
    if (paymentPhase === 'DEPOSIT') {
      amount = Math.round(Number(order.total_price ?? 0) * 0.3);
      if (Number(order.paid_amount ?? 0) >= amount) {
        throw new BadRequestException('Deposit already paid');
      }
    } else {
      amount = Number(order.remaining_amount ?? 0);
      if (amount <= 0) {
        throw new BadRequestException('No remaining amount to pay');
      }
    }

    const payosResult = await this.payOS.createPaymentLink({
      orderCode: order.order_code,
      amount,
      description: `Bioring ${paymentPhase === 'DEPOSIT' ? 'cọc' : 'thanh toán'} - ${order.order_code}`,
      returnUrl,
      cancelUrl,
    });

    const payment = await this.prisma.payments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        payment_phase: paymentPhase,
        amount,
        method: 'PAYOS',
        status: 'PENDING',
        payos_transaction_id: payosResult.transactionId,
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
        paymentUrl: '',
        paidAt: payment.paid_at?.toISOString() ?? '',
        createdAt: payment.created_at?.toISOString() ?? '',
      },
      paymentUrl: payosResult.paymentUrl,
      qrCode: payosResult.qrCode,
    };
  }

  async handlePayOSWebhook(data: {
    orderCode: string;
    transactionId: string;
    paymentCode?: string;
    status: string;
    amount: number;
    signature: string;
  }) {
    const valid = this.payOS.verifyWebhook(data);
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const order = await this.prisma.orders.findUnique({
      where: { order_code: data.orderCode },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payment = await this.prisma.payments.findFirst({
      where: {
        order_id: order.id,
        payos_transaction_id: data.transactionId,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const isSuccess = data.status === 'PAID';

    await this.prisma.payments.update({
      where: { id: payment.id },
      data: {
        status: isSuccess ? 'PAID' : 'FAILED',
        payment_code: data.paymentCode ?? null,
        paid_at: isSuccess ? new Date() : null,
      },
    });

    if (isSuccess) {
      const newPaidAmount = Number(order.paid_amount ?? 0) + data.amount;
      const totalPrice = Number(order.total_price ?? 0);
      const remainingAmount = totalPrice - newPaidAmount;

      let newStatus = order.status;
      if (payment.payment_phase === 'DEPOSIT') {
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
        task_name: `Sản xuất nhẫn - ${order.order_code}`,
        status: 'IN_PROGRESS',
        started_at: new Date(),
      },
    });

    await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: 'IN_PRODUCTION' },
    });

    return {
      task: {
        id: task.id,
        orderId: task.order_id,
        engravingId: task.engraving_id,
        assignedJewelerId: task.assigned_jeweler_id ?? '',
        assignedJewelerName: jeweler.full_name ?? '',
        status: task.status ?? '',
        note: task.note ?? '',
        startedAt: task.started_at?.toISOString() ?? '',
        completedAt: task.completed_at?.toISOString() ?? '',
        createdAt: task.created_at?.toISOString() ?? '',
      },
    };
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

    return {
      task: {
        id: updated.id,
        orderId: updated.order_id,
        engravingId: updated.engraving_id,
        assignedJewelerId: updated.assigned_jeweler_id ?? '',
        assignedJewelerName: '',
        status: updated.status ?? '',
        note: updated.note ?? '',
        startedAt: updated.started_at?.toISOString() ?? '',
        completedAt: updated.completed_at?.toISOString() ?? '',
        createdAt: updated.created_at?.toISOString() ?? '',
      },
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
