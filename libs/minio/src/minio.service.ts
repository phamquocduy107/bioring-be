import { MINIO_CLIENT } from '@app/common';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type {
  MinioListObjectsOptions,
  MinioObjectSummary,
} from './minio.types';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private defaultBucket!: string;
  private personalizationBucket?: string;
  private publicEndpoint?: string;
  private startupReady = false;

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: Minio.Client,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.defaultBucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'knowledge-documents',
    );
    this.personalizationBucket = this.configService.get<string>(
      'PERSONALIZATION_MINIO_BUCKET',
    );
    this.publicEndpoint = this.configService.get<string>(
      'MINIO_PUBLIC_ENDPOINT',
    );

    const ensureOnStartup =
      this.configService.get<string>(
        'MINIO_ENSURE_BUCKET_ON_STARTUP',
        'false',
      ) === 'true';

    if (!ensureOnStartup) {
      this.logger.log(
        'MinIO bucket check deferred (set MINIO_ENSURE_BUCKET_ON_STARTUP=true to verify at startup)',
      );
      return;
    }

    try {
      await this.ensureBucket(this.defaultBucket);
      this.startupReady = true;
      this.logger.log(`MinIO bucket ready: ${this.defaultBucket}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `MinIO unavailable at startup (${message}). App continues; storage ops fail until MinIO is up.`,
      );
    }
  }

  isStartupReady(): boolean {
    return this.startupReady;
  }

  async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.client.listBuckets();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  }

  getClient(): Minio.Client {
    return this.client;
  }

  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  getPersonalizationBucket(): string | undefined {
    return this.personalizationBucket;
  }

  resolveBucket(bucket?: string): string {
    return bucket ?? this.defaultBucket;
  }

  buildPublicUrl(bucket: string, key: string): string | null {
    if (!this.publicEndpoint) {
      return null;
    }
    const base = this.publicEndpoint.replace(/\/+$/, '');
    const normalizedKey = key.replace(/^\/+/, '');
    return `${base}/${bucket}/${normalizedKey}`;
  }

  buildStorageKey(
    workspaceId: string,
    documentId: string,
    originalName: string,
  ): string {
    const safeName = originalName.replace(/[^\w.\-]+/g, '_');
    return `${workspaceId}/${documentId}/${safeName}`;
  }

  async ensureBucket(bucket?: string): Promise<void> {
    const target = this.resolveBucket(bucket);
    const exists = await this.client.bucketExists(target);
    if (!exists) {
      await this.client.makeBucket(target);
      this.logger.log(`Created MinIO bucket: ${target}`);
    }
  }

  async bucketExists(bucket?: string): Promise<boolean> {
    return this.client.bucketExists(this.resolveBucket(bucket));
  }

  async listBuckets(): Promise<Minio.BucketItemFromList[]> {
    return this.client.listBuckets();
  }

  async uploadObject(
    key: string,
    buffer: Buffer,
    mimetype: string,
    bucket?: string,
  ): Promise<string> {
    const target = this.resolveBucket(bucket);
    await this.ensureBucket(target);
    await this.client.putObject(target, key, buffer, buffer.length, {
      'Content-Type': mimetype,
    });
    this.startupReady = true;
    return key;
  }

  async getObjectBuffer(key: string, bucket?: string): Promise<Buffer> {
    const target = this.resolveBucket(bucket);
    const stream = await this.client.getObject(target, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string, bucket?: string): Promise<void> {
    await this.client.removeObject(this.resolveBucket(bucket), key);
  }

  async statObject(key: string, bucket?: string) {
    return this.client.statObject(this.resolveBucket(bucket), key);
  }

  async listObjects(
    options: MinioListObjectsOptions = {},
  ): Promise<MinioObjectSummary[]> {
    const target = this.resolveBucket(options.bucket);
    const prefix = options.prefix ?? '';
    const recursive = options.recursive ?? false;
    const maxKeys = options.maxKeys ?? 1000;

    const stream = this.client.listObjects(target, prefix, recursive);
    const items: MinioObjectSummary[] = [];

    for await (const obj of stream) {
      if (!obj.name) {
        continue;
      }
      items.push({
        name: obj.name,
        size: obj.size ?? 0,
        etag: obj.etag,
        lastModified: obj.lastModified,
      });
      if (items.length >= maxKeys) {
        break;
      }
    }

    return items;
  }

  async getPresignedGetUrl(
    key: string,
    expirySeconds = 3600,
    bucket?: string,
  ): Promise<string> {
    return this.client.presignedGetObject(
      this.resolveBucket(bucket),
      key,
      expirySeconds,
    );
  }
}
