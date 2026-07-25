import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ViewerFilesDto {
  overlayPng: string;
  alphaMap: string;
  heightmap: string;
  normalMap: string;
  roughnessMap: string;
  aoMap: string;
}

export interface ReviewFilesBundleDto {
  viewerFiles: ViewerFilesDto;
  productionFiles: {
    svg: string;
    waveformPoints?: string;
    audioOriginal?: string;
    audioSegment?: string;
  };
  sourceFiles?: { raw: string };
  debugFiles?: {
    inputPng?: string;
    finalCleanPng?: string;
    previewPng?: string;
    segmentWav?: string;
  };
}

export interface ApprovedFilesBundleDto {
  viewerFiles?: ViewerFilesDto;
  productionFiles: {
    svg: string;
    waveformPoints?: string;
    audioOriginal?: string;
    audioSegment?: string;
  };
  sourceFiles: { raw: string };
}

export interface FingerprintReviewResponse {
  artifactId: string;
  status: string;
  stage: string;
  reviewFiles: ReviewFilesBundleDto;
  manifestUrl: string;
  quality?: { passed: boolean; score: number; message: string };
}

export interface SoundwaveReviewResponse {
  artifactId: string;
  status: string;
  stage: string;
  type?: string;
  reviewFiles: ReviewFilesBundleDto;
  manifestUrl: string;
  metadata?: { durationMs?: number; segmentDurationMs?: number };
}

export interface PublishApprovedResponse {
  artifactId: string;
  status: string;
  stage: string;
  approvedFiles: ApprovedFilesBundleDto;
  manifestUrl: string;
}

export interface ApprovedViewerAssetsResponse {
  artifactId: string;
  status: string;
  stage: string;
  viewerFiles: ViewerFilesDto;
  placement?: Record<string, unknown>;
}

export type UploadedFilePayload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class PersonalizationEngineClient {
  private readonly logger = new Logger(PersonalizationEngineClient.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const rawUrl = this.configService.get<string>(
      'PERSONALIZATION_ENGINE_URL',
      'http://127.0.0.1:8010',
    );
    this.baseUrl = rawUrl.replace('localhost', '127.0.0.1');
  }

  async downloadUrl(url: string): Promise<UploadedFilePayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new HttpException(
          `Failed to download biometric file (${response.status}): ${url}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimetype =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        'application/octet-stream';
      const originalname = this.filenameFromUrl(url, mimetype);
      return { buffer, originalname, mimetype };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `Download biometric file failed: ${(error as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async processFingerprint(
    file: UploadedFilePayload,
  ): Promise<FingerprintReviewResponse> {
    const form = new FormData();
    const blob = new Blob([file.buffer as unknown as BlobPart], {
      type: file.mimetype,
    });
    form.append('file', blob, file.originalname);

    return this.requestMultipart<FingerprintReviewResponse>(
      '/fingerprint/process',
      form,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 120_000),
    );
  }

  async processSoundwave(
    file: UploadedFilePayload,
    segment?: { segmentStartMs?: number; segmentDurationMs?: number },
  ): Promise<SoundwaveReviewResponse> {
    const form = new FormData();
    const blob = new Blob([file.buffer as unknown as BlobPart], {
      type: file.mimetype,
    });
    form.append('file', blob, file.originalname);
    form.append(
      'segmentStartMs',
      String(Math.max(0, segment?.segmentStartMs ?? 0)),
    );
    form.append(
      'segmentDurationMs',
      String(Math.min(3000, Math.max(1, segment?.segmentDurationMs ?? 3000))),
    );

    return this.requestMultipart<SoundwaveReviewResponse>(
      '/soundwave/process',
      form,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 120_000),
    );
  }

  async processFingerprintFromUrl(
    imageUrl: string,
  ): Promise<FingerprintReviewResponse> {
    const file = await this.downloadUrl(imageUrl);
    return this.processFingerprint(file);
  }

  async processSoundwaveFromUrl(
    audioUrl: string,
    segment?: { segmentStartMs?: number; segmentDurationMs?: number },
  ): Promise<SoundwaveReviewResponse> {
    const file = await this.downloadUrl(audioUrl);
    return this.processSoundwave(file, segment);
  }

  async storeHeartbeat(file: UploadedFilePayload): Promise<{
    artifactId: string;
    status: string;
    stage: string;
    approvedFiles: ApprovedFilesBundleDto;
    manifestUrl: string;
  }> {
    const form = new FormData();
    const blob = new Blob([file.buffer as unknown as BlobPart], {
      type: file.mimetype,
    });
    form.append('file', blob, file.originalname);

    return this.requestMultipart(
      '/heartbeat/store',
      form,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 60_000),
    );
  }

  async reprocess(
    artifactId: string,
    body: Record<string, unknown>,
  ): Promise<FingerprintReviewResponse> {
    return this.post<FingerprintReviewResponse>(
      `/fingerprint/${artifactId}/reprocess`,
      body,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 120_000),
    );
  }

  async reprocessSoundwave(
    artifactId: string,
    body: Record<string, unknown>,
  ): Promise<SoundwaveReviewResponse> {
    return this.post<SoundwaveReviewResponse>(
      `/soundwave/${artifactId}/reprocess`,
      body,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 120_000),
    );
  }

  async textures(
    artifactId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/fingerprint/${artifactId}/reprocess-texture`,
      body,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 60_000),
    );
  }

  async texturesSoundwave(
    artifactId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.post(
      `/soundwave/${artifactId}/reprocess-texture`,
      body,
      Number(process.env.PERSONALIZATION_PROCESS_TIMEOUT_MS ?? 60_000),
    );
  }

  async publishApproved(
    artifactId: string,
    body: {
      approvedBy: string;
      approvedAt: string;
      approvalNote?: string;
      copyDebugFiles: boolean;
    },
    artifactType: 'fingerprint' | 'soundwave' = 'fingerprint',
  ): Promise<PublishApprovedResponse> {
    return this.post<PublishApprovedResponse>(
      `/${artifactType}/${artifactId}/publish-approved`,
      body,
      Number(process.env.PERSONALIZATION_PUBLISH_TIMEOUT_MS ?? 60_000),
    );
  }

  async cleanupReview(
    artifactId: string,
    body: { reason?: string } = { reason: 'approved' },
    artifactType: 'fingerprint' | 'soundwave' = 'fingerprint',
  ): Promise<{ artifactId: string; deletedObjects: number; reason: string }> {
    return this.post(
      `/${artifactType}/${artifactId}/cleanup-review`,
      body,
      Number(process.env.PERSONALIZATION_PUBLISH_TIMEOUT_MS ?? 60_000),
    );
  }

  async getApprovedViewerAssets(
    artifactId: string,
    artifactType: 'fingerprint' | 'soundwave' = 'fingerprint',
  ): Promise<ApprovedViewerAssetsResponse> {
    return this.get<ApprovedViewerAssetsResponse>(
      `/${artifactType}/${artifactId}/approved-viewer-assets`,
    );
  }

  async getFingerprintPresets(): Promise<{
    presets: unknown[];
    parameterGuide: Record<string, string>;
  }> {
    return this.get('/fingerprint/presets');
  }

  async getSoundwavePresets(): Promise<{
    presets: unknown[];
    parameterGuide: Record<string, string>;
  }> {
    return this.get('/soundwave/presets');
  }

  private filenameFromUrl(url: string, mimetype: string): string {
    try {
      const pathname = new URL(url).pathname;
      const base = pathname.split('/').pop() || 'upload';
      if (base.includes('.')) return base;
    } catch {
      // fall through
    }
    if (mimetype.includes('png')) return 'upload.png';
    if (mimetype.includes('jpeg') || mimetype.includes('jpg'))
      return 'upload.jpg';
    if (mimetype.includes('wav')) return 'upload.wav';
    if (mimetype.includes('mpeg') || mimetype.includes('mp3'))
      return 'upload.mp3';
    return 'upload.bin';
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        signal: controller.signal,
      });
      return this.parseResponse<T>(response, path);
    } catch (error) {
      this.rethrow(path, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    timeoutMs = 60_000,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return this.parseResponse<T>(response, path);
    } catch (error) {
      this.rethrow(path, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async requestMultipart<T>(
    path: string,
    form: FormData,
    timeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      return this.parseResponse<T>(response, path);
    } catch (error) {
      this.rethrow(path, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseResponse<T>(response: Response, path: string): Promise<T> {
    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(
        `personalization_engine ${path} failed (${response.status}): ${errText}`,
      );
      throw new HttpException(
        `personalization_engine ${path} failed: ${errText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return (await response.json()) as T;
  }

  private rethrow(path: string, error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpException(
      `personalization_engine unreachable (${path}): ${message}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
