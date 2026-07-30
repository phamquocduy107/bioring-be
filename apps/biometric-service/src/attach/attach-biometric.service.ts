import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  asApprovedFilesJson,
  ASSET_TYPE_TO_CHECKLIST,
  buildEcommerceApprovedFiles,
  CHECKLIST_TO_ASSET_TYPE,
  normalizeApprovedFiles,
  resolveUrlsFromApprovedFiles,
} from '@app/common';
import { PrismaService } from '@app/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  PersonalizationEngineClient,
  type UploadedFilePayload,
} from '../engine/personalization-engine.client';

@Injectable()
export class AttachBiometricService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PersonalizationEngineClient,
  ) {}

  async attachAsUser(data: {
    engravingId: string;
    userId: string;
    biometricType: string;
    fileContent: Buffer | Uint8Array;
    filename?: string;
    contentType?: string;
    extraData?: string;
  }) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: data.engravingId },
      include: { order: true },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (engraving.user_id !== data.userId) {
      throw new ForbiddenException('Engraving does not belong to this user');
    }
    const { userId: _userId, ...attachPayload } = data;
    return this.attach(attachPayload);
  }

  async listForEngraving(engravingId: string, userId: string) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: engravingId },
      include: { biometric_assets: true },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (engraving.user_id !== userId) {
      throw new ForbiddenException('Engraving does not belong to this user');
    }

    return {
      biometrics: engraving.biometric_assets.map((asset) =>
        this.mapAssetToChecklistItem(asset),
      ),
    };
  }

  async attach(data: {
    engravingId: string;
    biometricType: string;
    fileContent: Buffer | Uint8Array;
    filename?: string;
    contentType?: string;
    extraData?: string;
  }) {
    const engraving = await this.prisma.engravings.findUnique({
      where: { id: data.engravingId },
      include: { order: true },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (!engraving.order) {
      throw new BadRequestException('Engraving not linked to an order');
    }
    if (
      engraving.order.status !== 'AWAITING_SUBMIT' &&
      engraving.order.status !== 'REVISION_REQUIRED'
    ) {
      throw new BadRequestException(
        'Order must be in AWAITING_SUBMIT or REVISION_REQUIRED status to attach biometrics',
      );
    }

    const packageTypes = (engraving.order.package_type ?? '').split('_');
    if (!packageTypes.includes(data.biometricType)) {
      throw new BadRequestException(
        `Biometric type ${data.biometricType} not in package ${engraving.order.package_type}`,
      );
    }

    const assetType = CHECKLIST_TO_ASSET_TYPE[data.biometricType];
    if (!assetType) {
      throw new BadRequestException(
        `Unsupported biometric type: ${data.biometricType}`,
      );
    }

    const buffer = Buffer.isBuffer(data.fileContent)
      ? data.fileContent
      : Buffer.from(data.fileContent ?? []);
    if (!buffer.length) {
      throw new BadRequestException('fileContent is required');
    }

    let extraDataJson: Record<string, unknown> = {};
    if (data.extraData) {
      try {
        extraDataJson = JSON.parse(data.extraData) as Record<string, unknown>;
      } catch {
        throw new BadRequestException('extraData must be valid JSON');
      }
    }

    const file: UploadedFilePayload = {
      buffer,
      originalname: data.filename || this.defaultFilename(data.biometricType),
      mimetype: data.contentType || 'application/octet-stream',
    };

    const processed = await this.processWithEngine(
      data.biometricType,
      file,
      extraDataJson,
    );

    const approvedFiles = processed.approvedFiles
      ? normalizeApprovedFiles(processed.approvedFiles, {
          processedSvgUrl: processed.svgUrl,
        })
      : buildEcommerceApprovedFiles(
          processed.rawUrl || processed.svgUrl,
          processed.svgUrl,
          assetType,
        );

    const now = new Date();
    const artifactId = processed.artifactId ?? `ecommerce_${randomUUID()}`;
    const placementValue =
      Object.keys(extraDataJson).length > 0
        ? (extraDataJson as Prisma.InputJsonValue)
        : undefined;

    const asset = await this.prisma.$transaction(async (tx) => {
      const existingAsset = await tx.biometric_assets.findFirst({
        where: {
          engraving_id: data.engravingId,
          asset_type: assetType,
        },
      });

      if (existingAsset) {
        return tx.biometric_assets.update({
          where: { id: existingAsset.id },
          data: {
            artifact_id: artifactId,
            approved_files: asApprovedFilesJson(
              approvedFiles,
            ) as Prisma.InputJsonValue,
            status: 'ASSET_APPROVED',
            assigned_user_id: engraving.user_id,
            ...(placementValue !== undefined
              ? { placement: placementValue }
              : {}),
            updated_at: now,
          },
        });
      }

      return tx.biometric_assets.create({
        data: {
          id: randomUUID(),
          artifact_id: artifactId,
          asset_type: assetType,
          status: 'ASSET_APPROVED',
          engraving_id: data.engravingId,
          assigned_user_id: engraving.user_id,
          approved_files: asApprovedFilesJson(
            approvedFiles,
          ) as Prisma.InputJsonValue,
          ...(placementValue !== undefined
            ? { placement: placementValue }
            : {}),
          created_at: now,
          updated_at: now,
        },
      });
    });

    return {
      biometric: this.mapAssetToChecklistItem(asset, artifactId),
    };
  }

  private mapAssetToChecklistItem(
    asset: {
      id: string;
      engraving_id: string | null;
      asset_type: string;
      status: string | null;
      artifact_id: string;
      approved_files?: unknown;
      placement?: unknown;
    },
    artifactId?: string,
  ) {
    const biometricType =
      ASSET_TYPE_TO_CHECKLIST[asset.asset_type] ?? asset.asset_type;
    const urls = resolveUrlsFromApprovedFiles(asset.approved_files);
    return {
      id: asset.id,
      engravingId: asset.engraving_id ?? '',
      biometricType,
      requiredChannel: biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING',
      biometricAssetId: asset.id,
      rawFileUrl: urls.rawFileUrl,
      processedSvgUrl: urls.processedSvgUrl,
      status: asset.status ?? 'ASSET_APPROVED',
      artifactId: artifactId ?? asset.artifact_id,
      extraData:
        (asset.placement as Record<string, unknown> | null) ?? {},
    };
  }

  private defaultFilename(biometricType: string): string {
    if (biometricType === 'SW') return 'audio.mp3';
    if (biometricType === 'HB') return 'heartbeat.bin';
    return 'fingerprint.png';
  }

  private async processWithEngine(
    biometricType: string,
    file: UploadedFilePayload,
    extraData: Record<string, unknown>,
  ): Promise<{
    svgUrl: string;
    rawUrl?: string;
    artifactId?: string;
    approvedFiles?: unknown;
  }> {
    if (biometricType === 'HB') {
      const stored = await this.engine.storeHeartbeat(file);
      const rawUrl = stored.approvedFiles.sourceFiles.raw;
      return {
        svgUrl: stored.approvedFiles.productionFiles.svg || rawUrl,
        rawUrl,
        artifactId: stored.artifactId,
        approvedFiles: stored.approvedFiles,
      };
    }

    if (biometricType === 'FP') {
      const review = await this.engine.processFingerprint(file);
      const published = await this.engine.publishApproved(
        review.artifactId,
        {
          approvedBy: 'ecommerce-attach',
          approvedAt: new Date().toISOString(),
          approvalNote: 'auto-publish on attach',
          copyDebugFiles: true,
        },
        'fingerprint',
      );
      try {
        await this.engine.cleanupReview(
          review.artifactId,
          { reason: 'approved' },
          'fingerprint',
        );
      } catch {
        // non-fatal
      }
      return {
        svgUrl: published.approvedFiles.productionFiles.svg,
        rawUrl: published.approvedFiles.sourceFiles.raw,
        artifactId: review.artifactId,
        approvedFiles: published.approvedFiles,
      };
    }

    if (biometricType === 'SW') {
      const startMs = Number(extraData.startMs ?? 0);
      const endMs = Number(extraData.endMs ?? startMs + 3000);
      const durationMs = Math.min(3000, Math.max(1, endMs - startMs));
      const review = await this.engine.processSoundwave(file, {
        segmentStartMs: Number.isFinite(startMs) ? startMs : 0,
        segmentDurationMs: Number.isFinite(durationMs) ? durationMs : 3000,
      });
      const published = await this.engine.publishApproved(
        review.artifactId,
        {
          approvedBy: 'ecommerce-attach',
          approvedAt: new Date().toISOString(),
          approvalNote: 'auto-publish on attach',
          copyDebugFiles: true,
        },
        'soundwave',
      );
      try {
        await this.engine.cleanupReview(
          review.artifactId,
          { reason: 'approved' },
          'soundwave',
        );
      } catch {
        // non-fatal
      }
      return {
        svgUrl: published.approvedFiles.productionFiles.svg,
        rawUrl: published.approvedFiles.sourceFiles.raw,
        artifactId: review.artifactId,
        approvedFiles: normalizeApprovedFiles(published.approvedFiles),
      };
    }

    throw new BadRequestException(
      `Unsupported biometric type: ${biometricType}`,
    );
  }
}
