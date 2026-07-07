import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { randomUUID, createHash, randomBytes } from 'node:crypto';

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
      engravings: engravings.map((e) => this.mapEngraving(e)),
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
    return { engraving: this.mapEngraving(engraving) };
  }

  private mapEngraving(engraving: any) {
    const latest =
      engraving
        .engraving_versions_engraving_versions_engraving_idToengravings?.[0] ??
      ({} as any);
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
          (v: any) => ({
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
        engraving.engraving_biometrics?.map((b: any) => ({
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
}
