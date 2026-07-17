import { Injectable } from '@nestjs/common';
import { knowledge_documents } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { IngestionQueueService } from './ingestion-queue.service';

@Injectable()
export class IngestionService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ingestionQueueService: IngestionQueueService,
  ) {}

  async retry(data: { userId: string; documentId: string }) {
    const document = await this.documentsService.getOwnedDocument(
      data.userId,
      data.documentId,
    );

    await this.documentsService.updateDocumentStatus(document.id, 'PENDING', {
      errorMessage: '',
    });
    await this.ingestionQueueService.publishIngestJob(document);

    const updated = await this.documentsService.getDocumentById(document.id);
    return { document: this.toDocumentResponse(updated) };
  }

  async reindex(data: { userId: string; documentId: string }) {
    const document = await this.documentsService.getOwnedDocument(
      data.userId,
      data.documentId,
    );

    await this.documentsService.updateDocumentStatus(
      document.id,
      'PROCESSING',
      {
        errorMessage: '',
      },
    );
    await this.ingestionQueueService.publishReindexJob(document);

    const updated = await this.documentsService.getDocumentById(document.id);
    return { document: this.toDocumentResponse(updated) };
  }

  async enqueueIngest(document: knowledge_documents) {
    await this.ingestionQueueService.publishIngestJob(document);
  }

  async enqueueDeleteVectors(document: knowledge_documents) {
    await this.ingestionQueueService.publishDeleteVectorsJob(document);
  }

  private toDocumentResponse(document: knowledge_documents) {
    return {
      id: document.id,
      workspaceId: document.workspace_id,
      userId: document.user_id,
      originalName: document.original_name,
      mimetype: document.mimetype,
      size: document.size,
      status: document.status,
      createdAt: document.created_at.toISOString(),
      updatedAt: document.updated_at.toISOString(),
    };
  }
}
