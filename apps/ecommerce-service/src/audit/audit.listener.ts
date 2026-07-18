import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@app/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuditListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('audit.log')
  async handleAuditLog(payload: {
    userId?: string;
    action: string;
    entityName: string;
    entityId: string;
    newValue?: Record<string, unknown>;
    oldValue?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: payload.userId ?? null,
          action: payload.action,
          entity_name: payload.entityName,
          entity_id: payload.entityId,
          new_value: (payload.newValue ?? undefined) as Prisma.InputJsonValue,
          old_value: (payload.oldValue ?? undefined) as Prisma.InputJsonValue,
          created_at: new Date(),
        },
      });
    } catch (error) {
      console.warn('[Audit] Failed to write log:', error);
    }
  }
}
