import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { randomUUID, createHash, randomBytes } from 'node:crypto';

// === Internal record types ===
interface EngravingRecord {
  id: string;
  user_id: string | null;
  product_id: string | null;
  unique_product_id: string | null;
  approved_version_id: string | null;
  status: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  order?: { id: string; guest_customer_id?: string | null } | null;
  engraving_versions_engraving_versions_engraving_idToengravings?: EngravingVersionRecord[];
  engraving_biometrics?: EngravingBiometricRecord[];
  qr_memories?: QrMemoryRecord[];
}

interface EngravingVersionRecord {
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
  manager_id: string | null;
  manager_note: string | null;
  reviewed_at: Date | null;
  created_at: Date | null;
  materials?: MaterialRecord | null;
  gemstones?: GemstoneRecord | null;
}

interface EngravingBiometricRecord {
  id: string;
  engraving_id: string;
  biometric_type: string;
  required_channel: string;
  raw_file_url: string | null;
  processed_svg_url: string | null;
  extra_data: unknown;
  status: string | null;
}

interface QrMemoryRecord {
  id: string;
  engraving_id: string;
  qr_code: string | null;
  card_title: string | null;
  greeting_message: string | null;
  recipient_email: string | null;
  biometric_display_settings: unknown;
  access_pin_hash: string | null;
  is_locked: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
}

interface MaterialRecord {
  id: string;
  name: string;
  purity: string | null;
  color: string | null;
  current_price_per_gram: unknown;
}

interface GemstoneRecord {
  id: string;
  type: string;
  carat: unknown;
  cut: string | null;
  color: string | null;
  clarity: string | null;
  certification_code: string | null;
  price: unknown;
  is_available: boolean | null;
}

@Injectable()
export class EngravingService {
  constructor(private readonly prisma: PrismaService) {}

  async createEngraving(userId: string, productId?: string) {
    const engravingId = randomUUID();
    const versionId = randomUUID();

    const engraving = await this.prisma.engravings.create({
      data: {
        id: engravingId,
        user_id: userId,
        product_id: productId ?? null,
        unique_product_id: null,
        status: 'PENDING',
      },
    });

    const engravingVersion = await this.prisma.engraving_versions.create({
      data: {
        id: versionId,
        engraving_id: engravingId,
        version_number: 1,
        status: 'PENDING',
      },
    });

    const qrCode = randomBytes(6).toString('hex');
    const defaultPin = '123456';
    const accessPinHash = createHash('sha256').update(defaultPin).digest('hex');

    await this.prisma.qr_memories.create({
      data: {
        id: randomUUID(),
        engraving_id: engravingId,
        qr_code: qrCode,
        access_pin_hash: accessPinHash,
        is_locked: true,
      },
    });

    return {
      engraving: {
        id: engraving.id,
        orderId: '',
        userId: engraving.user_id ?? '',
        productId: engraving.product_id ?? '',
        uniqueProductId: engraving.unique_product_id ?? '',
        approvedVersionId: engraving.approved_version_id ?? '',
        status: engraving.status ?? '',
        versions: [],
        biometrics: [],
      },
      engravingVersion: {
        id: engravingVersion.id,
        engravingId: engravingVersion.engraving_id,
        versionNumber: engravingVersion.version_number,
        selectedMaterialId: engravingVersion.selected_material_id ?? '',
        selectedGemstoneId: engravingVersion.selected_gemstone_id ?? '',
        ringSize: engravingVersion.ring_size ?? '',
        ringStyle: engravingVersion.ring_style ?? '',
        ringShape: engravingVersion.ring_shape ?? '',
        customizationConfig: engravingVersion.customization_config
          ? JSON.stringify(engravingVersion.customization_config)
          : '',
        selectedBiometrics: engravingVersion.selected_biometrics ?? '',
        status: engravingVersion.status ?? '',
        managerId: engravingVersion.manager_id ?? '',
        managerNote: engravingVersion.manager_note ?? '',
        reviewedAt: engravingVersion.reviewed_at?.toISOString() ?? '',
        createdAt: engravingVersion.created_at?.toISOString() ?? '',
        selectedMaterial: null,
        selectedGemstone: null,
      },
      qrCode,
    };
  }

  async updateVersionConfig(
    versionId: string,
    data: {
      customizationConfig?: string;
      selectedMaterialId?: string;
      selectedGemstoneId?: string;
      ringSize?: string;
      ringStyle?: string;
      ringShape?: string;
      previewImageUrl?: string;
      model3dUrl?: string;
      productionFileUrl?: string;
      selectedBiometrics?: string;
    },
  ) {
    const version = await this.prisma.engraving_versions.findUnique({
      where: { id: versionId },
      include: {
        engravings_engraving_versions_engraving_idToengravings: {
          include: { order: true },
        },
      },
    });
    if (!version) throw new NotFoundException('Engraving version not found');

    const engraving =
      version.engravings_engraving_versions_engraving_idToengravings;
    const order = engraving?.order;

    // Ràng buộc theo order status
    if (order) {
      // Có order → block đổi package (selectedBiometrics) vĩnh viễn
      if (data.selectedBiometrics !== undefined) {
        throw new BadRequestException(
          'Cannot change package after order creation',
        );
      }

      const orderStatus = order.status ?? '';
      // Cho edit nếu chưa submit hoặc đang REVISION_REQUIRED
      const editableStatuses = [
        'AWAITING_SUBMIT',
        'AWAITING_DEPOSIT_1',
        'REVISION_REQUIRED',
      ];
      if (!editableStatuses.includes(orderStatus)) {
        throw new BadRequestException(
          'Cannot edit after order has been submitted',
        );
      }
    }

    // Chưa có order: kiểm tra version status
    if (!order) {
      const versionStatus = version.status ?? '';
      if (!['PENDING', 'REVISION_REQUIRED'].includes(versionStatus)) {
        throw new BadRequestException(
          `Cannot update version in status "${versionStatus}"`,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.selectedMaterialId !== undefined)
      updateData.selected_material_id = data.selectedMaterialId;
    if (data.selectedGemstoneId !== undefined)
      updateData.selected_gemstone_id = data.selectedGemstoneId;
    if (data.ringSize !== undefined) updateData.ring_size = data.ringSize;
    if (data.ringStyle !== undefined) updateData.ring_style = data.ringStyle;
    if (data.ringShape !== undefined) updateData.ring_shape = data.ringShape;
    if (data.previewImageUrl !== undefined)
      updateData.preview_image_url = data.previewImageUrl;
    if (data.model3dUrl !== undefined)
      updateData.model_3d_url = data.model3dUrl;
    if (data.productionFileUrl !== undefined)
      updateData.production_file_url = data.productionFileUrl;
    if (data.customizationConfig !== undefined) {
      try {
        updateData.customization_config = JSON.parse(
          data.customizationConfig,
        ) as Prisma.InputJsonValue;
      } catch {
        throw new BadRequestException('customizationConfig must be valid JSON');
      }
    }
    if (data.selectedBiometrics !== undefined) {
      // Parse array string like ["SW","FP"] → "SW,FP"
      try {
        const parsed = JSON.parse(data.selectedBiometrics) as string[];
        updateData.selected_biometrics = parsed.join(',');
      } catch {
        throw new BadRequestException(
          'selectedBiometrics must be a valid JSON array of PackageType strings',
        );
      }
    }

    const updated = await this.prisma.engraving_versions.update({
      where: { id: versionId },
      data: updateData,
    });

    return {
      version: {
        id: updated.id,
        engravingId: updated.engraving_id,
        versionNumber: updated.version_number,
        selectedMaterialId: updated.selected_material_id ?? '',
        selectedGemstoneId: updated.selected_gemstone_id ?? '',
        ringSize: updated.ring_size ?? '',
        ringStyle: updated.ring_style ?? '',
        ringShape: updated.ring_shape ?? '',
        customizationConfig: updated.customization_config
          ? JSON.stringify(updated.customization_config)
          : '',
        selectedBiometrics: updated.selected_biometrics ?? '',
        status: updated.status ?? '',
        managerId: updated.manager_id ?? '',
        managerNote: updated.manager_note ?? '',
        reviewedAt: updated.reviewed_at?.toISOString() ?? '',
        createdAt: updated.created_at?.toISOString() ?? '',
        selectedMaterial: null,
        selectedGemstone: null,
      },
      orderId: order?.id ?? '',
      orderStatus: order?.status ?? '',
    };
  }

  async getMyEngravings(
    userId: string,
    page: number,
    limit: number,
    status?: string,
    orderId?: string,
  ) {
    const where: Record<string, unknown> = { user_id: userId };
    if (status) where.status = status;
    if (orderId) where.order_id = orderId;

    const [engravings, total] = await Promise.all([
      this.prisma.engravings.findMany({
        where,
        include: {
          engraving_versions_engraving_versions_engraving_idToengravings: {
            include: { materials: true, gemstones: true },
            orderBy: { version_number: 'desc' },
          },
          engraving_biometrics: true,
          qr_memories: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.engravings.count({ where }),
    ]);

    return {
      engravings: (engravings as unknown as EngravingRecord[]).map((e) =>
        this.mapEngraving(e),
      ),
      total,
      page,
      limit,
    };
  }

  async getEngraving(id: string) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id },
      include: {
        engraving_versions_engraving_versions_engraving_idToengravings: {
          include: { materials: true, gemstones: true },
          orderBy: { version_number: 'desc' },
        },
        engraving_biometrics: true,
        qr_memories: true,
      },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    return {
      engraving: this.mapEngraving(engraving as unknown as EngravingRecord),
    };
  }

  private mapEngraving(engraving: EngravingRecord) {
    const latest =
      engraving
        .engraving_versions_engraving_versions_engraving_idToengravings?.[0] ??
      ({} as EngravingVersionRecord);
    const qrMem = engraving.qr_memories?.[0] ?? null;
    return {
      id: engraving.id,
      orderId: engraving.order?.id ?? '',
      userId: engraving.user_id ?? '',
      productId: engraving.product_id ?? '',
      uniqueProductId: engraving.unique_product_id ?? '',
      approvedVersionId: engraving.approved_version_id ?? '',
      status: engraving.status ?? '',
      versions:
        engraving.engraving_versions_engraving_versions_engraving_idToengravings?.map(
          (v: EngravingVersionRecord) => ({
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
            selectedMaterial: v.materials
              ? {
                  id: v.materials.id,
                  name: v.materials.name,
                  purity: v.materials.purity ?? '',
                  color: v.materials.color ?? '',
                  currentPricePerGram: Number(
                    v.materials.current_price_per_gram ?? 0,
                  ),
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
                }
              : null,
          }),
        ) ?? [],
      biometrics:
        engraving.engraving_biometrics?.map((b: EngravingBiometricRecord) => ({
          id: b.id,
          engravingId: b.engraving_id,
          biometricType: b.biometric_type,
          requiredChannel: b.required_channel,
          rawFileUrl: b.raw_file_url ?? '',
          processedSvgUrl: b.processed_svg_url ?? '',
          extraData: b.extra_data ?? '',
          status: b.status ?? '',
        })) ?? [],
      qrMemory: qrMem
        ? {
            id: qrMem.id,
            engravingId: qrMem.engraving_id,
            qrCode: qrMem.qr_code ?? '',
            cardTitle: qrMem.card_title ?? '',
            greetingMessage: qrMem.greeting_message ?? '',
            recipientEmail: qrMem.recipient_email ?? '',
            biometricDisplaySettings: qrMem.biometric_display_settings ?? '',
            accessPinHash: qrMem.access_pin_hash ?? '',
            isLocked: qrMem.is_locked ?? true,
            createdAt: qrMem.created_at?.toISOString() ?? '',
            updatedAt: qrMem.updated_at?.toISOString() ?? '',
          }
        : null,
      currentVersion: latest.id
        ? {
            id: latest.id,
            engravingId: latest.engraving_id,
            versionNumber: latest.version_number,
            selectedMaterialId: latest.selected_material_id ?? '',
            selectedGemstoneId: latest.selected_gemstone_id ?? '',
            ringSize: latest.ring_size ?? '',
            ringStyle: latest.ring_style ?? '',
            ringShape: latest.ring_shape ?? '',
            customizationConfig: latest.customization_config
              ? JSON.stringify(latest.customization_config)
              : '',
            selectedBiometrics: latest.selected_biometrics ?? '',
            status: latest.status ?? '',
            managerId: latest.manager_id ?? '',
            managerNote: latest.manager_note ?? '',
            reviewedAt: latest.reviewed_at?.toISOString() ?? '',
            createdAt: latest.created_at?.toISOString() ?? '',
            selectedMaterial: latest.materials
              ? {
                  id: latest.materials.id,
                  name: latest.materials.name,
                  purity: latest.materials.purity ?? '',
                  color: latest.materials.color ?? '',
                  currentPricePerGram: Number(
                    latest.materials.current_price_per_gram ?? 0,
                  ),
                }
              : null,
            selectedGemstone: latest.gemstones
              ? {
                  id: latest.gemstones.id,
                  type: latest.gemstones.type,
                  carat: Number(latest.gemstones.carat ?? 0),
                  cut: latest.gemstones.cut ?? '',
                  color: latest.gemstones.color ?? '',
                  clarity: latest.gemstones.clarity ?? '',
                  certificationCode: latest.gemstones.certification_code ?? '',
                  price: Number(latest.gemstones.price ?? 0),
                  isAvailable: latest.gemstones.is_available ?? false,
                }
              : null,
          }
        : null,
    };
  }

  async cancelEngraving(id: string, userId: string) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id },
      select: {
        id: true,
        user_id: true,
        status: true,
        order: { select: { id: true } },
      },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (engraving.user_id !== userId) throw new ForbiddenException('Not your engraving');
    if (engraving.order) throw new BadRequestException('Cannot cancel — already has order');
    if (engraving.status === 'CANCELLED') throw new BadRequestException('Already cancelled');

    await this.prisma.engravings.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  }
}
