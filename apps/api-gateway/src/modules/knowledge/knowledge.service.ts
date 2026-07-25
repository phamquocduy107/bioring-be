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
  chunkCount?: number;
  errorMessage?: string;
  documentType?: string;
  retrievalTypes?: string[];
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
    documentType?: string;
    retrievalTypes?: string[];
  }): Observable<{ document: KnowledgeDocument }>;
  findAllDocuments(data: {
    userId: string;
    workspaceId: string;
  }): Observable<{ documents: KnowledgeDocument[] }>;
  findOneDocument(data: {
    userId: string;
    documentId: string;
  }): Observable<{ document: KnowledgeDocument }>;
  getDocumentStatus(data: { userId: string; documentId: string }): Observable<{
    documentId: string;
    status: string;
    errorMessage: string;
    chunkCount: number;
    updatedAt: string;
  }>;
  getDocumentDownloadUrl(data: {
    userId: string;
    documentId: string;
    expiresInSeconds?: number;
  }): Observable<{
    url: string;
    expiresIn: number;
    originalName: string;
    mimetype: string;
    expiresAt: string;
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
    // Gateway lấy gRPC stub của rag-service;
    this.grpc =
      this.client?.getService<KnowledgeGrpcService>('KnowledgeService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    // Chuyển Observable gRPC thành Promise cho controller HTTP.
    if (!this.grpc) {
      throw new Error('KNOWLEDGE_SERVICE gRPC client is not initialized');
    }
    return lastValueFrom(fn());
  }

  private normalizeInt(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    if (value && typeof value === 'object') {
      const longLike = value as { low?: unknown; toNumber?: () => number };
      if (typeof longLike.toNumber === 'function') {
        const n = longLike.toNumber();
        return Number.isFinite(n) ? n : fallback;
      }
      if ('low' in longLike) {
        const low = Number(longLike.low);
        return Number.isFinite(low) ? low : fallback;
      }
    }
    return fallback;
  }

  private normalizeDocument(document: KnowledgeDocument): KnowledgeDocument {
    return {
      ...document,
      size: this.normalizeInt(document?.size, 0),
      chunkCount: this.normalizeInt(document?.chunkCount, 0),
    };
  }

  // Documents
  async uploadDocument(
    userId: string,
    file: UploadedFilePayload,
    options?: { documentType?: string; retrievalTypes?: string[] },
  ) {
    // Gateway gắn workspace mặc định rồi proxy upload PDF sang rag-service.
    const workspaceId = getKnowledgeWorkspaceId();
    const res = await this.call(() =>
      this.grpc!.uploadDocument({
        userId,
        workspaceId,
        file,
        documentType: options?.documentType,
        retrievalTypes: options?.retrievalTypes,
      }),
    );
    return { document: this.normalizeDocument(res.document) };
  }

  async findAllDocuments(userId: string) {
    // Danh sách tài liệu knowledge được lấy qua rag-service
    const workspaceId = getKnowledgeWorkspaceId();
    const res = await this.call(() =>
      this.grpc!.findAllDocuments({ userId, workspaceId }),
    );
    return {
      documents: (res.documents ?? []).map((doc) => this.normalizeDocument(doc)),
    };
  }

  async findOneDocument(userId: string, documentId: string) {
    // Proxy chi tiết tài liệu sang rag-service để giữ authorization/DB logic tập trung.
    const res = await this.call(() =>
      this.grpc!.findOneDocument({ userId, documentId }),
    );
    return { document: this.normalizeDocument(res.document) };
  }

  async getDocumentStatus(userId: string, documentId: string) {
    // Status ingestion/vector hóa được rag-service quản lý theo document.
    const res = await this.call(() =>
      this.grpc!.getDocumentStatus({ userId, documentId }),
    );
    return {
      ...res,
      chunkCount: this.normalizeInt(res.chunkCount, 0),
    };
  }

  getDocumentDownloadUrl(
    userId: string,
    documentId: string,
    expiresInSeconds?: number,
  ) {
    // Presigned MinIO URL — ownership check + signing ở rag-service.
    return this.call(() =>
      this.grpc!.getDocumentDownloadUrl({
        userId,
        documentId,
        expiresInSeconds,
      }),
    );
  }

  deleteDocument(userId: string, documentId: string) {
    // Delete document/vector cũng đi qua rag-service;
    return this.call(() => this.grpc!.deleteDocument({ userId, documentId }));
  }

  async retryIngestion(userId: string, documentId: string) {
    // Retry ingestion publish job ở rag-service/worker flow
    const res = await this.call(() =>
      this.grpc!.retryIngestion({ userId, documentId }),
    );
    return { document: this.normalizeDocument(res.document) };
  }

  async reindexDocument(userId: string, documentId: string) {
    // Reindex chỉ yêu cầu rag-service tạo job ingestion lại.
    const res = await this.call(() =>
      this.grpc!.reindexDocument({ userId, documentId }),
    );
    return { document: this.normalizeDocument(res.document) };
  }

  // Chat
  createChatSession(userId: string, title?: string) {
    // Session chat thuộc rag-service; gateway chỉ truyền user/workspace/title.
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
    // Lấy lịch sử chat từ rag-service để giữ format/metadata nhất quán.
    return this.call(() => this.grpc!.getChatMessages({ userId, sessionId }));
  }

  async askQuestion(
    userId: string,
    question: string,
    chatSessionId?: string,
    documentIds?: string[],
  ) {
    // Chat query đi HTTP gateway -> gRPC rag-service -> Python rag-engine
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

    // productFilters đi qua proto dạng JSON string nên parse lại trước khi trả HTTP.
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
