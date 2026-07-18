import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { MessageMetadata, UserPreferences } from './chat.types';

export interface CreateSessionInput {
  userId: string;
  workspaceId: string;
  title?: string;
}

export interface CreateMessageInput {
  sessionId: string;
  role: string;
  content: string;
  intent?: string | null;
  type?: string | null;
  metadata?: MessageMetadata;
}

@Injectable()
export class AiChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(payload: CreateSessionInput) {
    const now = new Date();
    return this.prisma.ai_sessions.create({
      data: {
        id: randomUUID(),
        user_id: payload.userId,
        workspace_id: payload.workspaceId,
        topic: payload.title?.trim() || 'New chat',
        summary: null,
        user_preferences: {},
        last_intent: null,
        current_intent: null,
        last_message: null,
        created_at: now,
        updated_at: now,
      },
    });
  }

  async findSessionsByUserAndWorkspace(payload: {
    userId: string;
    workspaceId: string;
  }) {
    return this.prisma.ai_sessions.findMany({
      where: {
        user_id: payload.userId,
        workspace_id: payload.workspaceId,
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async findSessionById(sessionId: string) {
    return this.prisma.ai_sessions.findUnique({ where: { id: sessionId } });
  }

  async findSessionForUser(sessionId: string, userId: string) {
    const session = await this.prisma.ai_sessions.findFirst({
      where: { id: sessionId, user_id: userId },
    });
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  async createMessage(payload: CreateMessageInput) {
    const metadata: MessageMetadata = {
      ...(payload.metadata ?? {}),
      ...(payload.intent ? { intent: payload.intent } : {}),
      ...(payload.type ? { type: payload.type } : {}),
    };

    return this.prisma.ai_messages.create({
      data: {
        id: randomUUID(),
        ai_session_id: payload.sessionId,
        sender: payload.role,
        message: payload.content,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        created_at: new Date(),
      },
    });
  }

  async updateMessageIntent(messageId: string, intent: string) {
    const existing = await this.prisma.ai_messages.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      return null;
    }
    const metadata = {
      ...this.parseMetadata(existing.metadata),
      intent,
    };
    return this.prisma.ai_messages.update({
      where: { id: messageId },
      data: { metadata: metadata as unknown as Prisma.InputJsonValue },
    });
  }

  async findRecentMessages(sessionId: string, limit: number) {
    const rows = await this.prisma.ai_messages.findMany({
      where: { ai_session_id: sessionId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return rows.reverse();
  }

  async findMessages(sessionId: string) {
    return this.prisma.ai_messages.findMany({
      where: { ai_session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });
  }

  async countMessages(sessionId: string) {
    return this.prisma.ai_messages.count({
      where: { ai_session_id: sessionId },
    });
  }

  async updateSessionPreferences(
    sessionId: string,
    userPreferences: UserPreferences,
  ) {
    return this.prisma.ai_sessions.update({
      where: { id: sessionId },
      data: {
        user_preferences: userPreferences as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
  }

  async getSessionPreferences(sessionId: string): Promise<UserPreferences> {
    const session = await this.findSessionById(sessionId);
    return this.parsePreferences(session?.user_preferences);
  }

  async updateSessionSummary(sessionId: string, conversationSummary: string) {
    return this.prisma.ai_sessions.update({
      where: { id: sessionId },
      data: {
        summary: conversationSummary,
        updated_at: new Date(),
      },
    });
  }

  async getSessionSummary(sessionId: string) {
    const session = await this.findSessionById(sessionId);
    return session?.summary?.trim() || undefined;
  }

  async updateSessionIntent(
    sessionId: string,
    payload: { currentIntent: string; lastIntent?: string | null },
  ) {
    return this.prisma.ai_sessions.update({
      where: { id: sessionId },
      data: {
        current_intent: payload.currentIntent,
        ...(payload.lastIntent !== undefined
          ? { last_intent: payload.lastIntent }
          : {}),
        updated_at: new Date(),
      },
    });
  }

  async getLastIntent(sessionId: string) {
    const session = await this.findSessionById(sessionId);
    return session?.current_intent ?? session?.last_intent ?? null;
  }

  async updateSessionLastMessage(sessionId: string, lastMessage: string) {
    return this.prisma.ai_sessions.update({
      where: { id: sessionId },
      data: {
        last_message: lastMessage.slice(0, 2000),
        updated_at: new Date(),
      },
    });
  }

  async touchSession(sessionId: string) {
    return this.prisma.ai_sessions.update({
      where: { id: sessionId },
      data: { updated_at: new Date() },
    });
  }

  parsePreferences(value: unknown): UserPreferences {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return { ...(value as UserPreferences) };
  }

  parseMetadata(value: unknown): MessageMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return { ...(value as MessageMetadata) };
  }
}
