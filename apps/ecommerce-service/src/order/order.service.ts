import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ClientGrpc } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { Webhook } from '@payos/node';
import { randomUUID } from 'node:crypto';
import { Observable, lastValueFrom } from 'rxjs';
import { DEFAULT_PAYOS_LINK_TTL_MS, IOT_FEE_AMOUNT } from '@app/common';
import { resolveUrlsFromApprovedFiles } from '@app/common';

interface BiometricGrpcService {
  attachEngravingBiometric(data: {
    engravingId: string;
    biometricType: string;
    fileContent: Buffer;
    filename: string;
    contentType: string;
    extraData?: string;
  }): Observable<{ biometricJson: string }>;
}

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
  orders?: {
    order_code: string | null;
    users_orders_user_idTousers?: { full_name: string | null } | null;
    guest_customers?: { full_name: string | null } | null;
  } | null;
  engravings?: {
    engraving_versions_engravings_approved_version_idToengraving_versions?: {
      ring_size: string | null;
    } | null;
  } | null;
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
export class OrderService implements OnModuleInit {
  private biometricGrpc?: BiometricGrpcService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject('BIOMETRIC_SERVICE')
    private readonly biometricClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.biometricGrpc =
      this.biometricClient?.getService<BiometricGrpcService>(
        'BiometricService',
      );
  }
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
            include: { materials: true, gemstones: true },
            orderBy: { version_number: 'desc' },
          },
            biometric_assets: true,
            products: {
              include: {
                materials: true,
                product_materials: { include: { materials: true } },
                product_gemstones: { include: { gemstones: true } },
              },
            },
          },
        },
        payments: true,
        users_orders_user_idTousers: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
        guest_customers: {
          select: { id: true, full_name: true, email: true, phone: true },
        },
        shipments: {
          include: { user_addresses: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { order: await this.mapOrderFull(order) };
  }

  async getMyOrders(
    userId: string,
    page: number,
    limit: number,
    customerEmail?: string,
  ) {
    const skip = (page - 1) * limit;
    let where: Prisma.ordersWhereInput = { user_id: userId };

    if (customerEmail && customerEmail.trim()) {
      const email = customerEmail.trim();
      const [user, guest] = await Promise.all([
        this.prisma.users.findUnique({
          where: { email },
          select: { id: true },
        }),
        this.prisma.guest_customers.findFirst({
          where: { email },
          select: { id: true },
        }),
      ]);

      const orConditions: Prisma.ordersWhereInput[] = [];
      if (user) orConditions.push({ user_id: user.id });
      if (guest) orConditions.push({ guest_customer_id: guest.id });

      if (orConditions.length > 0) {
        where = { OR: orConditions };
      } else {
        return { orders: [], total: 0, page, limit };
      }
    } else if (!userId) {
      throw new BadRequestException('userId or customerEmail is required');
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          payments: true,
          users_orders_user_idTousers: {
            select: { id: true, full_name: true, email: true, phone: true },
          },
          guest_customers: {
            select: { id: true, full_name: true, email: true, phone: true },
          },
          shipments: {
            include: { user_addresses: true },
          },
          engraving: {
            include: {
              engraving_versions_engraving_versions_engraving_idToengravings: {
                include: { materials: true, gemstones: true },
                orderBy: { version_number: 'desc' },
              },
              biometric_assets: true,
              products: {
                include: {
                  materials: true,
                  product_materials: { include: { materials: true } },
                  product_gemstones: { include: { gemstones: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      orders: await Promise.all(
        orders.map((o) =>
          this.mapOrder(o).then((base) => ({
              ...base,
              engraving: o.engraving
                ? this.mapEngravingForOrder(o.id, o.engraving as Parameters<typeof this.mapEngravingForOrder>[1])
                : null,
            })),
        ),
      ),
      total,
      page,
      limit,
    };
  }

  async listOrders(
    page: number,
    limit: number,
    status?: string,
    search?: string,
    from_date?: string,
    to_date?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ordersWhereInput = {};

    if (status) where.status = status;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at.gte = new Date(from_date);
      if (to_date) where.created_at.lte = new Date(to_date);
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { order_code: { contains: q, mode: 'insensitive' } },
        { users_orders_user_idTousers: { full_name: { contains: q, mode: 'insensitive' } } },
        { guest_customers: { full_name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          payments: true,
          users_orders_user_idTousers: {
            select: { id: true, full_name: true, email: true, phone: true },
          },
          guest_customers: {
            select: { id: true, full_name: true, email: true, phone: true },
          },
          shipments: {
            include: { user_addresses: true },
          },
          engraving: {
            include: {
              engraving_versions_engraving_versions_engraving_idToengravings: {
                include: { materials: true, gemstones: true },
                orderBy: { version_number: 'desc' },
              },
              biometric_assets: true,
              products: {
                include: {
                  materials: true,
                  product_materials: { include: { materials: true } },
                  product_gemstones: { include: { gemstones: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      orders: await Promise.all(
        orders.map((o) =>
          this.mapOrder(o).then((base) => ({
            ...base,
            engraving: o.engraving
              ? this.mapEngravingForOrder(o.id, o.engraving as Parameters<typeof this.mapEngravingForOrder>[1])
              : null,
          })),
        ),
      ),
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

      // Update qr_memories with biometric display settings from linked assets
      const assets = await this.prisma.biometric_assets.findMany({
        where: { engraving_id: engraving.id },
      });
      if (assets.length > 0) {
        const assetTypeMap: Record<string, string> = {
          fingerprint: 'FP',
          soundwave: 'SW',
          heartbeat: 'HB',
        };
        const displaySettings: Record<string, unknown> = {};
        for (const asset of assets) {
          const type = assetTypeMap[asset.asset_type] ?? asset.asset_type;
          const urls = resolveUrlsFromApprovedFiles(asset.approved_files);
          displaySettings[type] = {
            biometricAssetId: asset.id,
            processedSvgUrl: urls.processedSvgUrl,
            rawFileUrl: urls.rawFileUrl,
            extraData: asset.placement ?? {},
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
      this.eventEmitter.emit('audit.log', {
        userId: managerId,
        action: 'status_change',
        entityName: 'orders',
        entityId: id,
        newValue: { status: 'AWAITING_DEPOSIT' },
      });

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
            ring_shape: latest.ring_shape ?? 'ROUND',
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

      this.eventEmitter.emit('order.rejected', {
        orderId: id,
        note: note ?? '',
      });
      this.eventEmitter.emit('audit.log', {
        userId: managerId,
        action: 'status_change',
        entityName: 'orders',
        entityId: id,
        newValue: { status: 'REVISION_REQUIRED' },
      });

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
        const uploaded = await this.prisma.biometric_assets.findMany({
          where: { engraving_id: engraving.id },
          select: { asset_type: true },
        });
        const assetTypeMap: Record<string, string> = {
          fingerprint: 'FP',
          soundwave: 'SW',
          heartbeat: 'HB',
        };
        const uploadedTypes = new Set(
          uploaded.map((b) => assetTypeMap[b.asset_type] ?? b.asset_type).filter(Boolean),
        );
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

    this.eventEmitter.emit('audit.log', {
      action: 'status_change',
      entityName: 'orders',
      entityId: id,
      newValue: { status: 'PENDING_REVIEW' },
    });

    return { order: await this.mapOrder(updated) };
  }

  async attachBiometric(
    engravingId: string,
    biometricType: string,
    fileContent: Buffer | Uint8Array,
    filename: string,
    contentType: string,
    extraData?: string,
  ) {
    if (!this.biometricGrpc) {
      throw new BadRequestException('BIOMETRIC_SERVICE is not available');
    }

    const buffer = Buffer.isBuffer(fileContent)
      ? fileContent
      : Buffer.from(fileContent ?? []);
    if (!buffer.length) {
      throw new BadRequestException('fileContent is required');
    }

    const response = await lastValueFrom(
      this.biometricGrpc.attachEngravingBiometric({
        engravingId,
        biometricType,
        fileContent: buffer,
        filename: filename || 'upload.bin',
        contentType: contentType || 'application/octet-stream',
        extraData,
      }),
    );

    const biometric = JSON.parse(response.biometricJson) as Record<
      string,
      unknown
    >;

    // Keep snake_case aliases for older gRPC/FE consumers.
    return {
      biometric: {
        ...biometric,
        raw_file_url: biometric.rawFileUrl,
        processed_svg_url: biometric.processedSvgUrl,
        biometric_type: biometric.biometricType,
        engraving_id: biometric.engravingId,
        required_channel: biometric.requiredChannel,
        biometric_asset_id: biometric.biometricAssetId,
        extra_data: biometric.extraData,
      },
    };
  }

  async attachBiometricsBulk(
    engravingId: string,
    biometrics: Array<{
      biometricType: string;
      fileContent: Buffer | Uint8Array;
      filename?: string;
      contentType?: string;
      extraData?: string;
    }>,
  ) {
    const results = await Promise.all(
      biometrics.map((b) =>
        this.attachBiometric(
          engravingId,
          b.biometricType,
          b.fileContent,
          b.filename || 'upload.bin',
          b.contentType || 'application/octet-stream',
          b.extraData,
        ),
      ),
    );
    const items = results.map((r) => r.biometric);
    return { count: items.length, biometrics: items };
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
        const pendingShipment = await this.prisma.shipments.findFirst({
          where: { order_id: order.id, status: 'PENDING' },
        });
        if (pendingShipment) {
          await this.prisma.shipments.update({
            where: { id: pendingShipment.id },
            data: { status: 'ACTIVE' },
          });
          newStatus =
            pendingShipment.delivery_method === 'PICKUP'
              ? 'READY_FOR_PICKUP'
              : 'READY_FOR_DELIVERY';
        } else {
          newStatus = 'READY_FOR_DELIVERY';
        }
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

      // Biên lai thanh toán: mọi phase thành công (DEPOSIT_1/2, REMAINING, FULL)
      this.eventEmitter.emit('payment.confirmed', {
        orderId: order.id,
        paymentId: payment.id,
        paymentPhase: payment.payment_phase ?? undefined,
      });
      this.eventEmitter.emit('audit.log', {
        action: 'payment_received',
        entityName: 'orders',
        entityId: order.id,
        newValue: {
          paymentPhase: payment.payment_phase,
          amount: webhookData.amount,
          status: 'PAID',
        },
      });

      if (
        newStatus === 'READY_FOR_DELIVERY' ||
        newStatus === 'READY_FOR_PICKUP'
      ) {
        this.eventEmitter.emit('order.ready_for_delivery', {
          orderId: order.id,
          method:
            newStatus === 'READY_FOR_PICKUP' ? 'PICKUP' : 'DELIVERY',
        });
      }

      if (newStatus === 'DEPOSIT_PAID') {
        await this.prisma.production_tasks.create({
          data: {
            id: randomUUID(),
            order_id: order.id,
            engraving_id: order.engraving_id,
            task_name: `Ring production - ${order.order_code}`,
            status: 'PENDING',
          },
        });
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
    data: {
      paymentPhase: string;
      amount: number;
      receivedBy: string;
      paymentMethod: string;
      reference?: string;
    },
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
        method: data.paymentMethod,
        status: 'PAID',
        paid_at: new Date(),
        payos_transaction_id: data.reference ?? null,
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

    if (
      data.paymentPhase === 'DEPOSIT_1' ||
      data.paymentPhase === 'DEPOSIT_2' ||
      data.paymentPhase === 'REMAINING' ||
      data.paymentPhase === 'FULL'
    ) {
      this.eventEmitter.emit('payment.confirmed', {
        orderId,
        paymentId: payment.id,
        paymentPhase: data.paymentPhase,
      });
    }

    if (
      newStatus === 'READY_FOR_DELIVERY' ||
      newStatus === 'READY_FOR_PICKUP'
    ) {
      this.eventEmitter.emit('order.ready_for_delivery', {
        orderId,
        method: newStatus === 'READY_FOR_PICKUP' ? 'PICKUP' : 'DELIVERY',
      });
    }

    if (newStatus === 'DEPOSIT_PAID') {
      await this.prisma.production_tasks.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          engraving_id: order.engraving_id,
          task_name: `Ring production - ${order.order_code}`,
          status: 'PENDING',
        },
      });
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

  async confirmPickup(orderId: string, staffId: string, note?: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: { engraving: { include: { qr_memories: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (Number(order.remaining_amount ?? 0) > 0) {
      throw new BadRequestException(
        'Order still has remaining payment. Please collect before handover.',
      );
    }

    if (
      order.status !== 'READY_FOR_DELIVERY' &&
      order.status !== 'READY_FOR_PICKUP'
    ) {
      throw new BadRequestException(
        `Order must be READY_FOR_DELIVERY or READY_FOR_PICKUP, got ${order.status}`,
      );
    }

    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        updated_at: new Date(),
      },
    });

    // Activate warranty
    const warranty = await this.prisma.warranties.create({
      data: {
        id: randomUUID(),
        engraving_id: order.engraving_id,
        order_id: orderId,
        warranty_code: `WAR-${Date.now()}`,
        status: 'ACTIVE',
        issue_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        activated_at: new Date(),
      },
    });

    // Unlock QR memory
    const qrMemory = order.engraving?.qr_memories;
    if (qrMemory) {
      await this.prisma.qr_memories.update({
        where: { id: qrMemory.id },
        data: { is_locked: false },
      });
    }

    this.eventEmitter.emit('order.completed', { orderId });

    return {
      success: true,
      order: await this.mapOrder(updated),
      warrantyCode: warranty.warranty_code ?? '',
      warrantyExpiry: warranty.expiry_date?.toISOString() ?? '',
      qrMemoryUnlocked: !!qrMemory,
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

  // ===== Finance Mutations =====

  async forcePaidPayment(paymentId: string, adminId: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payments.update({
      where: { id: paymentId },
      data: { status: 'PAID', paid_at: new Date() },
    });

    const order = await this.prisma.orders.findUnique({
      where: { id: updated.order_id ?? '' },
    });
    if (order) {
      const newPaidAmount =
        Number(order.paid_amount ?? 0) + Number(updated.amount ?? 0);
      const totalPrice = Number(order.total_price ?? 0);
      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          paid_amount: newPaidAmount,
          remaining_amount: Math.max(totalPrice - newPaidAmount, 0),
        },
      });
    }

    return { payment: this.mapPaymentProto(updated) };
  }

  async syncPaymentStatus(paymentId: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const order = await this.prisma.orders.findUnique({
      where: { id: payment.order_id ?? '' },
      select: { order_code: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payosResult = await this.payOS.getTransactionStatus(order.order_code);

    const mappedStatus =
      payosResult.status === 'PAID' ? 'PAID' : payosResult.status;

    const updateData: Record<string, unknown> = { status: mappedStatus };
    if (mappedStatus === 'PAID') updateData.paid_at = new Date();
    const updated = await this.prisma.payments.update({
      where: { id: paymentId },
      data: updateData,
    });

    return {
      payment: this.mapPaymentProto(updated),
      payosStatus: payosResult.status,
      orderCode: order.order_code,
    };
  }

  async refundPayment(paymentId: string, adminId: string, reason: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'REFUNDED')
      throw new BadRequestException('Payment already refunded');

    const updated = await this.prisma.payments.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', is_refund: true },
    });

    const order = await this.prisma.orders.findUnique({
      where: { id: updated.order_id ?? '' },
    });
    if (order) {
      const refundAmount = Number(updated.amount ?? 0);
      const newPaidAmount = Math.max(
        Number(order.paid_amount ?? 0) - refundAmount,
        0,
      );
      const totalPrice = Number(order.total_price ?? 0);
      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          paid_amount: newPaidAmount,
          remaining_amount: Math.min(totalPrice - newPaidAmount, totalPrice),
        },
      });
    }

    return { payment: this.mapPaymentProto(updated) };
  }

  async updateShippingFee(paymentId: string, amount: number) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const order = await this.prisma.orders.findUnique({
      where: { id: payment.order_id ?? '' },
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.orders.update({
      where: { id: order.id },
      data: { extra_fee: amount },
    });

    return { success: true };
  }

  private mapPaymentProto(p: Record<string, unknown>) {
    return {
      id: p.id,
      orderId: p.order_id ?? '',
      paymentPhase: p.payment_phase ?? '',
      amount: Number(p.amount ?? 0),
      method: p.method ?? '',
      status: p.status ?? '',
      payosTransactionId: p.payos_transaction_id ?? '',
      paymentUrl: p.payment_url ?? '',
      paidAt:
        p.paid_at instanceof Date ? p.paid_at.toISOString() : (p.paid_at ?? ''),
      createdAt:
        p.created_at instanceof Date
          ? p.created_at.toISOString()
          : (p.created_at ?? ''),
    };
  }

  private taskInclude() {
    return {
      users: { select: { full_name: true } },
      orders: {
        select: {
          order_code: true,
          users_orders_user_idTousers: { select: { full_name: true } },
          guest_customers: { select: { full_name: true } },
        },
      },
      engravings: {
        include: {
          engraving_versions_engravings_approved_version_idToengraving_versions:
            {
              select: { ring_size: true },
            },
        },
      },
    };
  }

  private mapTask(task: TaskRecord) {
    const userName = task.orders?.users_orders_user_idTousers?.full_name;
    const guestName = task.orders?.guest_customers?.full_name;
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
      orderCode: task.orders?.order_code ?? '',
      customerName: userName ?? guestName ?? '',
      ringSize:
        task.engravings
          ?.engraving_versions_engravings_approved_version_idToengraving_versions
          ?.ring_size ?? '',
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

    let task = await this.prisma.production_tasks.findFirst({
      where: { order_id: orderId, status: 'PENDING' },
    });
    if (!task) {
      task = await this.prisma.production_tasks.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          engraving_id: engraving.id,
          assigned_jeweler_id: jewelerId,
          task_name: `Ring production - ${order.order_code}`,
          status: 'IN_PROGRESS',
          started_at: new Date(),
        },
        include: this.taskInclude(),
      });
    } else {
      task = await this.prisma.production_tasks.update({
        where: { id: task.id },
        data: {
          assigned_jeweler_id: jewelerId,
          status: 'IN_PROGRESS',
          started_at: new Date(),
        },
        include: this.taskInclude(),
      });
    }

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
      include: this.taskInclude(),
    });

    return { task: this.mapTask(taskWithUser ?? updated) };
  }

  async getProductionTasks(query: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    jewelerId?: string;
    all?: boolean;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.orderId) where.order_id = query.orderId;
    if (query.jewelerId) where.assigned_jeweler_id = query.jewelerId;

    // ponytail: default filter — only tasks from active orders (DEPOSIT_PAID onward).
    // Manager can bypass with ?all=true to see tasks from any order status.
    if (!query.all) {
      where.orders = {
        status: {
          in: ['DEPOSIT_PAID', 'IN_PRODUCTION', 'PENDING_QC', 'COMPLETED'],
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.production_tasks.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: this.taskInclude(),
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
      throw new BadRequestException(
        'Order must be IN_PRODUCTION or PENDING_QC',
      );
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
        this.eventEmitter.emit('order.ready_for_delivery', {
          orderId,
          method: 'DELIVERY',
        });
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

  async saveDeliveryPreference(
    orderId: string,
    addressId: string,
    method: string,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'AWAITING_REMAINING') {
      throw new BadRequestException(
        'Delivery preference can only be set when order is AWAITING_REMAINING',
      );
    }

    const existing = await this.prisma.shipments.findFirst({
      where: { order_id: orderId, status: 'PENDING' },
    });

    if (existing) {
      const updated = await this.prisma.shipments.update({
        where: { id: existing.id },
        data: {
          address_id: addressId,
          delivery_method: method,
        },
      });
      return { shipmentId: updated.id, status: updated.status ?? 'PENDING' };
    }

    const shipment = await this.prisma.shipments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        address_id: addressId,
        delivery_method: method,
        status: 'PENDING',
      },
    });

    return { shipmentId: shipment.id, status: shipment.status ?? 'PENDING' };
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

    this.eventEmitter.emit('order.completed', { orderId });

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
      include: this.taskInclude(),
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

  private async calculatePrice(engraving: any) {
    let subtotal = 0;
    let serviceFee = 0;
    const extraFee = 0;
    const discountAmount = 0;

    // Constants for pricing
    const BASE_WEIGHT_GRAMS = 3.0;
    const BASE_RING_SIZE = 10;
    const WEIGHT_PER_SIZE = 0.1;

    // Lấy version mới nhất để lấy vật liệu và size nhẫn
    const version =
      engraving.engraving_versions_engraving_versions_engraving_idToengravings?.[0];
    const ringSizeStr = version?.ring_size;
    const materialId = version?.selected_material_id;
    const gemstoneId = version?.selected_gemstone_id;

    if (materialId) {
      const material = await this.prisma.materials.findUnique({
        where: { id: materialId },
      });

      if (material && material.current_price_per_gram) {
        // Tính trọng lượng ước tính
        let size = BASE_RING_SIZE;
        if (ringSizeStr && !isNaN(Number(ringSizeStr))) {
          size = Number(ringSizeStr);
        }
        
        let estimatedWeight = BASE_WEIGHT_GRAMS;
        if (size > BASE_RING_SIZE) {
          estimatedWeight = BASE_WEIGHT_GRAMS + (size - BASE_RING_SIZE) * WEIGHT_PER_SIZE;
        }

        const materialCost = estimatedWeight * Number(material.current_price_per_gram);
        subtotal += materialCost;
      }
    }

    // Nếu có gemstone, cộng thêm tiền gem
    if (gemstoneId) {
      const gemstone = await this.prisma.gemstones.findUnique({
        where: { id: gemstoneId },
      });
      if (gemstone && gemstone.price) {
        subtotal += Number(gemstone.price);
      }
    }

    // Nếu không có material/gem (fallback), lấy base_price của product
    if (subtotal === 0 && engraving.product_id) {
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
    users_orders_user_idTousers?: {
      id: string;
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    guest_customers?: {
      id: string;
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    shipments?: Array<{
      recipient_name?: string | null;
      recipient_phone?: string | null;
      shipping_address_text?: string | null;
      user_addresses?: {
        full_address?: string | null;
        ward?: string | null;
        district?: string | null;
        province?: string | null;
      } | null;
    }>;
    engraving?: {
      products?: {
        id: string;
        name: string;
        base_price?: unknown;
        thumbnail_url?: string | null;
      } | null;
    } | null;
  }) {
    const payments = order.payments ?? [];
    const user = order.users_orders_user_idTousers;
    const guest = order.guest_customers;
    const shipment = order.shipments?.[0];
    const addr = shipment?.user_addresses;
    const product = order.engraving?.products;

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
      customerName: user?.full_name ?? guest?.full_name ?? '',
      customerEmail: user?.email ?? guest?.email ?? '',
      customerPhone: user?.phone ?? guest?.phone ?? '',
      paymentMethod: payments[0]?.method ?? '',
      paymentStatus: payments[0]?.status ?? '',
      shippingInfo: shipment
        ? {
            street: shipment.shipping_address_text ?? addr?.full_address ?? '',
            city: addr?.province ?? '',
            ward: addr?.ward ?? '',
            recipientName: shipment.recipient_name ?? '',
            recipientPhone: shipment.recipient_phone ?? '',
          }
        : null,
      orderItems: product
        ? [
            {
              productName: product.name,
              productId: product.id,
              quantity: 1,
              unitPrice: Number(product.base_price ?? 0),
              totalPrice: Number(product.base_price ?? 0),
              thumbnailUrl: product.thumbnail_url ?? '',
            },
          ]
        : [],
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

  private mapEngravingForOrder(
    orderId: string,
    e: NonNullable<{
      id: string;
      user_id?: string | null;
      product_id?: string | null;
      created_at?: Date | null;
      updated_at?: Date | null;
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
        materials?: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } | null;
        gemstones?: { id: string; type: string; carat: unknown; cut: string | null; color: string | null; clarity: string | null; certification_code: string | null; price: unknown; is_available: boolean | null; render_config?: unknown } | null;
      }>;
      biometric_assets?: Array<{
        id: string;
        asset_type: string;
        status: string;
        artifact_id: string;
        approved_files?: unknown;
        created_at: Date | null;
      }>;
      products?: {
        id: string;
        name: string;
        description: string | null;
        base_price: unknown;
        thumbnail_url: string | null;
        model_3d_url: string | null;
        materials?: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } | null;
        product_materials?: Array<{ materials: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } }>;
        product_gemstones?: Array<{ gemstones: { id: string; type: string; carat: unknown; cut: string | null; color: string | null; clarity: string | null; certification_code: string | null; price: unknown; is_available: boolean | null; render_config?: unknown } }>;
      } | null;
    }>,
  ) {
    const productName = e.products?.name ?? '';
    return {
      id: e.id,
      orderId,
      userId: e.user_id ?? '',
      productId: e.product_id ?? '',
      uniqueProductId: e.unique_product_id ?? '',
      approvedVersionId: e.approved_version_id ?? '',
      status: e.status ?? '',
      createdAt: e.created_at?.toISOString() ?? '',
      updatedAt: e.updated_at?.toISOString() ?? '',
      versions: (
        e.engraving_versions_engraving_versions_engraving_idToengravings ?? []
      ).map((v) => ({
        id: v.id,
        engravingId: v.engraving_id,
        versionNumber: v.version_number,
        selectedMaterialId: v.selected_material_id ?? '',
        selectedGemstoneId: v.selected_gemstone_id ?? '',
        ringSize: v.ring_size ?? '',
        ringStyle: v.ring_style || productName,
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
        selectedMaterial: v.materials
          ? {
              id: v.materials.id,
              name: v.materials.name,
              purity: v.materials.purity ?? '',
              color: v.materials.color ?? '',
              currentPricePerGram: Number(v.materials.current_price_per_gram ?? 0),
              renderConfig: v.materials.render_config
                ? JSON.stringify(v.materials.render_config)
                : '',
            }
          : null,
        selectedGemstone: v.gemstones
          ? {
              id: v.gemstones.id,
              type: v.gemstones.type,
              carat: Number(v.gemstones.carat ?? 0),
              cut: v.gemstones.cut ?? '',
              color: v.gemstones.color ?? '',
              clarity: v.gemstones.clarity ?? '',
              certificationCode: v.gemstones.certification_code ?? '',
              price: Number(v.gemstones.price ?? 0),
              isAvailable: v.gemstones.is_available ?? false,
              renderConfig: v.gemstones.render_config
                ? JSON.stringify(v.gemstones.render_config)
                : '',
            }
          : null,
      })),
      biometricAssets: (e.biometric_assets ?? []).map((b) => {
        const urls = resolveUrlsFromApprovedFiles(b.approved_files);
        return {
          id: b.id,
          assetType: b.asset_type,
          status: b.status,
          artifactId: b.artifact_id,
          rawFileUrl: urls.rawFileUrl,
          processedSvgUrl: urls.processedSvgUrl,
          createdAt: b.created_at?.toISOString() ?? '',
        };
      }),
      product: e.products
        ? {
            id: e.products.id,
            name: e.products.name,
            description: e.products.description ?? '',
            basePrice: Number(e.products.base_price ?? 0),
            thumbnailUrl: e.products.thumbnail_url ?? '',
            model3dUrl: e.products.model_3d_url ?? '',
            baseMaterial: e.products.materials
              ? {
                  id: e.products.materials.id,
                  name: e.products.materials.name,
                  purity: e.products.materials.purity ?? '',
                  color: e.products.materials.color ?? '',
                  currentPricePerGram: Number(
                    e.products.materials.current_price_per_gram ?? 0,
                  ),
                  renderConfig: e.products.materials.render_config
                    ? JSON.stringify(e.products.materials.render_config)
                    : '',
                }
              : null,
            availableMaterials:
              e.products.product_materials?.map((pm) => ({
                id: pm.materials.id,
                name: pm.materials.name,
                purity: pm.materials.purity ?? '',
                color: pm.materials.color ?? '',
                currentPricePerGram: Number(
                  pm.materials.current_price_per_gram ?? 0,
                ),
                renderConfig: pm.materials.render_config
                  ? JSON.stringify(pm.materials.render_config)
                  : '',
              })) ?? [],
            availableGemstones:
              e.products.product_gemstones?.map((pg) => ({
                id: pg.gemstones.id,
                type: pg.gemstones.type,
                carat: Number(pg.gemstones.carat ?? 0),
                cut: pg.gemstones.cut ?? '',
                color: pg.gemstones.color ?? '',
                clarity: pg.gemstones.clarity ?? '',
                certificationCode: pg.gemstones.certification_code ?? '',
                price: Number(pg.gemstones.price ?? 0),
                isAvailable: pg.gemstones.is_available ?? false,
                renderConfig: pg.gemstones.render_config
                  ? JSON.stringify(pg.gemstones.render_config)
                  : '',
              })) ?? [],
          }
        : null,
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
      created_at?: Date | null;
      updated_at?: Date | null;
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
        materials?: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } | null;
        gemstones?: { id: string; type: string; carat: unknown; cut: string | null; color: string | null; clarity: string | null; certification_code: string | null; price: unknown; is_available: boolean | null; render_config?: unknown } | null;
      }>;
      biometric_assets?: Array<{
        id: string;
        asset_type: string;
        status: string;
        artifact_id: string;
        approved_files?: unknown;
        created_at: Date | null;
      }>;
      products?: {
        id: string;
        name: string;
        description: string | null;
        base_price: unknown;
        thumbnail_url: string | null;
        model_3d_url: string | null;
        materials?: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } | null;
        product_materials?: Array<{ materials: { id: string; name: string; purity: string | null; color: string | null; current_price_per_gram: unknown; render_config?: unknown } }>;
        product_gemstones?: Array<{ gemstones: { id: string; type: string; carat: unknown; cut: string | null; color: string | null; clarity: string | null; certification_code: string | null; price: unknown; is_available: boolean | null; render_config?: unknown } }>;
      } | null;
    } | null;
  }) {
    const base = await this.mapOrder(order);
    return {
      ...base,
      engraving: order.engraving
        ? this.mapEngravingForOrder(order.id, order.engraving as Parameters<typeof this.mapEngravingForOrder>[1])
        : null,
    };
  }

  // === FE API Gaps — Transactions (B1 + B2) ===

  async listPayments(data: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
  }) {
    const where: Prisma.paymentsWhereInput = {};
    if (data.status) where.status = data.status;
    if (data.method) where.method = data.method;

    const [rows, total] = await Promise.all([
      this.prisma.payments.findMany({
        where,
        include: {
          orders: {
            include: {
              users_orders_user_idTousers: {
                select: { id: true, full_name: true, email: true },
              },
              guest_customers: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (data.page - 1) * data.limit,
        take: data.limit,
      }),
      this.prisma.payments.count({ where }),
    ]);

    return {
      data: rows.map((p) => {
        const order = p.orders;
        const user = order?.users_orders_user_idTousers;
        const guest = order?.guest_customers;
        const customer = user
          ? { id: user.id, name: user.full_name ?? '', email: user.email ?? '' }
          : guest
            ? {
                id: guest.id,
                name: guest.full_name ?? '',
                email: guest.email ?? '',
              }
            : null;
        return {
          id: p.id,
          transaction_id: `PAY-${p.payos_transaction_id ?? p.id}`,
          order_id: p.order_id ?? '',
          order_number: order?.order_code ?? '',
          customer,
          method: p.method ?? '',
          amount: Number(p.amount ?? 0),
          status: p.status ?? '',
          created_at: p.created_at?.toISOString() ?? '',
        };
      }),
      total,
      page: data.page,
      limit: data.limit,
      last_page: Math.ceil(total / data.limit),
    };
  }

  async getTransactionOverview() {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const aggregate = async (from: Date, to: Date) => {
      const payments = await this.prisma.payments.groupBy({
        by: ['status'],
        where: { created_at: { gte: from, lte: to } },
        _sum: { amount: true },
      });
      let gross = 0,
        net = 0,
        pending = 0,
        refunded = 0;
      for (const p of payments) {
        const amt = Number(p._sum.amount ?? 0);
        gross += amt;
        if (p.status === 'PAID' || p.status === 'SUCCESS') net += amt;
        else if (p.status === 'PENDING') pending += amt;
        else if (p.status === 'REFUNDED') refunded += amt;
      }
      return { gross, net, pending, refunded };
    };

    const [thisMonth, lastMonth] = await Promise.all([
      aggregate(startThisMonth, now),
      aggregate(startLastMonth, endLastMonth),
    ]);

    const calcChange = (cur: number, prev: number) =>
      prev === 0 ? 0 : Number((((cur - prev) / prev) * 100).toFixed(1));

    return {
      gross_revenue: thisMonth.gross,
      net_revenue: thisMonth.net,
      pending_cod: thisMonth.pending,
      refunded: thisMonth.refunded,
      gross_change: calcChange(thisMonth.gross, lastMonth.gross),
      net_change: calcChange(thisMonth.net, lastMonth.net),
      pending_change: calcChange(thisMonth.pending, lastMonth.pending),
      refunded_change: calcChange(thisMonth.refunded, lastMonth.refunded),
    };
  }

  // === FE API Gaps — Delivery Listing ===

  async listDeliveries(data: {
    page: number;
    limit: number;
    status?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    assigned_delivery_staff_id?: string;
  }) {
    const where: Prisma.shipmentsWhereInput = {};
    if (data.status) where.status = data.status;
    if (data.from_date || data.to_date) {
      where.created_at = {};
      if (data.from_date) where.created_at.gte = new Date(data.from_date);
      if (data.to_date) where.created_at.lte = new Date(data.to_date);
    }
    if (data.search) {
      where.OR = [
        { tracking_code: { contains: data.search } },
        { recipient_phone: { contains: data.search } },
        { orders: { order_code: { contains: data.search } } },
      ];
    }
    if (data.assigned_delivery_staff_id) {
      where.assigned_delivery_staff_id = data.assigned_delivery_staff_id;
    }

    const [rows, total] = await Promise.all([
      this.prisma.shipments.findMany({
        where,
        include: {
          orders: {
            select: {
              order_code: true,
              total_price: true,
              paid_amount: true,
              remaining_amount: true,
            },
          },
          users: { select: { id: true, full_name: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (data.page - 1) * data.limit,
        take: data.limit,
      }),
      this.prisma.shipments.count({ where }),
    ]);

    const staffIds = [
      ...new Set(
        rows
          .filter((r) => r.assigned_delivery_staff_id)
          .map((r) => r.assigned_delivery_staff_id!),
      ),
    ];
    const staffCounts = staffIds.length
      ? await this.prisma.shipments.groupBy({
          by: ['assigned_delivery_staff_id'],
          where: {
            assigned_delivery_staff_id: { in: staffIds },
            status: 'IN_TRANSIT',
          },
          _count: true,
        })
      : [];
    const staffCountMap = new Map(
      staffCounts.map((s) => [s.assigned_delivery_staff_id, s._count]),
    );

    const stats = await this.prisma.shipments.groupBy({
      by: ['status', 'delivery_method'],
      _count: true,
    });

    const computePaymentStatus = (o: (typeof rows)[0]['orders']) => {
      if (!o) return 'cod_pending';
      const remaining = Number(o.remaining_amount ?? 0);
      if (remaining <= 0) return 'paid';
      const paid = Number(o.paid_amount ?? 0);
      const total = Number(o.total_price ?? 0);
      return paid >= total ? 'final_pending' : 'cod_pending';
    };

    return {
      data: rows.map((s) => ({
        id: s.id,
        order_code: s.orders?.order_code ?? '',
        tracking_code: s.tracking_code ?? '',
        customer: {
          name: s.recipient_name ?? '',
          phone: s.recipient_phone ?? '',
          address: s.shipping_address_text ?? '',
        },
        payment_status: computePaymentStatus(s.orders),
        delivery_staff: s.users
          ? {
              id: s.users.id,
              name: s.users.full_name ?? '',
              avatar: '',
              status: s.users.status ?? '',
              current_deliveries: staffCountMap.get(s.users.id) ?? 0,
            }
          : null,
        status: s.status ?? '',
        proof_of_delivery: '',
        remaining_amount: Number(s.orders?.remaining_amount ?? 0),
        created_at: s.created_at?.toISOString() ?? '',
      })),
      total,
      page: data.page,
      limit: data.limit,
      last_page: Math.ceil(total / data.limit),
      stats: {
        ready_for_delivery:
          stats.find((s) => s.status === 'READY')?._count ?? 0,
        in_transit: stats.find((s) => s.status === 'IN_TRANSIT')?._count ?? 0,
        waiting_for_pickup:
          stats.find(
            (s) => s.delivery_method === 'PICKUP' && s.status !== 'COMPLETED',
          )?._count ?? 0,
      },
    };
  }

  async listPickups(data: {
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const where: Prisma.pickup_recordsWhereInput = {};
    if (data.status === 'waiting') where.picked_up_at = null;
    else if (data.status === 'completed') where.picked_up_at = { not: null };

    if (data.search) {
      where.orders = {
        OR: [
          { order_code: { contains: data.search } },
          {
            users_orders_user_idTousers: {
              full_name: { contains: data.search },
            },
          },
          { guest_customers: { full_name: { contains: data.search } } },
        ],
      };
    }

    const rows = await this.prisma.pickup_records.findMany({
      where,
      include: {
        orders: {
          include: {
            users_orders_user_idTousers: { select: { full_name: true } },
            guest_customers: { select: { full_name: true } },
          },
        },
        users: { select: { full_name: true } },
      },
      orderBy: { picked_up_at: { sort: 'desc', nulls: 'last' } },
      take: data.limit ?? 200,
    });

    const computePaymentStatus = (o: (typeof rows)[0]['orders']) => {
      const paid = Number(o?.paid_amount ?? 0);
      const total = Number(o?.total_price ?? 0);
      if (paid >= total && total > 0) return 'paid';
      if (paid > 0) return 'final_pending';
      return 'cod_pending';
    };

    return {
      data: rows.map((r) => ({
        id: r.id,
        order_code: r.orders?.order_code ?? '',
        customer_name:
          r.orders?.users_orders_user_idTousers?.full_name ??
          r.orders?.guest_customers?.full_name ??
          '',
        customer_phone: r.receiver_phone ?? '',
        payment_status: computePaymentStatus(r.orders),
        status: r.picked_up_at ? 'completed' : 'waiting',
        handover_staff_name: r.users?.full_name ?? '',
        handover_note: r.identity_note ?? '',
        proof_image: r.proof_image_url ?? '',
      })),
    };
  }

  async claimDelivery(orderId: string, staffId: string) {
    const shipment = await this.prisma.shipments.findFirst({
      where: { order_id: orderId },
      include: { orders: { select: { order_code: true, status: true } } },
    });
    if (!shipment) throw new NotFoundException('No shipment found for this order');
    if (shipment.status !== 'PENDING') throw new BadRequestException('Shipment is not PENDING');
    if (shipment.assigned_delivery_staff_id && shipment.assigned_delivery_staff_id !== staffId) {
      throw new BadRequestException('Shipment already assigned to another staff');
    }

    const activeCount = await this.prisma.shipments.count({
      where: { assigned_delivery_staff_id: staffId, status: 'SHIPPING' },
    });
    if (activeCount > 0) throw new BadRequestException('You already have an active delivery');

    await this.prisma.shipments.update({
      where: { id: shipment.id },
      data: { assigned_delivery_staff_id: staffId },
    });

    return {
      id: shipment.id,
      order_id: orderId,
      order_code: shipment.orders?.order_code ?? '',
      status: shipment.status ?? '',
      assigned_delivery_staff_id: staffId,
      customer: {
        name: shipment.recipient_name ?? '',
        phone: shipment.recipient_phone ?? '',
        address: shipment.shipping_address_text ?? '',
      },
    };
  }

  async getMyCurrentDelivery(staffId: string) {
    const shipment = await this.prisma.shipments.findFirst({
      where: { assigned_delivery_staff_id: staffId, status: { in: ['PENDING', 'SHIPPING'] } },
      orderBy: { updated_at: 'desc' },
      include: {
        orders: {
          select: { order_code: true, total_price: true, paid_amount: true, remaining_amount: true },
        },
      },
    });
    if (!shipment) return {};

    const remaining = Number(shipment.orders?.remaining_amount ?? 0);
    const paid = Number(shipment.orders?.paid_amount ?? 0);
    const total = Number(shipment.orders?.total_price ?? 0);
    let paymentStatus = 'cod_pending';
    if (remaining <= 0) paymentStatus = 'paid';
    else if (paid >= total) paymentStatus = 'final_pending';

    return {
      id: shipment.id,
      order_id: shipment.order_id,
      order_code: shipment.orders?.order_code ?? '',
      status: shipment.status ?? '',
      tracking_code: shipment.tracking_code ?? '',
      customer: {
        name: shipment.recipient_name ?? '',
        phone: shipment.recipient_phone ?? '',
        address: shipment.shipping_address_text ?? '',
      },
      payment_status: paymentStatus,
      remaining_amount: remaining,
      assigned_delivery_staff_id: shipment.assigned_delivery_staff_id ?? '',
      created_at: shipment.created_at?.toISOString() ?? '',
    };
  }

  async generateDeliveryPaymentLink(
    orderId: string,
    staffId: string,
    returnUrl: string,
    cancelUrl: string,
  ) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const allowedPhases = ['REMAINING', 'FULL'];
    const paymentPhase = order.guest_customer_id ? 'FULL' : 'REMAINING';
    if (!allowedPhases.includes(paymentPhase)) {
      throw new BadRequestException('Cannot generate payment link for this order');
    }

    let amount = 0;
    if (paymentPhase === 'FULL') {
      amount = Number(order.total_price ?? 0);
      if (amount <= 0) throw new BadRequestException('Invalid total price');
    } else {
      amount = Number(order.remaining_amount ?? 0);
      if (amount <= 0) throw new BadRequestException('No remaining amount to pay');
    }

    const PAYOS_LINK_TTL_MS = DEFAULT_PAYOS_LINK_TTL_MS;
    const existing = await this.prisma.payments.findFirst({
      where: { order_id: orderId, payment_phase: paymentPhase, status: 'PENDING' },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      const ageMs = existing.created_at ? Date.now() - existing.created_at.getTime() : Infinity;
      if (ageMs < PAYOS_LINK_TTL_MS && existing.qr_code && existing.payment_url) {
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
      if (existing.payos_transaction_id) {
        try { await this.payOS.cancelPaymentLink(existing.payos_transaction_id); } catch { }
      }
      await this.prisma.payments.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });
    }

    const payosOrderCode = Number(`${Date.now()}${Math.floor(Math.random() * 100)}`);
    const payosResult = await this.payOS.createPaymentLink({
      orderCode: payosOrderCode,
      amount,
      description: `TT ${order.order_code}`,
      returnUrl: returnUrl || 'https://bioring.vn/payment/success',
      cancelUrl: cancelUrl || 'https://bioring.vn/payment/cancel',
    });

    const payment = await this.prisma.payments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        payment_phase: paymentPhase,
        amount,
        method: 'BANK_TRANSFER',
        status: 'PENDING',
        payos_order_code: payosOrderCode,
        payment_url: payosResult.paymentUrl,
        qr_code: payosResult.qrCode ?? null,
        created_by_id: staffId,
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
      qrCode: payosResult.qrCode ?? '',
    };
  }
}
