import { getKnowledgeWorkspaceId } from '@app/common';
import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

export interface KnowledgeDocument {
  id: string;
  workspaceId: string;
  userId: string;
  originalName: string;
  mimetype: string;
  size: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface KnowledgeGrpcService {
  uploadDocument(data: {
    userId: string;
    workspaceId: string;
    file: UploadedFilePayload;
  }): Observable<{ document: KnowledgeDocument }>;
  findAllDocuments(data: {
    userId: string;
    workspaceId: string;
  }): Observable<{ documents: KnowledgeDocument[] }>;
  findOneDocument(data: {
    userId: string;
    documentId: string;
  }): Observable<{ document: KnowledgeDocument }>;
  getDocumentStatus(data: {
    userId: string;
    documentId: string;
  }): Observable<{
    documentId: string;
    status: string;
    errorMessage: string;
    chunkCount: number;
    updatedAt: string;
  }>;
  deleteDocument(data: {
    userId: string;
    documentId: string;
  }): Observable<{ success: boolean }>;
  retryIngestion(data: {
    userId: string;
    documentId: string;
  }): Observable<{ document: KnowledgeDocument }>;
  reindexDocument(data: {
    userId: string;
    documentId: string;
  }): Observable<{ document: KnowledgeDocument }>;
  createChatSession(data: {
    userId: string;
    workspaceId: string;
    title?: string;
  }): Observable<{ session: ChatSession }>;
  findChatSessions(data: {
    userId: string;
    workspaceId: string;
  }): Observable<{ sessions: ChatSession[] }>;
  getChatMessages(data: {
    userId: string;
    sessionId: string;
  }): Observable<{ messages: ChatMessage[] }>;
  askQuestion(data: {
    userId: string;
    workspaceId: string;
    chatSessionId?: string;
    documentIds?: string[];
    question: string;
  }): Observable<{
    messageId: string;
    sessionId: string;
    type: string;
    intent: string;
    answer: string;
    sources: Array<{
      documentId: string;
      source: string;
      page: number;
      chunkIndex: number;
      score: number;
      contentPreview: string;
    }>;
    suggestedProducts: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      material: string;
      style: string;
      purpose: string;
      stoneName: string;
      stoneColor: string;
      imageUrl: string;
      tags: string[];
      reason: string;
    }>;
    suggestedPackages: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      includedServices: string[];
      estimatedDays: number;
      warranty: string;
    }>;
    missingFields: string[];
    productFiltersJson: string;
    shouldAskClarifyingQuestion: boolean;
  }>;
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private grpc?: KnowledgeGrpcService;

  constructor(
    @Optional()
    @Inject('KNOWLEDGE_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc =
      this.client?.getService<KnowledgeGrpcService>('KnowledgeService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc) {
      throw new Error('KNOWLEDGE_SERVICE gRPC client is not initialized');
    }
    return lastValueFrom(fn());
  }

  // Documents
  uploadDocument(userId: string, file: UploadedFilePayload) {
    const workspaceId = getKnowledgeWorkspaceId();
    return this.call(() =>
      this.grpc!.uploadDocument({ userId, workspaceId, file }),
    );
  }

  findAllDocuments(userId: string) {
    const workspaceId = getKnowledgeWorkspaceId();
    return this.call(() =>
      this.grpc!.findAllDocuments({ userId, workspaceId }),
    );
  }

  findOneDocument(userId: string, documentId: string) {
    return this.call(() =>
      this.grpc!.findOneDocument({ userId, documentId }),
    );
  }

  getDocumentStatus(userId: string, documentId: string) {
    return this.call(() =>
      this.grpc!.getDocumentStatus({ userId, documentId }),
    );
  }

  deleteDocument(userId: string, documentId: string) {
    return this.call(() => this.grpc!.deleteDocument({ userId, documentId }));
  }

  retryIngestion(userId: string, documentId: string) {
    return this.call(() => this.grpc!.retryIngestion({ userId, documentId }));
  }

  reindexDocument(userId: string, documentId: string) {
    return this.call(() => this.grpc!.reindexDocument({ userId, documentId }));
  }

  // Chat
  createChatSession(userId: string, title?: string) {
    const workspaceId = getKnowledgeWorkspaceId();
    return this.call(() =>
      this.grpc!.createChatSession({ userId, workspaceId, title }),
    );
  }

  findChatSessions(userId: string) {
    const workspaceId = getKnowledgeWorkspaceId();
    return this.call(() =>
      this.grpc!.findChatSessions({ userId, workspaceId }),
    );
  }

  getChatMessages(userId: string, sessionId: string) {
    return this.call(() =>
      this.grpc!.getChatMessages({ userId, sessionId }),
    );
  }

  async askQuestion(
    userId: string,
    question: string,
    chatSessionId?: string,
    documentIds?: string[],
  ) {
    const workspaceId = getKnowledgeWorkspaceId();
    const result = await this.call(() =>
      this.grpc!.askQuestion({
        userId,
        workspaceId,
        chatSessionId,
        documentIds,
        question,
      }),
    );

    let productFilters: Record<string, unknown> = {};
    try {
      productFilters = result.productFiltersJson
        ? (JSON.parse(result.productFiltersJson) as Record<string, unknown>)
        : {};
    } catch {
      productFilters = {};
    }

    return {
      messageId: result.messageId,
      sessionId: result.sessionId,
      type: result.type,
      intent: result.intent,
      answer: result.answer,
      sources: result.sources ?? [],
      suggestedProducts: result.suggestedProducts ?? [],
      suggestedPackages: result.suggestedPackages ?? [],
      missingFields: result.missingFields ?? [],
      productFilters,
      shouldAskClarifyingQuestion: !!result.shouldAskClarifyingQuestion,
    };
  }
}
