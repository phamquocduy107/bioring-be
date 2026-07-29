import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { OrderService } from '../order/order.service';
import { MemoryCardService } from '../memory-card/memory-card.service';
import { randomUUID, createHash, randomBytes } from 'node:crypto';

// === Internal record interfaces (snake_case from Prisma) ===

interface GuestRecord {
  id: string;
  guest_code: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: Date | null;
}

interface EngravingRecord {
  id: string;
  user_id: string | null;
  product_id: string | null;
  status: string | null;
}

interface EngravingWithProductId {
  product_id?: string | null;
}

interface OrderSummaryRecord {
  id: string;
  order_code: string;
  user_id: string | null;
  guest_customer_id: string | null;
  design_source: string | null;
  status: string | null;
  total_price: unknown;
  paid_amount: unknown;
  remaining_amount: unknown;
  created_at: Date | null;
}

interface VersionRecord {
  id: string;
  engraving_id: string;
  version_number: number;
  selected_material_id: string | null;
  selected_gemstone_id: string | null;
  ring_size: string | null;
  ring_style: string | null;
  ring_shape: string | null;
  customization_config: unknown;
  selected_biometrics: string | null;
  status: string | null;
  created_at: Date | null;
}

// === Service ===

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly memoryCardService: MemoryCardService,
  ) {}

  // =========== STAFF ===========

  async createGuestSession(data: {
    fullName: string;
    phone: string;
    email: string;
    note?: string;
    staffId: string;
  }) {
    // Check if email belongs to a registered member
    const member = await this.prisma.users.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (member) {
      return {
        guest: {
          id: '',
          guestCode: '',
          fullName: '',
          phone: '',
          email: data.email,
          note: '',
          createdAt: '',
        },
        isMember: true,
        isExistingGuest: false,
        message: 'Email already registered as member',
      };
    }

    // Check if email already used by a previous guest
    const existingGuest = await this.prisma.guest_customers.findFirst({
      where: { email: data.email },
    });
    if (existingGuest) {
      return {
        guest: this.mapGuest(existingGuest),
        isMember: false,
        isExistingGuest: true,
        message: 'Guest already exists. Create new?',
      };
    }

    const guestCode = await this.generateGuestCode();
    const guest = (await this.prisma.guest_customers.create({
      data: {
        id: randomUUID(),
        guest_code: guestCode,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        note: data.note,
      },
    })) as unknown as GuestRecord;
    return {
      guest: this.mapGuest(guest),
      isMember: false,
      isExistingGuest: false,
      message: '',
    };
  }

  async createGuestEngraving(data: {
    guestCode: string;
    productId?: string;
    staffId?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    ringSize?: string;
    selectedBiometrics?: string;
  }) {
    const guest = await this.prisma.guest_customers.findUnique({
      where: { guest_code: data.guestCode },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const engraving = (await this.prisma.engravings.create({
      data: {
        id: randomUUID(),
        user_id: data.staffId || null,
        guest_customer_id: guest.id,
        product_id: data.productId,
        status: 'PENDING',
      },
    })) as unknown as EngravingRecord;

    const version = (await this.prisma.engraving_versions.create({
      data: {
        id: randomUUID(),
        engraving_id: engraving.id,
        version_number: 1,
        ring_shape: 'ROUND',
        status: 'PENDING',
        ...(data.selectedMaterialId ? { selected_material_id: data.selectedMaterialId } : {}),
        ...(data.selectedGemstoneId ? { selected_gemstone_id: data.selectedGemstoneId } : {}),
        ...(data.ringSize ? { ring_size: data.ringSize } : {}),
        ...(data.selectedBiometrics ? { selected_biometrics: data.selectedBiometrics } : {}),
      },
    })) as unknown as VersionRecord;

    // ponytail: create qr_memories at engraving time so guest can edit memcard immediately
    const qrCode = randomBytes(6).toString('hex');
    const accessPinHash = createHash('sha256').update('123456').digest('hex');
    await this.prisma.qr_memories.create({
      data: {
        id: randomUUID(),
        engraving_id: engraving.id,
        qr_code: qrCode,
        access_pin_hash: accessPinHash,
        is_locked: true,
      },
    });

    return {
      engraving: this.mapEngraving(engraving),
      version: this.mapVersion(version),
    };
  }

  async createGuestOrder(data: {
    guestCode: string;
    engravingId: string;
    staffId?: string;
  }) {
    const guest = await this.prisma.guest_customers.findUnique({
      where: { guest_code: data.guestCode },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const engraving = (await this.prisma.engravings.findUnique({
      where: { id: data.engravingId },
      include: {
        engraving_versions_engraving_versions_engraving_idToengravings: {
          orderBy: { version_number: 'desc' },
          take: 1,
        },
      },
    })) as unknown as EngravingRecord & {
      engraving_versions_engraving_versions_engraving_idToengravings: VersionRecord[];
    };
    if (!engraving) throw new NotFoundException('Engraving not found');

    const version =
      engraving.engraving_versions_engraving_versions_engraving_idToengravings[0];
    if (!version) throw new NotFoundException('Engraving version not found');

    // ponytail: biometric validation moved to submit step (guestSubmitOrder), removed here
    // so guest can create order at package selection before staff assigns biometrics
    const selected =
      version.selected_biometrics?.split(',').filter(Boolean) ?? [];

    let packageType: string | undefined;
    let captureRoute: string | undefined;
    if (selected.length > 0) {
      packageType = selected.join('_');
      captureRoute = packageType === 'SW' ? 'ONLINE' : 'OFFLINE';
    }

    // ponytail: qr_memories already created at engraving time, fallback removed
    const subtotal = await this.calculateSubtotal(engraving);
    const serviceFee = Math.round(subtotal * 0.1);
    const totalPrice = subtotal + serviceFee;

    const order = (await this.prisma.orders.create({
      data: {
        id: randomUUID(),
        order_code: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        engraving_id: engraving.id,
        user_id: null,
        guest_customer_id: guest.id,
        created_by_staff_id: data.staffId || null,
        design_source: 'WALK_IN',
        package_type: packageType,
        capture_route: captureRoute,
        status: 'AWAITING_SUBMIT',
        subtotal,
        service_fee: serviceFee,
        total_price: totalPrice,
        paid_amount: 0,
        remaining_amount: totalPrice,
      },
    })) as unknown as OrderSummaryRecord;

    return {
      order: this.mapOrderSummary(order),
      engraving: this.mapEngraving(engraving),
      version: this.mapVersion(version),
    };
  }

  // =========== GUEST TABLET ===========

  async getGuestSession(guestCode: string) {
    const guest = (await this.prisma.guest_customers.findUnique({
      where: { guest_code: guestCode },
    })) as unknown as GuestRecord | null;
    if (!guest) throw new NotFoundException('Guest not found');

    const order = await this.prisma.orders.findFirst({
      where: {
        guest_customer_id: guest.id,
        status: { in: ['AWAITING_SUBMIT', 'REVISION_REQUIRED'] },
      },
      include: {
        engraving: {
          include: {
            engraving_versions_engraving_versions_engraving_idToengravings: {
              orderBy: { version_number: 'desc' },
            },
            engraving_biometrics: {
              include: { biometric_asset: true },
            },
            qr_memories: true,
          },
        },
        payments: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const orderResult = order
      ? await this.orderService.getOrder(order.id).then((r) => r.order)
      : null;

    return {
      guest: this.mapGuest(guest),
      order: orderResult,
    };
  }

  async guestSubmitOrder(orderId: string, guestCode: string) {
    await this.validateGuestOwnership(guestCode, { orderId });

    const order = (await this.prisma.orders.findUnique({
      where: { id: orderId },
    })) as unknown as OrderSummaryRecord | null;
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === 'AWAITING_SUBMIT') {
      // Validate: tất cả biometric trong package đã được upload chưa
      await this.validateBiometricsReady(orderId);

      const updated = (await this.prisma.orders.update({
        where: { id: orderId },
        data: { status: 'PENDING_REVIEW' },
      })) as unknown as OrderSummaryRecord;
      return { order: this.mapOrderSummary(updated), isResubmit: false };
    }

    if (order.status === 'REVISION_REQUIRED') {
      // Validate biometrics cho resubmit
      await this.validateBiometricsReady(orderId);
      await this.prisma.$transaction([
        this.prisma.engravings.updateMany({
          where: { order: { id: orderId } },
          data: { status: 'PENDING' },
        }),
        this.prisma.orders.update({
          where: { id: orderId },
          data: { status: 'PENDING_REVIEW' },
        }),
      ]);

      const updated = (await this.prisma.orders.findUnique({
        where: { id: orderId },
      })) as unknown as OrderSummaryRecord;
      return { order: this.mapOrderSummary(updated), isResubmit: true };
    }

    throw new BadRequestException(
      'Order must be AWAITING_SUBMIT or REVISION_REQUIRED to submit',
    );
  }

  async guestUpdateEngravingConfig(
    engravingVersionId: string,
    guestCode: string,
    data: {
      selectedMaterialId?: string;
      selectedGemstoneId?: string;
      ringSize?: string;
      ringStyle?: string;
      ringShape?: string;
      customizationConfig?: string;
      selectedBiometrics?: string;
    },
  ) {
    await this.validateGuestOwnership(guestCode, { engravingVersionId });

    const versionRecord = await this.prisma.engraving_versions.findUnique({
      where: { id: engravingVersionId },
      include: {
        engravings_engraving_versions_engraving_idToengravings: {
          include: { order: true },
        },
      },
    });
    if (!versionRecord) throw new NotFoundException('Version not found');

    // ponytail: lock core fields after order exists; only customizationConfig is editable
    const hasOrder = !!versionRecord
      .engravings_engraving_versions_engraving_idToengravings.order;

    const updateData: Record<string, unknown> = {};
    if (!hasOrder) {
      if (data.selectedMaterialId !== undefined)
        updateData.selected_material_id = data.selectedMaterialId;
      if (data.selectedGemstoneId !== undefined)
        updateData.selected_gemstone_id = data.selectedGemstoneId;
      if (data.ringSize !== undefined) updateData.ring_size = data.ringSize;
      if (data.ringStyle !== undefined) updateData.ring_style = data.ringStyle;
      if (data.ringShape !== undefined) updateData.ring_shape = data.ringShape;
      if (data.selectedBiometrics !== undefined) {
        const raw = data.selectedBiometrics;
        if (raw.startsWith('[')) {
          try {
            updateData.selected_biometrics = (JSON.parse(raw) as string[]).join(
              ',',
            );
          } catch {
            updateData.selected_biometrics = raw;
          }
        } else {
          updateData.selected_biometrics = raw;
        }
      }
    }
    // ponytail: customizationConfig always editable (before and after order)
    if (data.customizationConfig !== undefined)
      updateData.customization_config = JSON.parse(data.customizationConfig);

    const updated = (await this.prisma.engraving_versions.update({
      where: { id: engravingVersionId },
      data: updateData,
    })) as unknown as VersionRecord;

    return { version: this.mapVersion(updated) };
  }

  async guestUpdateQrMemory(
    engravingId: string,
    guestCode: string,
    data: {
      cardTitle?: string;
      greetingMessage?: string;
      recipientEmail?: string;
      cardThemeId?: string;
      customImages?: string;
      biometricDisplaySettings?: string;
    },
  ) {
    await this.validateGuestOwnership(guestCode, { engravingId });
    return this.memoryCardService.updateQrMemory(engravingId, data);
  }

  async guestGetOrder(orderId: string, guestCode: string) {
    await this.validateGuestOwnership(guestCode, { orderId });
    return this.orderService.getOrder(orderId);
  }

  async guestInitiatePayment(
    orderId: string,
    guestCode: string,
    data: { returnUrl?: string; cancelUrl?: string },
  ) {
    await this.validateGuestOwnership(guestCode, { orderId });
    return this.orderService.initiatePayment(
      orderId,
      'FULL',
      data.returnUrl ?? '',
      data.cancelUrl ?? '',
      '',
    );
  }

  async guestSetShippingInfo(
    orderId: string,
    guestCode: string,
    data: {
      deliveryMethod: string;
      recipientName: string;
      recipientPhone: string;
      addressId?: string;
      shippingAddressText?: string;
    },
  ) {
    await this.validateGuestOwnership(guestCode, { orderId });

    if (!['PICKUP', 'DELIVERY'].includes(data.deliveryMethod)) {
      throw new BadRequestException(
        'deliveryMethod must be PICKUP or DELIVERY',
      );
    }

    // ponytail: delivery can only be set after manager approves (AWAITING_DEPOSIT)
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order || order.status !== 'AWAITING_DEPOSIT') {
      throw new BadRequestException(
        'Delivery can only be set when order is AWAITING_DEPOSIT (manager approved)',
      );
    }

    const existing = await this.prisma.shipments.findFirst({
      where: { order_id: orderId },
    });
    if (existing) {
      throw new BadRequestException('Shipping info already set');
    }

    // ponytail: create user_address with user_id=null is not possible (schema requires user_id FK).
    // Guest address is stored as text in shipment.shipping_address_text.
    const shipment = await this.prisma.shipments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        delivery_method: data.deliveryMethod,
        status: 'PENDING',
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone,
        address_id: data.addressId ?? null,
        shipping_address_text: data.shippingAddressText ?? null,
      },
    });

    return {
      id: shipment.id,
      orderId: shipment.order_id ?? '',
      deliveryMethod: shipment.delivery_method ?? '',
      status: shipment.status ?? '',
      recipientName: shipment.recipient_name ?? '',
      recipientPhone: shipment.recipient_phone ?? '',
      shippingAddressText: shipment.shipping_address_text ?? '',
    };
  }

  // =========== HELPERS ===========

  private async validateBiometricsReady(orderId: string) {
    const orderWithEngraving = await this.prisma.orders.findUnique({
      where: { id: orderId },
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

    const engraving = orderWithEngraving?.engraving;
    if (!engraving) return;

    const version =
      engraving
        .engraving_versions_engraving_versions_engraving_idToengravings[0];
    const selected =
      version?.selected_biometrics?.split(',').filter(Boolean) ?? [];
    if (selected.length === 0) return;

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

  async validateGuestOwnership(
    guestCode: string,
    target: {
      engravingVersionId?: string;
      engravingId?: string;
      orderId?: string;
    },
  ) {
    const guest = (await this.prisma.guest_customers.findUnique({
      where: { guest_code: guestCode },
    })) as unknown as GuestRecord | null;
    if (!guest) throw new NotFoundException('Invalid guest code');

    if (target.engravingVersionId) {
      const versionRecord = (await this.prisma.engraving_versions.findUnique({
        where: { id: target.engravingVersionId },
      })) as unknown as { engraving_id: string } | null;
      if (!versionRecord) throw new NotFoundException('Version not found');

      const engravingWithOrder = (await this.prisma.engravings.findUnique({
        where: { id: versionRecord.engraving_id },
        include: { order: true },
      })) as unknown as {
        order?: { guest_customer_id: string | null } | null;
      } | null;

      if (!engravingWithOrder)
        throw new NotFoundException('Engraving not found');
      const order = engravingWithOrder.order;
      // ponytail: before order creation (pre-config), allow; after order, match guest
      if (order && order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this engraving');
      }
    }

    if (target.engravingId) {
      const engraving = await this.prisma.engravings.findUnique({
        where: { id: target.engravingId },
        include: { order: true },
      });
      if (!engraving) throw new NotFoundException('Engraving not found');
      const engOrder = (
        engraving as unknown as {
          order?: { guest_customer_id: string | null } | null;
        }
      ).order;
      if (!engOrder || engOrder.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this engraving');
      }
    }

    if (target.orderId) {
      const order = await this.prisma.orders.findUnique({
        where: { id: target.orderId },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this order');
      }
    }

    return { guestId: guest.id, guest };
  }

  private async generateGuestCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let exists = true;
    do {
      code = 'GUE-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const found = await this.prisma.guest_customers.findUnique({
        where: { guest_code: code },
      });
      exists = !!found;
    } while (exists);
    return code;
  }

  private async calculateSubtotal(
    engraving: EngravingWithProductId,
  ): Promise<number> {
    if (!engraving.product_id) return 0;
    const product = await this.prisma.products.findUnique({
      where: { id: engraving.product_id },
    });
    return Number(product?.base_price ?? 0);
  }

  private mapGuest(guest: GuestRecord) {
    return {
      id: guest.id,
      guestCode: guest.guest_code ?? '',
      fullName: guest.full_name ?? '',
      phone: guest.phone ?? '',
      email: guest.email ?? '',
      note: guest.note ?? '',
      createdAt: guest.created_at?.toISOString() ?? '',
    };
  }

  private mapOrderSummary(order: OrderSummaryRecord) {
    return {
      id: order.id,
      orderCode: order.order_code,
      userId: order.user_id ?? '',
      guestCustomerId: order.guest_customer_id ?? '',
      designSource: order.design_source ?? '',
      status: order.status ?? '',
      totalPrice: Number(order.total_price ?? 0),
      paidAmount: Number(order.paid_amount ?? 0),
      remainingAmount: Number(order.remaining_amount ?? 0),
      createdAt: order.created_at?.toISOString() ?? '',
    };
  }

  async listGuestCustomers(params: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const where: any = {};
    if (params.search) {
      where.OR = [
        { full_name: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.guest_customers.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { created_at: 'desc' },
        include: {
          orders: {
            include: {
              engraving: {
                select: {
                  qr_memories: {
                    select: { is_locked: true, activated_at: true },
                  },
                  engraving_biometrics: { select: { biometric_type: true } },
                },
              },
              warranties: { select: { status: true, expiry_date: true } },
            },
          },
          warranty_claims: {
            include: {
              service_tickets: {
                select: {
                  id: true,
                  ticket_code: true,
                  service_type: true,
                  status: true,
                  created_at: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.guest_customers.count({ where }),
    ]);

    return {
      data: rows.map((g) => {
        const totalSpent = g.orders.reduce(
          (s, o) => s + Number(o.total_price ?? 0),
          0,
        );
        const sorted = [...g.orders].sort(
          (a, b) =>
            (b.created_at?.getTime() ?? 0) - (a.created_at?.getTime() ?? 0),
        );
        const latestOrder = sorted[0];
        const warrantyOrder = g.orders.find((o) => o.warranties.length > 0);
        const warranty = warrantyOrder?.warranties[0];
        const biometricTypes = g.orders.flatMap(
          (o) => o.engraving?.engraving_biometrics ?? [],
        );

        return {
          id: g.id,
          name: g.full_name ?? '',
          email: g.email ?? '',
          phone: g.phone ?? '',
          status: 'active',
          total_orders: g.orders.length,
          total_spent: totalSpent,
          last_order_date: latestOrder?.created_at?.toISOString() ?? '',
          join_date: g.created_at?.toISOString() ?? '',
          digital_assets: this.computeDigitalAssets(biometricTypes),
          qr_memory_status: latestOrder?.engraving?.qr_memories ? 'active' : '',
          service_tickets: g.warranty_claims.flatMap((wc) =>
            wc.service_tickets.map((st) => ({
              id: st.id,
              ticket_code: st.ticket_code ?? '',
              service_type: st.service_type ?? '',
              status: st.status ?? '',
              created_at: st.created_at?.toISOString() ?? '',
            })),
          ),
          warranty: warranty
            ? {
                is_active: warranty.status === 'ACTIVE',
                expiry_date: warranty.expiry_date?.toISOString() ?? '',
                used_free_count: 0,
              }
            : { is_active: false, expiry_date: '', used_free_count: 0 },
        };
      }),
      total,
      page: params.page,
      limit: params.limit,
      last_page: Math.ceil(total / params.limit),
    };
  }

  private computeDigitalAssets(biometrics: Array<{ biometric_type: string }>) {
    const types = new Set(biometrics.map((b) => b.biometric_type));
    return {
      has_voice: types.has('SW'),
      has_fingerprint: types.has('FP'),
      has_heartbeat: types.has('HB'),
    };
  }

  private mapEngraving(engraving: EngravingRecord) {
    return {
      id: engraving.id,
      userId: engraving.user_id ?? '',
      productId: engraving.product_id ?? '',
      status: engraving.status ?? '',
    };
  }

  private mapVersion(version: VersionRecord) {
    return {
      id: version.id,
      engravingId: version.engraving_id,
      versionNumber: version.version_number,
      selectedMaterialId: version.selected_material_id ?? '',
      selectedGemstoneId: version.selected_gemstone_id ?? '',
      ringSize: version.ring_size ?? '',
      ringStyle: version.ring_style ?? '',
      ringShape: version.ring_shape ?? '',
      customizationConfig:
        typeof version.customization_config === 'string'
          ? version.customization_config
          : JSON.stringify(version.customization_config),
      selectedBiometrics: version.selected_biometrics ?? '',
      status: version.status ?? '',
      createdAt: version.created_at?.toISOString() ?? '',
    };
  }
}
