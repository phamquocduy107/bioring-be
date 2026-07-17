import { Injectable, Logger } from '@nestjs/common';
import { AiChatRepository } from './ai-chat.repository';
import {
  SUMMARY_REGENERATE_EVERY,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
} from './chat.types';
import type { UserPreferences } from './chat.types';

@Injectable()
export class ConversationSummaryService {
  private readonly logger = new Logger(ConversationSummaryService.name);

  constructor(private readonly aiChatRepository: AiChatRepository) {}

  async maybeRegenerateSummary(sessionId: string) {
    try {
      if (!(await this.shouldRegenerateSummary(sessionId))) {
        return;
      }

      const preferences =
        await this.aiChatRepository.getSessionPreferences(sessionId);
      const recent = await this.aiChatRepository.findRecentMessages(
        sessionId,
        6,
      );
      const summary = this.generateSummaryFromPreferences(
        preferences,
        recent.map((row) => ({
          role: row.sender ?? 'user',
          content: row.message ?? '',
        })),
      );

      if (summary) {
        await this.aiChatRepository.updateSessionSummary(sessionId, summary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to regenerate summary for session ${sessionId}: ${message}`,
      );
    }
  }

  async shouldRegenerateSummary(sessionId: string): Promise<boolean> {
    const count = await this.aiChatRepository.countMessages(sessionId);
    const existing = await this.aiChatRepository.getSessionSummary(sessionId);

    if (count > SUMMARY_TRIGGER_MESSAGE_COUNT && !existing) {
      return true;
    }

    if (
      existing &&
      count > SUMMARY_TRIGGER_MESSAGE_COUNT &&
      (count - SUMMARY_TRIGGER_MESSAGE_COUNT) % SUMMARY_REGENERATE_EVERY === 0
    ) {
      return true;
    }

    return false;
  }

  generateSummaryFromPreferences(
    userPreferences: UserPreferences,
    recentMessages: Array<{ role: string; content: string }> = [],
  ): string {
    const parts: string[] = [];

    if (userPreferences.purpose) {
      parts.push(`dịp/purpose: ${String(userPreferences.purpose)}`);
    }
    if (userPreferences.budgetMax != null) {
      parts.push(`ngân sách tối đa: ${String(userPreferences.budgetMax)}`);
    }
    if (userPreferences.style) {
      parts.push(`phong cách: ${String(userPreferences.style)}`);
    }
    if (userPreferences.material) {
      parts.push(`chất liệu: ${String(userPreferences.material)}`);
    }
    if (userPreferences.stoneColor || userPreferences.stoneName) {
      parts.push(
        `đá: ${[
          userPreferences.stoneName,
          userPreferences.stoneColor,
        ]
          .filter(Boolean)
          .join(' / ')}`,
      );
    }
    if (userPreferences.customSignal) {
      parts.push(`cá nhân hóa: ${String(userPreferences.customSignal)}`);
    }

    const preferenceText = parts.length
      ? `Người dùng đang tìm nhẫn với ${parts.join(', ')}.`
      : 'Người dùng đang trao đổi tư vấn nhẫn BIORING.';

    const recentSnippet = recentMessages
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join(' | ')
      .slice(0, 280);

    // TODO: call rag-engine /summary when endpoint is available
    return recentSnippet
      ? `${preferenceText} Hội thoại gần đây: ${recentSnippet}`
      : preferenceText;
  }
}
