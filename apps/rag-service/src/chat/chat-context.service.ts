import { Injectable } from '@nestjs/common';
import {
  PREFERENCE_BEARING_INTENTS,
  type ExtractedRequirements,
  type RagIntent,
} from '../rag-engine/rag-engine.types';
import { AiChatRepository } from './ai-chat.repository';
import {
  MAX_AMBIGUOUS_RECENT_MESSAGES,
  MAX_HISTORY_TOKENS,
  MAX_RECENT_MESSAGES,
} from './chat.types';
import type {
  ChatContext,
  ChatHistoryMessage,
  UserPreferences,
} from './chat.types';

const AMBIGUOUS_FOLLOW_UP_PATTERNS = [
  /^mẫu nào/i,
  /^vậy /i,
  /^còn /i,
  /^thế còn/i,
  /^gói đó/i,
  /^cái (đó|đầu|thứ|này)/i,
  /hợp không\??$/i,
  /hợp hơn\??$/i,
  /bao nhiêu\??$/i,
  /có bảo hành không\??$/i,
  /màu đó/i,
  /thì sao\??$/i,
  /có đắt không\??$/i,
  /mẫu đó thì sao/i,
];

@Injectable()
export class ChatContextService {
  constructor(private readonly aiChatRepository: AiChatRepository) {}

  async buildChatContext(
    sessionId: string,
    question: string,
  ): Promise<ChatContext> {
    const limit = this.isAmbiguousFollowUp(question)
      ? MAX_AMBIGUOUS_RECENT_MESSAGES
      : MAX_RECENT_MESSAGES;

    const recentRows = await this.aiChatRepository.findRecentMessages(
      sessionId,
      limit,
    );
    const history = this.getRecentMessagesFromRows(recentRows, limit);
    const trimmed = this.trimMessagesByTokenBudget(history, MAX_HISTORY_TOKENS);

    return {
      chatHistory: trimmed,
      conversationSummary:
        await this.aiChatRepository.getSessionSummary(sessionId),
      userPreferences:
        await this.aiChatRepository.getSessionPreferences(sessionId),
      lastIntent: await this.aiChatRepository.getLastIntent(sessionId),
    };
  }

  getRecentMessagesFromRows(
    rows: Array<{ sender: string | null; message: string | null }>,
    limit = MAX_RECENT_MESSAGES,
  ): ChatHistoryMessage[] {
    return rows.slice(-limit).map((row) => ({
      role: this.normalizeRole(row.sender ?? 'user'),
      content: row.message ?? '',
    }));
  }

  isAmbiguousFollowUp(question: string): boolean {
    const normalized = question.trim();
    return AMBIGUOUS_FOLLOW_UP_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  }

  estimateTokens(text: string): number {
    return Math.ceil((text || '').length / 4);
  }

  trimMessagesByTokenBudget(
    messages: ChatHistoryMessage[],
    maxTokens = MAX_HISTORY_TOKENS,
  ): ChatHistoryMessage[] {
    let total = 0;
    const kept: ChatHistoryMessage[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = this.estimateTokens(message.content);
      if (total + tokens > maxTokens && kept.length > 0) {
        break;
      }
      kept.unshift(message);
      total += tokens;
    }

    return kept;
  }

  mergePreferences(
    oldPreferences: UserPreferences,
    extracted: ExtractedRequirements,
    currentIntent: RagIntent,
  ): UserPreferences {
    const merged: UserPreferences = { ...oldPreferences };

    // Policy/package/general Q&A should not wipe ring preferences.
    if (
      !PREFERENCE_BEARING_INTENTS.includes(currentIntent) &&
      currentIntent !== 'GENERAL_RAG_QA'
    ) {
      return merged;
    }

    for (const [key, value] of Object.entries(extracted ?? {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      merged[key] = value;
    }

    return merged;
  }

  isIntentSwitch(
    currentIntent: string | null | undefined,
    lastIntent: string | null | undefined,
  ): boolean {
    if (!currentIntent || !lastIntent) {
      return false;
    }
    return currentIntent !== lastIntent;
  }

  private normalizeRole(role: string): ChatHistoryMessage['role'] {
    if (role === 'assistant' || role === 'system') {
      return role;
    }
    return 'user';
  }
}
