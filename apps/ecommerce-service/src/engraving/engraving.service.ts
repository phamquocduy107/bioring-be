import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { Observable, lastValueFrom } from 'rxjs';

interface BiometricGrpcService {
  processAudio(data: {
    audioUrl: string;
    engravingVersionId: string;
  }): Observable<{ waveformUrl: string; durationMs: number }>;
}

@Injectable()
export class EngravingService implements OnModuleInit {
  private biometricClient?: BiometricGrpcService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject('BIOMETRIC_SERVICE')
    private readonly biometricGrpc?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.biometricClient =
      this.biometricGrpc?.getService<BiometricGrpcService>(
        'BiometricService',
      );
  }

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
        orderId: engraving.order_id ?? '',
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
    },
    audioUrl?: string,
  ) {
    const version = await this.prisma.engraving_versions.findUnique({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException('Engraving version not found');

    const allowedStatuses = ['PENDING', 'REVISION_REQUIRED'];
    if (!allowedStatuses.includes(version.status ?? '')) {
      throw new BadRequestException(
        `Cannot update version in status "${version.status}"`,
      );
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
        throw new BadRequestException(
          'customizationConfig must be valid JSON',
        );
      }
    }

    const updated = await this.prisma.engraving_versions.update({
      where: { id: versionId },
      data: updateData,
    });

    if (
      audioUrl &&
      typeof audioUrl === 'string' &&
      audioUrl.startsWith('http')
    ) {
      this.triggerAudioProcessing(audioUrl, versionId).catch((err) => {
        console.error(`[AudioProcessing] Failed for version ${versionId}:`, err);
      });
    }

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
        status: updated.status ?? '',
        managerId: updated.manager_id ?? '',
        managerNote: updated.manager_note ?? '',
        reviewedAt: updated.reviewed_at?.toISOString() ?? '',
        createdAt: updated.created_at?.toISOString() ?? '',
        selectedMaterial: null,
        selectedGemstone: null,
      },
      orderId: '',
      orderStatus: '',
    };
  }

  async resubmitVersion(versionId: string) {
    const version = await this.prisma.engraving_versions.findUnique({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException('Engraving version not found');

    if (version.status !== 'REVISION_REQUIRED') {
      throw new BadRequestException(
        `Cannot resubmit version in status "${version.status}"`,
      );
    }

    const updated = await this.prisma.engraving_versions.update({
      where: { id: versionId },
      data: { status: 'PENDING' },
    });

    // Sync engraving.status
    await this.prisma.engravings.update({
      where: { id: version.engraving_id },
      data: { status: 'PENDING' },
    });

    const engraving = await this.prisma.engravings.findUnique({
      where: { id: version.engraving_id },
    });

    let orderId = '';
    let orderStatus = '';
    if (engraving?.order_id) {
      // Check if all engravings in order are PENDING before setting order to PENDING_REVIEW
      const pendingEngravings = await this.prisma.engravings.count({
        where: { order_id: engraving.order_id, status: 'PENDING' },
      });
      const totalEngravings = await this.prisma.engravings.count({
        where: { order_id: engraving.order_id },
      });

      if (pendingEngravings === totalEngravings) {
        await this.prisma.orders.update({
          where: { id: engraving.order_id },
          data: { status: 'PENDING_REVIEW' },
        });
        orderStatus = 'PENDING_REVIEW';
      }
      orderId = engraving.order_id;
    }

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
        status: updated.status ?? '',
        managerId: updated.manager_id ?? '',
        managerNote: updated.manager_note ?? '',
        reviewedAt: updated.reviewed_at?.toISOString() ?? '',
        createdAt: updated.created_at?.toISOString() ?? '',
        selectedMaterial: null,
        selectedGemstone: null,
      },
      orderId,
      orderStatus,
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
      engraving.engraving_versions_engraving_versions_engraving_idToengravings?.[0] ?? ({} as any);
    const qrMem = engraving.qr_memories?.[0] ?? null;
    return {
      id: engraving.id,
      orderId: engraving.order_id ?? '',
      userId: engraving.user_id ?? '',
      productId: engraving.product_id ?? '',
      uniqueProductId: engraving.unique_product_id ?? '',
      approvedVersionId: engraving.approved_version_id ?? '',
      status: engraving.status ?? '',
      versions:
        engraving.engraving_versions_engraving_versions_engraving_idToengravings?.map((v: any) => ({
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
          selectedMaterial: v.materials
            ? {
                id: v.materials.id,
                name: v.materials.name,
                purity: v.materials.purity ?? '',
                color: v.materials.color ?? '',
                currentPricePerGram: Number(v.materials.current_price_per_gram ?? 0),
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
        })) ?? [],
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
                  currentPricePerGram: Number(latest.materials.current_price_per_gram ?? 0),
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

  private async triggerAudioProcessing(
    audioUrl: string,
    engravingVersionId: string,
  ) {
    const engravingVersion = await this.prisma.engraving_versions.findUnique({
      where: { id: engravingVersionId },
    });
    if (!engravingVersion) {
      console.error(`[AudioProcessing] Version ${engravingVersionId} not found`);
      return;
    }

    if (!this.biometricClient) {
      console.error(`[AudioProcessing] biometricClient not initialized (BIOMETRIC_SERVICE gRPC client missing)`);
      return;
    }

    console.log(`[AudioProcessing] Calling gRPC processAudio for version ${engravingVersionId}`);
    let result: { waveformUrl: string; durationMs: number };
    try {
      result = await lastValueFrom(
        this.biometricClient.processAudio({
          audioUrl,
          engravingVersionId,
        }),
      );
      console.log(`[AudioProcessing] gRPC success: waveformUrl=${result.waveformUrl}, durationMs=${result.durationMs}`);
    } catch (err) {
      console.error(`[AudioProcessing] gRPC failed:`, err);
      return;
    }

    const existing = await this.prisma.engraving_biometrics.findFirst({
      where: {
        engraving_id: engravingVersion.engraving_id,
        biometric_type: 'SW',
      },
    });

    if (existing) {
      console.log(`[AudioProcessing] Updating existing SW biometric for engraving ${engravingVersion.engraving_id}`);
      await this.prisma.engraving_biometrics.update({
        where: { id: existing.id },
        data: {
          raw_file_url: audioUrl,
          processed_svg_url: result.waveformUrl,
          status: 'CAPTURED',
        },
      });
    } else {
      console.log(`[AudioProcessing] Creating new SW biometric for engraving ${engravingVersion.engraving_id}`);
      await this.prisma.engraving_biometrics.create({
        data: {
          id: randomUUID(),
          engraving_id: engravingVersion.engraving_id,
          biometric_type: 'SW',
          required_channel: 'ENGRAVING',
          raw_file_url: audioUrl,
          processed_svg_url: result.waveformUrl,
          status: 'CAPTURED',
        },
      });
    }
  }
}
