import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { ChatHistoryMessage, UserPreferences } from '../chat/chat.types';
import type {
  IntentDetectionResponse,
  RagQueryRequest,
  RagQueryResponse,
} from './rag-engine.types';

/** HTTP client for Python rag-engine. */
@Injectable()
export class RagEngineClient {
  private readonly logger = new Logger(RagEngineClient.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'RAG_ENGINE_URL',
      'http://localhost:8000',
    );
  }

  async detectIntent(payload: {
    question: string;
    chatHistory: ChatHistoryMessage[];
    conversationSummary?: string;
    userPreferences?: UserPreferences;
    lastIntent?: string | null;
    language?: 'vi' | 'en';
  }): Promise<IntentDetectionResponse> {
    // Gọi Python /intent/detect: rules-first intent + slot extraction, NestJS không tự gọi LLM.
    return this.post<IntentDetectionResponse>(
      '/intent/detect',
      {
        question: payload.question,
        chatHistory: payload.chatHistory,
        conversationSummary: payload.conversationSummary,
        userPreferences: payload.userPreferences ?? {},
        lastIntent: payload.lastIntent ?? null,
        language: payload.language ?? 'vi',
      },
      // Local LLM (LM Studio) often needs >15s for first/cold intent calls.
      Number(process.env.RAG_ENGINE_INTENT_TIMEOUT_MS ?? 60_000),
    );
  }

  async query(payload: RagQueryRequest): Promise<RagQueryResponse> {
    // Gọi Python /query: embedding, Qdrant retrieval, prompt building và final LLM answer.
    return this.post<RagQueryResponse>(
      '/query',
      payload,
      Number(process.env.RAG_ENGINE_QUERY_TIMEOUT_MS ?? 120_000),
    );
  }

  createRequestId(): string {
    return randomUUID();
  }

  private async post<T>(
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // HTTP boundary sang rag-engine; api-gateway không gọi Python trực tiếp.
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Log body lỗi từ Python để debug retrieval/LLM, nhưng không log prompt/context dài.
        const errText = await response.text();
        const message = this.extractErrorMessage(errText);
        this.logger.error(
          `rag-engine ${path} failed (${response.status}): ${message}`,
        );
        throw new HttpException(
          `rag-engine ${path} failed: ${message}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const payload: unknown = await response.json();
      // Hỗ trợ cả payload phẳng lẫn envelope Nest { statusCode, message, data }.
      return this.unwrapNestEnvelope<T>(payload);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `rag-engine unreachable (${path}): ${message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private unwrapNestEnvelope<T>(payload: unknown): T {
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      'data' in payload &&
      'statusCode' in payload
    ) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  private extractErrorMessage(rawText: string): string {
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message.trim()) {
          return obj.message;
        }
        if (typeof obj.detail === 'string' && obj.detail.trim()) {
          return obj.detail;
        }
      }
    } catch {
      // keep raw
    }
    return rawText;
  }
}
