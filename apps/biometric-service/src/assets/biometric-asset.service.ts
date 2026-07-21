import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import {
  ASSET_TYPE_TO_CHECKLIST,
  normalizeApprovedFiles,
  asApprovedFilesJson,
} from '@app/common';
import { biometric_assets, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  PersonalizationEngineClient,
  type ApprovedFilesBundleDto,
  type FingerprintReviewResponse,
  type ReviewFilesBundleDto,
  type SoundwaveReviewResponse,
  type ViewerFilesDto,
} from '../engine/personalization-engine.client';
import {
  ASSET_APPROVED,
  PLACEMENT_CONFIRMED,
  PROCESSING,
  READY_FOR_REVIEW,
  type BiometricAssetDto,
  type PipelineAssetType,
  toPythonArtifactType,
} from './biometric-asset.types';

@Injectable()
export class BiometricAssetService {
  private readonly logger = new Logger(BiometricAssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PersonalizationEngineClient,
  ) {}

  async getAsset(assetId: string): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(assetId);
    return { asset: this.toResponse(asset) };
  }

  getFingerprintPresets() {
    return this.engine.getFingerprintPresets();
  }

  getSoundwavePresets() {
    return this.engine.getSoundwavePresets();
  }

  async processFingerprint(data: {
    staffId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string };
  }): Promise<{ asset: BiometricAssetDto }> {
    return this.processReviewPipeline('fingerprint', data.staffId, data.file);
  }

  async processSoundwave(data: {
    staffId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string };
    segmentStartMs?: number;
    segmentDurationMs?: number;
  }): Promise<{ asset: BiometricAssetDto }> {
    return this.processReviewPipeline('soundwave', data.staffId, data.file, {
      segmentStartMs: data.segmentStartMs ?? 0,
      segmentDurationMs: data.segmentDurationMs ?? 3000,
    });
  }

  async storeHeartbeat(data: {
    staffId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string };
  }): Promise<{ asset: BiometricAssetDto }> {
    const assetId = randomUUID();
    await this.prisma.biometric_assets.create({
      data: {
        id: assetId,
        artifact_id: '',
        asset_type: 'heartbeat',
        status: PROCESSING,
        created_by_staff_id: data.staffId,
      },
    });

    try {
      const stored = await this.engine.storeHeartbeat(data.file);
      const approvedFiles = normalizeApprovedFiles(
        stored.approvedFiles,
      ) as ApprovedFilesBundleDto;
      const updated = await this.prisma.biometric_assets.update({
        where: { id: assetId },
        data: {
          artifact_id: stored.artifactId,
          status: ASSET_APPROVED,
          approved_files: asApprovedFilesJson(
            approvedFiles as unknown as Parameters<
              typeof asApprovedFilesJson
            >[0],
          ) as Prisma.InputJsonValue,
          manifest_url: stored.manifestUrl,
          updated_at: new Date(),
        },
      });
      return { asset: this.toResponse(updated, undefined, approvedFiles) };
    } catch (error) {
      await this.prisma.biometric_assets.delete({ where: { id: assetId } });
      throw error;
    }
  }

  async processAudio(audioUrl: string, _engravingVersionId: string) {
    const review = await this.engine.processSoundwaveFromUrl(audioUrl);
    const durationMs = Number(
      review.metadata?.segmentDurationMs ?? review.metadata?.durationMs ?? 0,
    );
    return {
      waveformUrl: review.reviewFiles.productionFiles.svg,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      artifactId: review.artifactId,
    };
  }

  async reprocess(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertPipelineAsset(asset.asset_type);
    this.assertStatus(asset, [READY_FOR_REVIEW], 'reprocess');

    const options = this.parseJson(data.optionsJson);
    const python = await this.runReprocess(
      asset.asset_type,
      asset.artifact_id,
      options,
    );
    const updated = await this.updateReviewState(asset.id, python);
    return { asset: this.toResponse(updated, python.reviewFiles) };
  }

  async regenerateTextures(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertPipelineAsset(asset.asset_type);
    this.assertStatus(asset, [READY_FOR_REVIEW], 'textures');

    const options = this.parseJson(data.optionsJson);
    const textureResult = (await this.runTextures(
      asset.asset_type,
      asset.artifact_id,
      options,
    )) as { files: ViewerFilesDto };

    const existingReview = (asset.review_files ??
      null) as unknown as ReviewFilesBundleDto | null;
    const mergedReview: ReviewFilesBundleDto = {
      viewerFiles: {
        ...(existingReview?.viewerFiles ?? textureResult.files),
        ...textureResult.files,
      },
      productionFiles: existingReview?.productionFiles ?? { svg: '' },
      debugFiles: existingReview?.debugFiles ?? {
        inputPng: '',
        finalCleanPng: '',
      },
    };

    const updated = await this.prisma.biometric_assets.update({
      where: { id: asset.id },
      data: {
        status: READY_FOR_REVIEW,
        review_files: mergedReview as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });

    return { asset: this.toResponse(updated, mergedReview) };
  }

  async approve(data: {
    assetId: string;
    staffId: string;
    note?: string;
    copyDebugFiles?: boolean;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertPipelineAsset(asset.asset_type);
    this.assertStatus(asset, [READY_FOR_REVIEW], 'approve');

    const approvedAt = new Date().toISOString();
    const pythonType = toPythonArtifactType(asset.asset_type);
    let python;
    try {
      python = await this.engine.publishApproved(
        asset.artifact_id,
        {
          approvedBy: data.staffId,
          approvedAt,
          approvalNote: data.note,
          copyDebugFiles: data.copyDebugFiles ?? false,
        },
        pythonType,
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to publish approved assets: ${(error as Error).message}`,
      );
    }

    const approvedFiles = normalizeApprovedFiles(python.approvedFiles);
    const updated = await this.prisma.biometric_assets.update({
      where: { id: asset.id },
      data: {
        status: ASSET_APPROVED,
        approved_by: data.staffId,
        approved_at: new Date(approvedAt),
        approval_note: data.note,
        review_files: Prisma.JsonNull,
        approved_files: asApprovedFilesJson(
          approvedFiles,
        ) as Prisma.InputJsonValue,
        manifest_url: python.manifestUrl,
        updated_at: new Date(),
      },
    });

    if (updated.engraving_id) {
      await this.linkEngravingChecklist(updated);
    }

    try {
      await this.engine.cleanupReview(
        asset.artifact_id,
        { reason: 'approved' },
        pythonType,
      );
    } catch (error) {
      this.logger.warn(
        `cleanup-review failed after approve for ${asset.artifact_id}: ${(error as Error).message}`,
      );
    }

    return {
      asset: this.toResponse(
        updated,
        undefined,
        approvedFiles as unknown as ApprovedFilesBundleDto,
      ),
    };
  }

  async assign(data: {
    assetId: string;
    staffId: string;
    userId: string;
    engravingId?: string;
    orderItemId?: string;
    modelCode?: string;
    surface?: string;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertStatus(asset, [ASSET_APPROVED], 'assign');

    const engravingId = data.engravingId?.trim() || null;
    if (engravingId) {
      const engraving = await this.prisma.engravings.findUnique({
        where: { id: engravingId },
        select: { id: true },
      });
      if (!engraving) {
        throw new NotFoundException(`Engraving not found: ${engravingId}`);
      }

      const conflict = await this.prisma.biometric_assets.findFirst({
        where: {
          engraving_id: engravingId,
          asset_type: asset.asset_type,
          NOT: { id: asset.id },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException(
          `Engraving already has a ${asset.asset_type} biometric asset`,
        );
      }
    }

    const updated = await this.prisma.biometric_assets.update({
      where: { id: asset.id },
      data: {
        assigned_user_id: data.userId,
        engraving_id: engravingId,
        order_item_id: data.orderItemId || null,
        model_code: data.modelCode,
        surface: data.surface,
        updated_at: new Date(),
      },
    });

    if (engravingId) {
      await this.linkEngravingChecklist(updated);
    }

    return { asset: this.toResponse(updated) };
  }

  async getUserViewerAssets(data: {
    assetId: string;
    userId: string;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertAssignedUser(asset, data.userId);
    this.assertStatus(
      asset,
      [ASSET_APPROVED, PLACEMENT_CONFIRMED],
      'viewer-assets',
    );

    const approvedFiles = asset.approved_files as ApprovedFilesBundleDto | null;
    let viewerFiles = approvedFiles?.viewerFiles;
    let placement = asset.placement as Record<string, unknown> | null;

    if (
      asset.asset_type === 'fingerprint' ||
      asset.asset_type === 'soundwave'
    ) {
      try {
        const refreshed = await this.engine.getApprovedViewerAssets(
          asset.artifact_id,
          toPythonArtifactType(asset.asset_type),
        );
        viewerFiles = refreshed.viewerFiles;
        placement = refreshed.placement ?? placement;
      } catch {
        // Fall back to PostgreSQL cached URLs.
      }
    }

    return {
      asset: {
        assetId: asset.id,
        artifactId: asset.artifact_id,
        status: asset.status,
        modelCode: asset.model_code ?? undefined,
        surface: asset.surface ?? undefined,
        viewerFiles,
        placement: placement ?? undefined,
      },
    };
  }

  async confirmPlacement(data: {
    assetId: string;
    userId: string;
    placementJson: string;
  }): Promise<{ asset: BiometricAssetDto }> {
    const asset = await this.getAssetOrThrow(data.assetId);
    this.assertAssignedUser(asset, data.userId);
    this.assertStatus(
      asset,
      [ASSET_APPROVED, PLACEMENT_CONFIRMED],
      'confirm-placement',
    );

    const body = this.parseJson(data.placementJson) as {
      modelCode: string;
      surface: string;
      placement: Record<string, unknown>;
    };

    if (!body.modelCode || !body.surface || !body.placement) {
      throw new BadRequestException(
        'placementJson must include modelCode, surface, and placement',
      );
    }

    const confirmedAt = new Date();
    const updated = await this.prisma.biometric_assets.update({
      where: { id: asset.id },
      data: {
        status: PLACEMENT_CONFIRMED,
        model_code: body.modelCode,
        surface: body.surface,
        placement: body.placement as Prisma.InputJsonValue,
        placement_confirmed_at: confirmedAt,
        updated_at: confirmedAt,
      },
    });

    return {
      asset: {
        assetId: updated.id,
        artifactId: updated.artifact_id,
        status: PLACEMENT_CONFIRMED,
        modelCode: body.modelCode,
        surface: body.surface,
        placement: body.placement,
        placementConfirmedAt: confirmedAt.toISOString(),
      },
    };
  }

  private async processReviewPipeline(
    assetType: PipelineAssetType,
    staffId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    segment?: { segmentStartMs: number; segmentDurationMs: number },
  ): Promise<{ asset: BiometricAssetDto }> {
    const assetId = randomUUID();
    await this.prisma.biometric_assets.create({
      data: {
        id: assetId,
        artifact_id: '',
        asset_type: assetType,
        status: PROCESSING,
        created_by_staff_id: staffId,
      },
    });

    try {
      const python =
        assetType === 'soundwave'
          ? await this.engine.processSoundwave(file, segment)
          : await this.engine.processFingerprint(file);

      const updated = await this.prisma.biometric_assets.update({
        where: { id: assetId },
        data: {
          artifact_id: python.artifactId,
          status: READY_FOR_REVIEW,
          review_files: python.reviewFiles as unknown as Prisma.InputJsonValue,
          manifest_url: python.manifestUrl,
          quality_score:
            assetType === 'fingerprint'
              ? (python as FingerprintReviewResponse).quality?.score
              : undefined,
          updated_at: new Date(),
        },
      });

      return { asset: this.toResponse(updated, python.reviewFiles) };
    } catch (error) {
      await this.prisma.biometric_assets.delete({ where: { id: assetId } });
      throw error;
    }
  }

  private async runReprocess(
    assetType: string,
    artifactId: string,
    options: Record<string, unknown>,
  ): Promise<FingerprintReviewResponse | SoundwaveReviewResponse> {
    if (assetType === 'soundwave') {
      return this.engine.reprocessSoundwave(artifactId, options);
    }
    return this.engine.reprocess(artifactId, options);
  }

  private async runTextures(
    assetType: string,
    artifactId: string,
    options: Record<string, unknown>,
  ): Promise<unknown> {
    if (assetType === 'soundwave') {
      return this.engine.texturesSoundwave(artifactId, options);
    }
    return this.engine.textures(artifactId, options);
  }

  private assertPipelineAsset(assetType: string): void {
    if (assetType !== 'fingerprint' && assetType !== 'soundwave') {
      throw new BadRequestException(
        `Asset type ${assetType} does not support this operation`,
      );
    }
  }

  private async linkEngravingChecklist(asset: biometric_assets): Promise<void> {
    if (!asset.engraving_id) return;

    const biometricType = ASSET_TYPE_TO_CHECKLIST[asset.asset_type];
    if (!biometricType) {
      this.logger.warn(
        `No checklist mapping for asset_type=${asset.asset_type}; skip link`,
      );
      return;
    }

    const requiredChannel =
      biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING';
    const now = new Date();

    await this.prisma.engraving_biometrics.upsert({
      where: {
        engraving_id_biometric_type: {
          engraving_id: asset.engraving_id,
          biometric_type: biometricType,
        },
      },
      create: {
        id: randomUUID(),
        engraving_id: asset.engraving_id,
        biometric_type: biometricType,
        required_channel: requiredChannel,
        biometric_asset_id: asset.id,
        status: ASSET_APPROVED,
        created_at: now,
        updated_at: now,
      },
      update: {
        biometric_asset_id: asset.id,
        status: ASSET_APPROVED,
        updated_at: now,
      },
    });
  }

  private async updateReviewState(
    assetId: string,
    python: FingerprintReviewResponse | SoundwaveReviewResponse,
  ) {
    return this.prisma.biometric_assets.update({
      where: { id: assetId },
      data: {
        status: READY_FOR_REVIEW,
        review_files: python.reviewFiles as unknown as Prisma.InputJsonValue,
        manifest_url: python.manifestUrl,
        updated_at: new Date(),
      },
    });
  }

  private async getAssetOrThrow(assetId: string): Promise<biometric_assets> {
    const asset = await this.prisma.biometric_assets.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundException(`Biometric asset not found: ${assetId}`);
    }
    return asset;
  }

  private assertStatus(
    asset: biometric_assets,
    allowed: string[],
    action: string,
  ): void {
    if (!allowed.includes(asset.status ?? '')) {
      throw new BadRequestException(
        `Cannot ${action} asset in status ${asset.status}`,
      );
    }
  }

  private assertAssignedUser(asset: biometric_assets, userId: string): void {
    if (asset.assigned_user_id !== userId) {
      throw new ForbiddenException('Asset is not assigned to this user');
    }
  }

  private parseJson(raw?: string): Record<string, unknown> {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }
  }

  private toResponse(
    asset: biometric_assets,
    reviewFiles?: ReviewFilesBundleDto,
    approvedFiles?: ApprovedFilesBundleDto,
  ): BiometricAssetDto {
    const storedReview = asset.review_files as ReviewFilesBundleDto | null;
    const storedApproved =
      asset.approved_files as ApprovedFilesBundleDto | null;

    return {
      assetId: asset.id,
      artifactId: asset.artifact_id,
      status: asset.status ?? '',
      reviewFiles: reviewFiles ?? storedReview ?? undefined,
      approvedFiles: approvedFiles ?? storedApproved ?? undefined,
      manifestUrl: asset.manifest_url ?? undefined,
      modelCode: asset.model_code ?? undefined,
      surface: asset.surface ?? undefined,
      viewerFiles:
        (approvedFiles ?? storedApproved)?.viewerFiles ??
        (reviewFiles ?? storedReview)?.viewerFiles,
      placement:
        (asset.placement as Record<string, unknown> | null) ?? undefined,
      assignedUserId: asset.assigned_user_id ?? undefined,
      engravingId: asset.engraving_id ?? undefined,
      orderItemId: asset.order_item_id ?? undefined,
      approvedBy: asset.approved_by ?? undefined,
      approvedAt: asset.approved_at?.toISOString(),
      approvalNote: asset.approval_note ?? undefined,
      placementConfirmedAt: asset.placement_confirmed_at?.toISOString(),
      qualityScore: asset.quality_score
        ? Number(asset.quality_score)
        : undefined,
      createdAt: asset.created_at?.toISOString(),
      updatedAt: asset.updated_at?.toISOString(),
    };
  }
}
