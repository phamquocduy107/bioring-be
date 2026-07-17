import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type {
  ChatHistoryMessage,
  UserPreferences,
} from '../chat/chat.types';
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
        this.logger.error(
          `rag-engine ${path} failed (${response.status}): ${errText}`,
        );
        throw new HttpException(
          `rag-engine ${path} failed: ${errText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      return (await response.json()) as T;
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
}
