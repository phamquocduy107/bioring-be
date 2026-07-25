import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import {
  KNOWLEDGE_DOWNLOAD_URL_TTL_SECONDS,
  normalizeDocumentType,
  normalizeRetrievalTypes,
  type RetrievalType,
} from '@app/common';
import { knowledge_documents, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MinioService } from '@app/minio';
import { IngestionService } from '../ingestion/ingestion.service';

/** Document statuses that are safe for RAG query. */
const READY_DOCUMENT_STATUSES = new Set(['COMPLETED', 'READY']);

/** Clamp client-requested TTL (seconds). */
const MIN_DOWNLOAD_TTL_SECONDS = 60;
const MAX_DOWNLOAD_TTL_SECONDS = 60 * 60;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    @Inject(forwardRef(() => IngestionService))
    private readonly ingestionService: IngestionService,
  ) {}

  async uploadDocument(data: {
    userId: string;
    workspaceId: string;
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    };
    documentType?: string;
    retrievalTypes?: string[];
  }) {
    const documentId = randomUUID();
    const storageKey = this.minioService.buildStorageKey(
      data.workspaceId,
      documentId,
      data.file.originalname,
    );

    await this.minioService.uploadObject(
      storageKey,
      data.file.buffer,
      data.file.mimetype,
    );

    // Chuẩn hóa type: documentType lạ → general; retrievalTypes rỗng → map từ documentType.
    const documentType = normalizeDocumentType(data.documentType);
    const retrievalTypes = normalizeRetrievalTypes(
      data.retrievalTypes,
      documentType,
    );

    const document = await this.prisma.knowledge_documents.create({
      data: {
        id: documentId,
        workspace_id: data.workspaceId,
        user_id: data.userId,
        original_name: data.file.originalname,
        mimetype: data.file.mimetype,
        size: Number(data.file.size),
        storage_key: storageKey,
        status: 'PENDING',
        chunk_count: 0,
        document_type: documentType,
        retrieval_types: retrievalTypes,
      },
    });

    void this.ingestionService.enqueueIngest(document).catch(() => undefined);

    return { document: this.toResponse(document) };
  }

  async findAll(data: { userId: string; workspaceId: string }) {
    const documents = await this.prisma.knowledge_documents.findMany({
      where: {
        user_id: data.userId,
        workspace_id: data.workspaceId,
      },
      orderBy: { created_at: 'desc' },
    });

    return { documents: documents.map((doc) => this.toResponse(doc)) };
  }

  async findOne(data: { userId: string; documentId: string }) {
    const document = await this.getOwnedDocument(data.userId, data.documentId);
    return { document: this.toResponse(document) };
  }

  async getStatus(data: { userId: string; documentId: string }) {
    const document = await this.getOwnedDocument(data.userId, data.documentId);
    return {
      documentId: document.id,
      status: document.status,
      errorMessage: document.error_message ?? '',
      chunkCount: document.chunk_count,
      updatedAt: document.updated_at.toISOString(),
    };
  }

  async getDownloadUrl(data: {
    userId: string;
    documentId: string;
    expiresInSeconds?: number;
  }) {
    const document = await this.getOwnedDocument(data.userId, data.documentId);
    const expiresIn = clampDownloadTtl(data.expiresInSeconds);
    const url = await this.minioService.getPresignedGetUrl(
      document.storage_key,
      expiresIn,
    );
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      url,
      expiresIn,
      originalName: document.original_name,
      mimetype: document.mimetype,
      expiresAt,
    };
  }

  async delete(data: { userId: string; documentId: string }) {
    const document = await this.getOwnedDocument(data.userId, data.documentId);

    void this.ingestionService
      .enqueueDeleteVectors(document)
      .catch(() => undefined);

    await this.minioService.deleteObject(document.storage_key);
    await this.prisma.knowledge_documents.delete({
      where: { id: document.id },
    });

    return { success: true };
  }

  async assertDocumentsReadyForQuery(
    workspaceId: string,
    documentIds?: string[],
  ) {
    if (!documentIds?.length) {
      return;
    }

    const documents = await this.prisma.knowledge_documents.findMany({
      where: {
        id: { in: documentIds },
        workspace_id: workspaceId,
      },
    });

    if (documents.length !== documentIds.length) {
      throw new BadRequestException('Document not found or not accessible.');
    }

    const processing = documents.filter((doc) => doc.status === 'PROCESSING');
    if (processing.length) {
      throw new BadRequestException(
        'Document is still processing. Please try again later.',
      );
    }

    const failed = documents.filter((doc) => doc.status === 'FAILED');
    if (failed.length) {
      throw new BadRequestException(
        'Document ingestion failed. Please retry ingestion.',
      );
    }

    const notReady = documents.filter(
      (doc) => !READY_DOCUMENT_STATUSES.has(doc.status),
    );
    if (notReady.length) {
      throw new BadRequestException(
        `Documents must be READY/COMPLETED before query: ${notReady
          .map((doc) => `${doc.id}(${doc.status})`)
          .join(', ')}`,
      );
    }
  }

  async getOwnedDocument(userId: string, documentId: string) {
    const document = await this.prisma.knowledge_documents.findUnique({
      where: { id: documentId },
    });
    if (!document || document.user_id !== userId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async getDocumentById(documentId: string) {
    const document = await this.prisma.knowledge_documents.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async updateDocumentStatus(
    documentId: string,
    status: string,
    extra?: { chunkCount?: number; errorMessage?: string },
  ) {
    try {
      return await this.prisma.knowledge_documents.update({
        where: { id: documentId },
        data: {
          status,
          ...(extra?.chunkCount !== undefined
            ? { chunk_count: extra.chunkCount }
            : {}),
          ...(extra?.errorMessage !== undefined
            ? { error_message: extra.errorMessage || null }
            : {}),
        },
      });
    } catch {
      throw new NotFoundException('Document not found');
    }
  }

  private toResponse(document: knowledge_documents) {
    return {
      id: document.id,
      workspaceId: document.workspace_id,
      userId: document.user_id,
      originalName: document.original_name,
      mimetype: document.mimetype,
      // Number() so gRPC/HTTP never emit Long / BigInt for size.
      size: Number(document.size) || 0,
      // Raw DB status: PENDING | PROCESSING | COMPLETED | FAILED (READY legacy alias accepted).
      status: document.status,
      chunkCount: Number(document.chunk_count) || 0,
      errorMessage: document.error_message ?? '',
      documentType: document.document_type,
      retrievalTypes: parseRetrievalTypes(document.retrieval_types),
      createdAt: document.created_at.toISOString(),
      updatedAt: document.updated_at.toISOString(),
    };
  }
}

/** retrieval_types lưu dạng Json (Prisma.JsonValue) nên phải parse an toàn về string[]. */
export function parseRetrievalTypes(
  value: Prisma.JsonValue | null | undefined,
): RetrievalType[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is RetrievalType => typeof item === 'string',
  );
}

function clampDownloadTtl(requested?: number): number {
  const fallback = KNOWLEDGE_DOWNLOAD_URL_TTL_SECONDS;
  if (
    requested === undefined ||
    requested === null ||
    !Number.isFinite(requested)
  ) {
    return fallback;
  }
  const seconds = Math.floor(Number(requested));
  if (seconds < MIN_DOWNLOAD_TTL_SECONDS) {
    return MIN_DOWNLOAD_TTL_SECONDS;
  }
  if (seconds > MAX_DOWNLOAD_TTL_SECONDS) {
    return MAX_DOWNLOAD_TTL_SECONDS;
  }
  return seconds;
}
