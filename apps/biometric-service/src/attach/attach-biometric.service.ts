import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  asApprovedFilesJson,
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
      include: {
        engraving_biometrics: { include: { biometric_asset: true } },
      },
    });
    if (!engraving) throw new NotFoundException('Engraving not found');
    if (engraving.user_id !== userId) {
      throw new ForbiddenException('Engraving does not belong to this user');
    }

    return {
      biometrics: engraving.engraving_biometrics.map((row) => {
        const urls = resolveUrlsFromApprovedFiles(
          row.biometric_asset?.approved_files,
        );
        return {
          id: row.id,
          engravingId: row.engraving_id,
          biometricType: row.biometric_type,
          requiredChannel: row.required_channel,
          biometricAssetId: row.biometric_asset_id ?? '',
          rawFileUrl: urls.rawFileUrl,
          processedSvgUrl: urls.processedSvgUrl,
          status: row.status ?? 'PENDING_CAPTURE',
          artifactId: row.biometric_asset?.artifact_id ?? '',
          extraData: row.extra_data ?? {},
        };
      }),
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

    const requiredChannel =
      data.biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING';
    const now = new Date();
    const artifactId = processed.artifactId ?? `ecommerce_${randomUUID()}`;

    const biometric = await this.prisma.$transaction(async (tx) => {
      const existingChecklist = await tx.engraving_biometrics.findUnique({
        where: {
          engraving_id_biometric_type: {
            engraving_id: data.engravingId,
            biometric_type: data.biometricType,
          },
        },
      });

      let assetId = existingChecklist?.biometric_asset_id ?? null;

      if (assetId) {
        await tx.biometric_assets.update({
          where: { id: assetId },
          data: {
            artifact_id: artifactId,
            approved_files: asApprovedFilesJson(
              approvedFiles,
            ) as Prisma.InputJsonValue,
            status: 'ASSET_APPROVED',
            updated_at: now,
          },
        });
      } else {
        const existingAsset = await tx.biometric_assets.findFirst({
          where: {
            engraving_id: data.engravingId,
            asset_type: assetType,
          },
        });
        if (existingAsset) {
          assetId = existingAsset.id;
          await tx.biometric_assets.update({
            where: { id: assetId },
            data: {
              artifact_id: artifactId,
              approved_files: asApprovedFilesJson(
                approvedFiles,
              ) as Prisma.InputJsonValue,
              status: 'ASSET_APPROVED',
              updated_at: now,
            },
          });
        } else {
          assetId = randomUUID();
          await tx.biometric_assets.create({
            data: {
              id: assetId,
              artifact_id: artifactId,
              asset_type: assetType,
              status: 'ASSET_APPROVED',
              engraving_id: data.engravingId,
              assigned_user_id: engraving.user_id,
              approved_files: asApprovedFilesJson(
                approvedFiles,
              ) as Prisma.InputJsonValue,
              created_at: now,
              updated_at: now,
            },
          });
        }
      }

      return tx.engraving_biometrics.upsert({
        where: {
          engraving_id_biometric_type: {
            engraving_id: data.engravingId,
            biometric_type: data.biometricType,
          },
        },
        create: {
          id: randomUUID(),
          engraving_id: data.engravingId,
          biometric_type: data.biometricType,
          required_channel: requiredChannel,
          biometric_asset_id: assetId,
          extra_data: extraDataJson as Prisma.InputJsonValue,
          status: 'ASSET_APPROVED',
          created_at: now,
          updated_at: now,
        },
        update: {
          biometric_asset_id: assetId,
          extra_data: extraDataJson as Prisma.InputJsonValue,
          status: 'ASSET_APPROVED',
          updated_at: now,
        },
        include: { biometric_asset: true },
      });
    });

    const urls = resolveUrlsFromApprovedFiles(
      biometric.biometric_asset?.approved_files,
    );

    return {
      biometric: {
        id: biometric.id,
        engravingId: biometric.engraving_id,
        biometricType: biometric.biometric_type,
        requiredChannel: biometric.required_channel,
        biometricAssetId: biometric.biometric_asset_id ?? '',
        rawFileUrl: urls.rawFileUrl,
        processedSvgUrl: urls.processedSvgUrl,
        extraData: biometric.extra_data ?? {},
        status: biometric.status ?? 'ASSET_APPROVED',
        artifactId,
      },
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
