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
    // Follow-up mơ hồ cần thêm vài message gần nhất; câu rõ ràng chỉ lấy limit mặc định.
    const limit = this.isAmbiguousFollowUp(question)
      ? MAX_AMBIGUOUS_RECENT_MESSAGES
      : MAX_RECENT_MESSAGES;

    // Chỉ lấy role + content từ DB; không gửi sources/suggestedProducts/metadata sang Python.
    const recentRows = await this.aiChatRepository.findRecentMessages(
      sessionId,
      limit,
    );
    const history = this.getRecentMessagesFromRows(recentRows, limit);

    // Cắt history theo token budget để local LLM không bị prompt quá dài.
    const trimmed = this.trimMessagesByTokenBudget(history, MAX_HISTORY_TOKENS);

    return {
      chatHistory: trimmed,
      // Summary/preferences/lastIntent giúp Python hiểu follow-up mà không cần rewrite mặc định.
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
    // Chuẩn hóa format history gửi qua rag-engine: chỉ role + content.
    return rows.slice(-limit).map((row) => ({
      role: this.normalizeRole(row.sender ?? 'user'),
      content: row.message ?? '',
    }));
  }

  isAmbiguousFollowUp(question: string): boolean {
    // Pattern đơn giản để nhận diện câu phụ thuộc ngữ cảnh: "vậy...", "cái đó...", "hợp không?".
    const normalized = question.trim();
    return AMBIGUOUS_FOLLOW_UP_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  }

  estimateTokens(text: string): number {
    // Ước lượng nhanh token cho tiếng Việt/local LLM, không cần tokenizer thật.
    return Math.ceil((text || '').length / 4);
  }

  trimMessagesByTokenBudget(
    messages: ChatHistoryMessage[],
    maxTokens = MAX_HISTORY_TOKENS,
  ): ChatHistoryMessage[] {
    let total = 0;
    const kept: ChatHistoryMessage[] = [];

    // Duyệt từ message mới nhất về cũ nhất, sau đó unshift để giữ thứ tự thời gian.
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
    question?: string,
  ): UserPreferences {
    const merged: UserPreferences = { ...oldPreferences };

    // Policy/package/general Q&A không được xóa preference chọn nhẫn đã có trong session.
    if (
      !PREFERENCE_BEARING_INTENTS.includes(currentIntent) &&
      currentIntent !== 'GENERAL_RAG_QA'
    ) {
      return merged;
    }

    for (const [key, value] of Object.entries(extracted ?? {})) {
      // Chỉ merge slot có giá trị thật; tránh ghi đè preference bằng null/empty.
      if (value === undefined || value === null || value === '') {
        continue;
      }
      merged[key] = value;
    }

    // Follow-up nới filter: xóa slot đá/style/ngân sách cũ khỏi session để không kẹt vòng lặp.
    const q = (question || '').toLowerCase();
    if (/nới hết lọc|gần giống/.test(q)) {
      delete merged.stoneName;
      delete merged.stoneColor;
      delete merged.style;
    } else if (
      /bỏ (yêu cầu )?đá|không cần (đá|kim cương)|bỏ lọc đá/.test(q)
    ) {
      delete merged.stoneName;
      delete merged.stoneColor;
    } else if (/đổi màu đá|bỏ màu đá|bỏ lọc màu/.test(q)) {
      delete merged.stoneColor;
    } else if (/bỏ (lọc )?phong cách|không cần phong cách/.test(q)) {
      delete merged.style;
    }

    return merged;
  }

  isIntentSwitch(
    currentIntent: string | null | undefined,
    lastIntent: string | null | undefined,
  ): boolean {
    // Intent switch chỉ để log/điều phối; preferences vẫn được giữ lại.
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
