import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PackageCatalogService } from '../catalog/package-catalog.service';
import { ProductRecommendationService } from '../catalog/product-recommendation.service';
import { DocumentsService } from '../documents/documents.service';
import type {
  PackageCandidate,
  ProductCandidate,
} from '../catalog/catalog.types';
import { RagEngineClient } from '../rag-engine/rag-engine.client';
import type {
  IntentDetectionResponse,
  RagQueryRequest,
  RagQueryResponse,
} from '../rag-engine/rag-engine.types';
import { AiChatRepository } from './ai-chat.repository';
import { ChatContextService } from './chat-context.service';
import { ConversationSummaryService } from './conversation-summary.service';
import { WorkspacePermissionService } from './workspace-permission.service';
import type {
  ChatAskPayload,
  ChatAskResponse,
  ChatHistoryMessage,
  RagSource,
  UserPreferences,
} from './chat.types';

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
    userId: string;
    workspaceId: string;
    title?: string;
  }) {
    const session = await this.aiChatRepository.createSession(data);
    return { session: this.toSessionResponse(session) };
  }

  async findSessions(data: { userId: string; workspaceId: string }) {
    const sessions =
      await this.aiChatRepository.findSessionsByUserAndWorkspace(data);
    return { sessions: sessions.map((session) => this.toSessionResponse(session)) };
  }

  async getMessages(data: { userId: string; sessionId: string }) {
    await this.aiChatRepository.findSessionForUser(data.sessionId, data.userId);
    const messages = await this.aiChatRepository.findMessages(data.sessionId);
    return {
      messages: messages.map((message) => this.toMessageResponse(message)),
    };
  }

  async ask(data: ChatAskPayload): Promise<ChatAskResponse> {
    this.validateAskInput(data);

    await this.workspacePermissionService.assertUserCanAccessWorkspace(
      data.userId,
      data.workspaceId,
    );

    if (data.documentIds?.length) {
      await this.workspacePermissionService.assertUserCanAccessDocuments(
        data.userId,
        data.workspaceId,
        data.documentIds,
      );
    }

    await this.documentsService.assertDocumentsReadyForQuery(
      data.workspaceId,
      data.documentIds,
    );

    const session = data.chatSessionId
      ? await this.aiChatRepository.findSessionForUser(
          data.chatSessionId,
          data.userId,
        )
      : await this.aiChatRepository.createSession({
          userId: data.userId,
          workspaceId: data.workspaceId,
          title: data.question.slice(0, 80),
        });

    const context = await this.chatContextService.buildChatContext(
      session.id,
      data.question,
    );

    const detected = await this.ragEngineClient.detectIntent({
      question: data.question,
      chatHistory: context.chatHistory,
      conversationSummary: context.conversationSummary,
      userPreferences: context.userPreferences,
      lastIntent: context.lastIntent,
      language: 'vi',
    });

    const currentIntent = detected.intent;
    const lastIntent = context.lastIntent ?? null;

    if (this.chatContextService.isIntentSwitch(currentIntent, lastIntent)) {
      this.handleIntentSwitch(currentIntent, lastIntent, session.id);
    }

    const userMessage = await this.aiChatRepository.createMessage({
      sessionId: session.id,
      role: 'user',
      content: data.question,
      intent: currentIntent,
    });
    void userMessage;

    const mergedPreferences = this.chatContextService.mergePreferences(
      context.userPreferences,
      detected.extractedRequirements ?? {},
      currentIntent,
    );
    await this.aiChatRepository.updateSessionPreferences(
      session.id,
      mergedPreferences,
    );

    const ragResult = await this.dispatchByIntent({
      data,
      sessionId: session.id,
      chatHistory: context.chatHistory,
      conversationSummary: context.conversationSummary,
      userPreferences: mergedPreferences,
      lastIntent,
      detected,
    });

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
        usage: ragResult.usage ?? null,
      },
    });

    await this.aiChatRepository.updateSessionLastMessage(
      session.id,
      ragResult.answer,
    );
    await this.aiChatRepository.updateSessionIntent(session.id, {
      currentIntent,
      lastIntent: lastIntent ?? currentIntent,
    });

    void this.conversationSummaryService.maybeRegenerateSummary(session.id);

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
    };
  }

  /**
   * Intent switch is allowed in-session. Preferences are preserved.
   */
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
    switch (params.detected.intent) {
      case 'RING_RECOMMENDATION':
        return this.handleRingRecommendation(params);
      case 'GEMSTONE_ADVICE':
        return this.handleGemstoneAdvice(params);
      case 'PACKAGE_QA':
        return this.handlePackageQA(params);
      case 'POLICY_QA':
        return this.handlePolicyQA(params);
      case 'CUSTOM_DESIGN_CONSULTING':
        return this.handleCustomDesignConsulting(params);
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
          "Mình rất sẵn lòng tư vấn nhẫn giúp bạn. Bạn cho mình biết nhanh: nhẫn dùng cho dịp nào (cầu hôn/cưới/kỷ niệm/hằng ngày), ngân sách khoảng bao nhiêu, và bạn thích phong cách tối giản, sang trọng hay cổ điển?",
        sources: [],
        suggestedProducts: [],
        suggestedPackages: [],
        missingFields: detected.missingFields ?? [],
        productFilters: detected.productFilters ?? {},
        shouldAskClarifyingQuestion: true,
      };
    }

    const productCandidates =
      await this.productRecommendationService.searchRings(
        detected.productFilters ?? {},
      );

    return this.callRagQuery(params, {
      retrievalTypes: detected.retrievalTypes?.length
        ? detected.retrievalTypes
        : ['ring_guide', 'gemstone_guide'],
      productCandidates,
      packageCandidates: [],
    });
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
    return this.callRagQuery(params, {
      retrievalTypes: params.detected.retrievalTypes?.length
        ? params.detected.retrievalTypes
        : ['policy'],
      productCandidates: [],
      packageCandidates: [],
    });
  }

  private async handleCustomDesignConsulting(params: {
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
        intent: 'CUSTOM_DESIGN_CONSULTING',
        answer:
          detected.clarificationQuestion ||
          'Bạn muốn cá nhân hóa theo tín hiệu nào (giọng nói, vân tay), ngân sách và chất liệu ra sao?',
        sources: [],
        suggestedProducts: [],
        suggestedPackages: [],
        missingFields: detected.missingFields ?? [],
        productFilters: detected.productFilters ?? {},
        shouldAskClarifyingQuestion: true,
      };
    }

    const packageCandidates = await this.packageCatalogService.searchPackages(
      detected.productFilters,
    );

    return this.callRagQuery(params, {
      retrievalTypes: detected.retrievalTypes?.length
        ? detected.retrievalTypes
        : ['custom_design', 'package', 'policy', 'ring_guide'],
      productCandidates: [],
      packageCandidates,
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
    const { data, chatHistory, conversationSummary, userPreferences, detected } =
      params;

    return {
      requestId: this.ragEngineClient.createRequestId(),
      userId: data.userId,
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
      productCandidates: extras.productCandidates,
      packageCandidates: extras.packageCandidates,
      options: {
        topK: 5,
        scoreThreshold: 0.45,
        language: 'vi',
      },
    };
  }

  private validateAskInput(data: ChatAskPayload) {
    if (!data.userId?.trim()) {
      throw new BadRequestException('userId is required');
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
    topic: string | null;
    created_at: Date | null;
    updated_at: Date | null;
  }) {
    return {
      id: session.id,
      workspaceId: session.workspace_id ?? '',
      userId: session.user_id ?? '',
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
    return {
      id: message.id,
      sessionId: message.ai_session_id,
      role: message.sender ?? 'user',
      content: message.message ?? '',
      intent: metadata.intent ?? null,
      type: metadata.type ?? null,
      sources: metadata.sources ?? [],
      suggestedProducts: metadata.suggestedProducts ?? [],
      createdAt: (message.created_at ?? new Date()).toISOString(),
    };
  }

  private normalizeSources(sources?: RagSource[]) {
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
      description: product.description ?? '',
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
      description: pkg.description ?? '',
      price: pkg.price ?? 0,
      includedServices: pkg.includedServices ?? [],
      estimatedDays: pkg.estimatedDays ?? 0,
      warranty: pkg.warranty ?? '',
    }));
  }
}
