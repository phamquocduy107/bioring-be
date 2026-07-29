import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  PackageCandidate,
  ProductCandidate,
} from '../catalog/catalog.types';
import { PackageCatalogService } from '../catalog/package-catalog.service';
import { ProductRecommendationService } from '../catalog/product-recommendation.service';
import { DocumentsService } from '../documents/documents.service';
import { RagEngineClient } from '../rag-engine/rag-engine.client';
import type {
  IntentDetectionResponse,
  RagQueryRequest,
  RagQueryResponse,
} from '../rag-engine/rag-engine.types';
import { retrievalOptionsForIntent } from '../rag-engine/rag-engine.types';
import { AiChatRepository } from './ai-chat.repository';
import { ChatContextService } from './chat-context.service';
import type {
  ChatAskPayload,
  ChatAskResponse,
  ChatHistoryMessage,
  RagSource,
  UserPreferences,
} from './chat.types';
import { MAX_PACKAGE_CANDIDATES, MAX_PRODUCT_CANDIDATES } from './chat.types';
import { ConversationSummaryService } from './conversation-summary.service';
import { WorkspacePermissionService } from './workspace-permission.service';
import { buildEmptyProductSuggestionChips } from './suggestion-chips.util';
import type { ClarificationData } from '../rag-engine/rag-engine.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly ragEngineClient: RagEngineClient,
    private readonly chatContextService: ChatContextService,
    private readonly productRecommendationService: ProductRecommendationService,
    private readonly packageCatalogService: PackageCatalogService,
    private readonly documentsService: DocumentsService,
    private readonly aiChatRepository: AiChatRepository,
    private readonly workspacePermissionService: WorkspacePermissionService,
    private readonly conversationSummaryService: ConversationSummaryService,
  ) {}

  async createSession(data: {
    userId?: string;
    guestSessionId?: string;
    workspaceId: string;
    title?: string;
  }) {
    const session = await this.aiChatRepository.createSession(data);
    return { session: this.toSessionResponse(session) };
  }

  async findSessions(data: {
    userId?: string;
    guestSessionId?: string;
    workspaceId: string;
  }) {
    const guestSessionId = data.guestSessionId?.trim();
    const userId = data.userId?.trim();
    if (!guestSessionId && !userId) {
      throw new BadRequestException('userId or guestSessionId is required');
    }
    const sessions = guestSessionId
      ? await this.aiChatRepository.findSessionsByGuestAndWorkspace({
          guestSessionId,
          workspaceId: data.workspaceId,
        })
      : await this.aiChatRepository.findSessionsByUserAndWorkspace({
          userId: userId!,
          workspaceId: data.workspaceId,
        });
    return {
      sessions: sessions.map((session) => this.toSessionResponse(session)),
    };
  }

  async getMessages(data: {
    userId?: string;
    guestSessionId?: string;
    sessionId: string;
    limit?: number;
    before?: string;
  }) {
    await this.aiChatRepository.findSessionForOwner({
      sessionId: data.sessionId,
      userId: data.userId,
      guestSessionId: data.guestSessionId,
    });
    const limit = data.limit && data.limit > 0 ? data.limit : 50;
    const page = await this.aiChatRepository.findMessagesPage(
      data.sessionId,
      limit,
      data.before,
    );
    return {
      messages: page.messages.map((message) => this.toMessageResponse(message)),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  }

  async ask(data: ChatAskPayload): Promise<ChatAskResponse> {
    // Validate dữ liệu đầu vào ở rag-service trước khi tạo session/gọi Python.
    this.validateAskInput(data);

    const isGuest = !!data.guestSessionId?.trim();
    const ownerUserId = data.userId?.trim() || '';

    // Kiểm tra quyền truy cập workspace ở NestJS; Python rag-engine không xử lý authorization.
    // await this.workspacePermissionService.assertUserCanAccessWorkspace(
    //   data.userId,
    //   data.workspaceId,
    // );

    // Guest chat chỉ hỏi knowledge workspace chung — không cho documentIds theo user.
    const documentIds = isGuest ? undefined : data.documentIds;

    if (documentIds?.length) {
      // Nếu FE giới hạn documentIds, kiểm tra user có quyền đọc các tài liệu này.
      await this.workspacePermissionService.assertUserCanAccessDocuments(
        ownerUserId,
        data.workspaceId,
        documentIds,
      );

      // Chỉ cho phép hỏi khi tài liệu knowledge đã ingest/vector hóa xong.
      await this.documentsService.assertDocumentsReadyForQuery(
        data.workspaceId,
        documentIds,
      );
    }

    // Lấy session hiện có hoặc tạo session mới; đây là nghiệp vụ chat của rag-service.
    const session = data.chatSessionId
      ? await this.aiChatRepository.findSessionForOwner({
          sessionId: data.chatSessionId,
          userId: ownerUserId || undefined,
          guestSessionId: data.guestSessionId,
        })
      : await this.aiChatRepository.createSession({
          userId: ownerUserId || undefined,
          guestSessionId: data.guestSessionId,
          workspaceId: data.workspaceId,
          title: data.question.slice(0, 80),
        });

    const askData: ChatAskPayload = {
      ...data,
      userId: ownerUserId || `guest:${data.guestSessionId}`,
      documentIds,
    };

    // Build context ngắn để gửi sang Python: recent history, summary, preferences, lastIntent.
    const context = await this.chatContextService.buildChatContext(
      session.id,
      askData.question,
    );

    // Gọi Python rag-engine để detect intent/slot bằng rules-first; Nest không gọi LLM trực tiếp.
    const detected = await this.ragEngineClient.detectIntent({
      question: askData.question,
      chatHistory: context.chatHistory,
      conversationSummary: context.conversationSummary,
      userPreferences: context.userPreferences,
      lastIntent: context.lastIntent,
      language: 'vi',
    });

    // Theo dõi chuyển intent nhưng không reset preferences đã lưu trong session.
    const currentIntent = detected.intent;
    const lastIntent = context.lastIntent ?? null;
    const intentSwitch = this.chatContextService.isIntentSwitch(
      currentIntent,
      lastIntent,
    );

    if (intentSwitch) {
      this.handleIntentSwitch(currentIntent, lastIntent, session.id);
    }

    this.logger.log(
      `chat ask session=${session.id} intent=${currentIntent} lastIntent=${lastIntent ?? 'none'} ` +
        `intentSwitch=${intentSwitch} historyMessages=${context.chatHistory.length} ` +
        `clarify=${!!detected.shouldAskClarifyingQuestion} ` +
        `intentSource=${detected.source ?? 'unknown'} llmUsed=${!!detected.llmUsed}`,
    );

    // Lưu user message trước khi gọi query để session có đầy đủ lịch sử hội thoại.
    const userMessage = await this.aiChatRepository.createMessage({
      sessionId: session.id,
      role: 'user',
      content: askData.question,
      intent: currentIntent,
    });
    void userMessage;

    // Merge slot vừa extract vào preferences; policy/package không xóa nhu cầu chọn nhẫn trước đó.
    const mergedPreferences = this.chatContextService.mergePreferences(
      context.userPreferences,
      detected.extractedRequirements ?? {},
      currentIntent,
      askData.question,
    );
    await this.aiChatRepository.updateSessionPreferences(
      session.id,
      mergedPreferences,
    );

    // Điều phối theo intent: rag-service tìm product/package candidates, Python trả final answer.
    const ragResult = await this.dispatchByIntent({
      data: askData,
      sessionId: session.id,
      chatHistory: context.chatHistory,
      conversationSummary: context.conversationSummary,
      userPreferences: mergedPreferences,
      lastIntent,
      detected,
    });
    const usageLlmCalls = ragResult.usage?.['llmCalls'];
    const llmCallsForLog =
      ragResult.debug?.llmCalls ??
      (typeof usageLlmCalls === 'string' || typeof usageLlmCalls === 'number'
        ? usageLlmCalls
        : 'n/a');

    this.logger.log(
      `chat result session=${session.id} type=${ragResult.type} ` +
        `products=${ragResult.suggestedProducts?.length ?? 0} ` +
        `packages=${ragResult.suggestedPackages?.length ?? 0} ` +
        `clarify=${!!ragResult.shouldAskClarifyingQuestion} ` +
        `llmCalls=${llmCallsForLog} ` +
        `rewrite=${ragResult.debug?.rewriteUsed ?? false} ` +
        `cacheHit=${ragResult.debug?.cacheHit ?? false}`,
    );

    // Lưu assistant message kèm metadata để FE xem lại sources/sản phẩm/gói khi load lịch sử.
    const assistantMessage = await this.aiChatRepository.createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: ragResult.answer,
      intent: currentIntent,
      type: ragResult.type,
      metadata: {
        intent: currentIntent,
        type: ragResult.type,
        sources: ragResult.sources ?? [],
        suggestedProducts: ragResult.suggestedProducts ?? [],
        suggestedPackages: ragResult.suggestedPackages ?? [],
        productFilters: ragResult.productFilters ?? {},
        missingFields: ragResult.missingFields ?? [],
        clarificationData: (ragResult.clarificationData ??
          null) as Record<string, unknown> | null,
        suggestionChips: ragResult.suggestionChips ?? [],
        usage: ragResult.usage ?? null,
      },
    });

    // Cập nhật session state phục vụ danh sách chat và follow-up intent ở lượt sau.
    await this.aiChatRepository.updateSessionLastMessage(
      session.id,
      ragResult.answer,
    );
    await this.aiChatRepository.updateSessionIntent(session.id, {
      currentIntent,
      lastIntent: lastIntent ?? currentIntent,
    });

    // Summary chạy nền, không chặn response chat hiện tại.
    void this.conversationSummaryService.maybeRegenerateSummary(session.id);

    // Chuẩn hóa response theo contract hiện tại với FE/API gateway.
    return {
      messageId: assistantMessage.id,
      sessionId: session.id,
      type: ragResult.type,
      intent: currentIntent,
      answer: ragResult.answer,
      sources: this.normalizeSources(ragResult.sources),
      suggestedProducts: this.normalizeProducts(ragResult.suggestedProducts),
      suggestedPackages: this.normalizePackages(ragResult.suggestedPackages),
      missingFields: ragResult.missingFields ?? [],
      productFiltersJson: JSON.stringify(ragResult.productFilters ?? {}),
      shouldAskClarifyingQuestion: !!ragResult.shouldAskClarifyingQuestion,
      clarificationDataJson: ragResult.clarificationData
        ? JSON.stringify(ragResult.clarificationData)
        : '',
      suggestionChipsJson:
        ragResult.suggestionChips && ragResult.suggestionChips.length > 0
          ? JSON.stringify(ragResult.suggestionChips)
          : '',
    };
  }

  /**
   * Production mặc định không trả sources cho FE.
   * Bật lại bằng CHAT_INCLUDE_SOURCES=true (dev/debug).
   */
  private shouldIncludeSources(): boolean {
    const flag = process.env.CHAT_INCLUDE_SOURCES?.trim().toLowerCase();
    if (flag === 'true' || flag === '1' || flag === 'yes') return true;
    if (flag === 'false' || flag === '0' || flag === 'no') return false;
    const env = (
      process.env.NODE_ENV ||
      process.env.APP_ENV ||
      ''
    ).toLowerCase();
    return env !== 'production' && env !== 'prod';
  }
  private handleIntentSwitch(
    currentIntent: string,
    lastIntent: string | null,
    sessionId: string,
  ) {
    this.logger.log(
      `Intent switch session=${sessionId}: ${lastIntent} -> ${currentIntent}`,
    );
  }

  private async dispatchByIntent(params: {
    data: ChatAskPayload;
    sessionId: string;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    // Rag-service quyết định nghiệp vụ theo intent; Python chỉ nhận payload đã có context/candidates.
    switch (params.detected.intent) {
      case 'RING_RECOMMENDATION':
        return this.handleRingRecommendation(params);
      case 'GEMSTONE_ADVICE':
        return this.handleGemstoneAdvice(params);
      case 'PACKAGE_QA':
        return this.handlePackageQA(params);
      case 'POLICY_QA':
        return this.handlePolicyQA(params);
      case 'GENERAL_RAG_QA':
      default:
        return this.handleGeneralRagQA(params);
    }
  }

  private async handleRingRecommendation(params: {
    data: ChatAskPayload;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    const { detected } = params;

    if (detected.shouldAskClarifyingQuestion) {
      return {
        type: 'clarification',
        intent: 'RING_RECOMMENDATION',
        answer:
          detected.clarificationQuestion ||
          'Mình cần thêm thông tin để tư vấn phù hợp nhất cho bạn.',
        sources: [],
        suggestedProducts: [],
        suggestedPackages: [],
        missingFields: detected.missingFields ?? [],
        productFilters: detected.productFilters ?? {},
        shouldAskClarifyingQuestion: true,
        clarificationData: detected.clarificationData ?? null,
      };
    }

    // Với tư vấn nhẫn, NestJS tìm ứng viên sản phẩm từ catalog trước khi gửi sang Python.
    const productCandidates =
      await this.productRecommendationService.searchRings(
        detected.productFilters ?? {},
      );

    const ragResult = await this.callRagQuery(params, {
      retrievalTypes: detected.retrievalTypes?.length
        ? detected.retrievalTypes
        : ['ring_guide', 'gemstone_guide'],
      productCandidates,
      packageCandidates: [],
    });

    // Hết sản phẩm khớp → trả chip nới filter theo productFilters đang active.
    if ((ragResult.suggestedProducts?.length ?? 0) === 0) {
      ragResult.suggestionChips = buildEmptyProductSuggestionChips(
        detected.productFilters ?? {},
      );
    }

    return ragResult;
  }

  private async handleGemstoneAdvice(params: {
    data: ChatAskPayload;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    const { detected } = params;
    let productCandidates: ProductCandidate[] = [];
    const filters = detected.productFilters ?? {};
    if (filters.stoneColor || filters.stoneName) {
      // Nếu câu hỏi về đá có slot màu/tên đá, kèm sản phẩm liên quan để LLM không tự bịa catalog.
      productCandidates =
        await this.productRecommendationService.searchRings(filters);
    }

    return this.callRagQuery(params, {
      retrievalTypes: detected.retrievalTypes?.length
        ? detected.retrievalTypes
        : ['gemstone_guide', 'ring_guide'],
      productCandidates,
      packageCandidates: [],
    });
  }

  private async handlePackageQA(params: {
    data: ChatAskPayload;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    // Package catalog thuộc nghiệp vụ NestJS; Python chỉ dùng candidates/context để trả lời.
    const packageCandidates = await this.packageCatalogService.searchPackages(
      params.detected.productFilters,
    );

    return this.callRagQuery(params, {
      retrievalTypes: params.detected.retrievalTypes?.length
        ? params.detected.retrievalTypes
        : ['package', 'policy'],
      productCandidates: [],
      packageCandidates,
    });
  }

  private async handlePolicyQA(params: {
    data: ChatAskPayload;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    // Policy QA không cần product/package candidates; Python chỉ dùng policy context từ Qdrant.
    return this.callRagQuery(params, {
      retrievalTypes: params.detected.retrievalTypes?.length
        ? params.detected.retrievalTypes
        : ['policy'],
      productCandidates: [],
      packageCandidates: [],
    });
  }

  private async handleGeneralRagQA(params: {
    data: ChatAskPayload;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences: UserPreferences;
    lastIntent?: string | null;
    detected: IntentDetectionResponse;
  }): Promise<RagQueryResponse> {
    // Câu hỏi chung chỉ gửi retrievalTypes general; không kèm catalog để giảm prompt.
    return this.callRagQuery(params, {
      retrievalTypes: params.detected.retrievalTypes?.length
        ? params.detected.retrievalTypes
        : ['general'],
      productCandidates: [],
      packageCandidates: [],
    });
  }

  private async callRagQuery(
    params: {
      data: ChatAskPayload;
      chatHistory: ChatHistoryMessage[];
      conversationSummary?: string;
      userPreferences: UserPreferences;
      lastIntent?: string | null;
      detected: IntentDetectionResponse;
    },
    extras: {
      retrievalTypes: string[];
      productCandidates: ProductCandidate[];
      packageCandidates: PackageCandidate[];
    },
  ): Promise<RagQueryResponse> {
    // Ranh giới NestJS → Python: từ đây Python xử lý retrieval, prompt và final LLM answer.
    const payload = this.buildRagQueryPayload(params, extras);
    return this.ragEngineClient.query(payload);
  }

  private buildRagQueryPayload(
    params: {
      data: ChatAskPayload;
      chatHistory: ChatHistoryMessage[];
      conversationSummary?: string;
      userPreferences: UserPreferences;
      lastIntent?: string | null;
      detected: IntentDetectionResponse;
    },
    extras: {
      retrievalTypes: string[];
      productCandidates: ProductCandidate[];
      packageCandidates: PackageCandidate[];
    },
  ): RagQueryRequest {
    const {
      data,
      chatHistory,
      conversationSummary,
      userPreferences,
      detected,
    } = params;
    const options = retrievalOptionsForIntent(detected.intent);

    // Payload gửi Python đã được rút gọn: không gửi full history hay full product object.
    return {
      requestId: this.ragEngineClient.createRequestId(),
      userId: data.userId ?? '',
      workspaceId: data.workspaceId,
      documentIds: data.documentIds ?? [],
      question: data.question,
      chatHistory,
      conversationSummary,
      userPreferences,
      lastIntent: params.lastIntent,
      intentOverride: detected.intent,
      extractedRequirements: detected.extractedRequirements ?? {},
      retrievalTypes: extras.retrievalTypes,
      productFilters: detected.productFilters ?? {},
      missingFields: detected.missingFields ?? [],
      productCandidates: this.slimProductCandidates(extras.productCandidates),
      packageCandidates: this.slimPackageCandidates(extras.packageCandidates),
      options: {
        topK: options.topK,
        scoreThreshold: options.scoreThreshold,
        language: 'vi',
      },
    };
  }

  private slimProductCandidates(
    products: ProductCandidate[],
  ): ProductCandidate[] {
    // Chỉ giữ field cần thiết cho prompt/FE; tránh đẩy mô tả dài hoặc metadata catalog sang LLM.
    return products.slice(0, MAX_PRODUCT_CANDIDATES).map((product) => {
      const short =
        product.shortDescription ||
        (product.description ? product.description.slice(0, 280) : undefined);
      return {
        id: product.id,
        name: product.name,
        price: product.price,
        material: product.material,
        style: product.style,
        purpose: product.purpose,
        stoneName: product.stoneName,
        stoneColor: product.stoneColor,
        imageUrl: product.imageUrl,
        tags: (product.tags ?? []).slice(0, 10),
        shortDescription: short,
      };
    });
  }

  private slimPackageCandidates(
    packages: PackageCandidate[],
  ): PackageCandidate[] {
    // Package candidates cũng được giới hạn để prompt final answer ngắn và ổn định.
    return packages.slice(0, MAX_PACKAGE_CANDIDATES).map((pkg) => {
      const short =
        pkg.shortDescription ||
        (pkg.description ? pkg.description.slice(0, 280) : undefined);
      return {
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        includedServices: (pkg.includedServices ?? []).slice(0, 12),
        estimatedDays: pkg.estimatedDays,
        warranty: pkg.warranty,
        shortDescription: short,
      };
    });
  }

  private validateAskInput(data: ChatAskPayload) {
    if (!data.userId?.trim() && !data.guestSessionId?.trim()) {
      throw new BadRequestException('userId or guestSessionId is required');
    }
    if (!data.workspaceId?.trim()) {
      throw new BadRequestException('workspaceId is required');
    }
    if (!data.question?.trim()) {
      throw new BadRequestException('question is required');
    }
  }

  private toSessionResponse(session: {
    id: string;
    workspace_id: string | null;
    user_id: string | null;
    guest_session_id?: string | null;
    topic: string | null;
    created_at: Date | null;
    updated_at: Date | null;
  }) {
    return {
      id: session.id,
      workspaceId: session.workspace_id ?? '',
      userId: session.user_id ?? '',
      guestSessionId: session.guest_session_id ?? '',
      title: session.topic ?? 'New chat',
      createdAt: (session.created_at ?? new Date()).toISOString(),
      updatedAt: (session.updated_at ?? new Date()).toISOString(),
    };
  }

  private toMessageResponse(message: {
    id: string;
    ai_session_id: string;
    sender: string | null;
    message: string | null;
    metadata: unknown;
    created_at: Date | null;
  }) {
    const metadata = this.aiChatRepository.parseMetadata(message.metadata);
    const extras = {
      productFilters: metadata.productFilters ?? {},
      missingFields: metadata.missingFields ?? [],
      clarificationData: metadata.clarificationData ?? null,
      suggestionChips: metadata.suggestionChips ?? [],
    };
    return {
      id: message.id,
      sessionId: message.ai_session_id,
      role: message.sender ?? 'user',
      content: message.message ?? '',
      intent: metadata.intent ?? '',
      type: metadata.type ?? '',
      sources: this.normalizeSources(metadata.sources),
      suggestedProducts: this.normalizeProducts(metadata.suggestedProducts),
      suggestedPackages: this.normalizePackages(metadata.suggestedPackages),
      metadataJson: JSON.stringify(extras),
      createdAt: (message.created_at ?? new Date()).toISOString(),
    };
  }

  private normalizeSources(sources?: RagSource[]) {
    if (!this.shouldIncludeSources()) {
      return [];
    }
    return (sources ?? []).map((source) => ({
      documentId: source.documentId ?? '',
      source: source.source ?? '',
      page: source.page ?? 0,
      chunkIndex: source.chunkIndex ?? 0,
      score: source.score ?? 0,
      contentPreview: source.contentPreview ?? '',
    }));
  }

  private normalizeProducts(products?: ProductCandidate[]) {
    return (products ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      description: product.shortDescription ?? product.description ?? '',
      shortDescription: product.shortDescription ?? product.description ?? '',
      price: product.price ?? 0,
      material: product.material ?? '',
      style: product.style ?? '',
      purpose: product.purpose ?? '',
      stoneName: product.stoneName ?? '',
      stoneColor: product.stoneColor ?? '',
      imageUrl: product.imageUrl ?? '',
      tags: product.tags ?? [],
      reason: product.reason ?? '',
    }));
  }

  private normalizePackages(packages?: PackageCandidate[]) {
    return (packages ?? []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.shortDescription ?? pkg.description ?? '',
      shortDescription: pkg.shortDescription ?? pkg.description ?? '',
      price: pkg.price ?? 0,
      includedServices: pkg.includedServices ?? [],
      estimatedDays: pkg.estimatedDays ?? 0,
      warranty: pkg.warranty ?? '',
    }));
  }
}
