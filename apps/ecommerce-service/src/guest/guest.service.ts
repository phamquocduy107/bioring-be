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
    email?: string;
    note?: string;
    staffId: string;
  }) {
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
    return { guest: this.mapGuest(guest) };
  }

  async createGuestOrder(data: {
    guestCustomerId: string;
    productId?: string;
    staffId: string;
  }) {
    const guest = await this.prisma.guest_customers.findUnique({
      where: { id: data.guestCustomerId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const engraving = (await this.prisma.engravings.create({
      data: {
        id: randomUUID(),
        user_id: data.staffId,
        product_id: data.productId,
        status: 'PENDING',
      },
    })) as unknown as EngravingRecord;

    const version = (await this.prisma.engraving_versions.create({
      data: {
        id: randomUUID(),
        engraving_id: engraving.id,
        version_number: 1,
        status: 'PENDING',
      },
    })) as unknown as VersionRecord;

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

    const subtotal = await this.calculateSubtotal(engraving);
    const serviceFee = Math.round(subtotal * 0.1);
    const totalPrice = subtotal + serviceFee;

    const order = (await this.prisma.orders.create({
      data: {
        id: randomUUID(),
        order_code: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        engraving_id: engraving.id,
        user_id: null,
        guest_customer_id: data.guestCustomerId,
        created_by_staff_id: data.staffId,
        design_source: 'WALK_IN',
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
            engraving_biometrics: true,
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
      const updated = (await this.prisma.orders.update({
        where: { id: orderId },
        data: { status: 'PENDING_REVIEW' },
      })) as unknown as OrderSummaryRecord;
      return { order: this.mapOrderSummary(updated), isResubmit: false };
    }

    if (order.status === 'REVISION_REQUIRED') {
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

    const version = await this.prisma.engraving_versions.findUnique({
      where: { id: engravingVersionId },
    });
    if (!version) throw new NotFoundException('Version not found');

    const updateData: Record<string, unknown> = {};
    if (data.selectedMaterialId !== undefined)
      updateData.selected_material_id = data.selectedMaterialId;
    if (data.selectedGemstoneId !== undefined)
      updateData.selected_gemstone_id = data.selectedGemstoneId;
    if (data.ringSize !== undefined) updateData.ring_size = data.ringSize;
    if (data.ringStyle !== undefined) updateData.ring_style = data.ringStyle;
    if (data.ringShape !== undefined) updateData.ring_shape = data.ringShape;
    if (data.customizationConfig !== undefined)
      updateData.customization_config = JSON.parse(data.customizationConfig);
    if (data.selectedBiometrics !== undefined)
      updateData.selected_biometrics = data.selectedBiometrics;

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

    const existing = await this.prisma.shipments.findFirst({
      where: { order_id: orderId },
    });
    if (existing) {
      throw new BadRequestException('Shipping info already set');
    }

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
      const version = await this.prisma.engraving_versions.findUnique({
        where: { id: target.engravingVersionId },
        include: {
          engraving: { include: { order: true } },
        },
      });
      if (!version) throw new NotFoundException('Version not found');
      const order = version.engraving.order;
      if (!order || order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this engraving');
      }
    }

    if (target.engravingId) {
      const engraving = await this.prisma.engravings.findUnique({
        where: { id: target.engravingId },
        include: { order: true },
      });
      if (!engraving) throw new NotFoundException('Engraving not found');
      if (!engraving.order || engraving.order.guest_customer_id !== guest.id) {
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
