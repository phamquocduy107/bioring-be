import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(params: {
    page: number;
    limit: number;
    resource?: string;
    from_date?: string;
    to_date?: string;
  }) {
    const where: Prisma.audit_logsWhereInput = {};
    if (params.resource) where.entity_name = params.resource;
    if (params.from_date || params.to_date) {
      where.created_at = {};
      if (params.from_date) where.created_at.gte = new Date(params.from_date);
      if (params.to_date) where.created_at.lte = new Date(params.to_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        include: {
          users: { select: { id: true, full_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        id: log.id,
        timestamp: log.created_at?.toISOString() ?? '',
        actor: log.users
          ? {
              id: log.users.id,
              name: log.users.full_name ?? '',
              email: log.users.email ?? '',
            }
          : null,
        action: log.action ?? '',
        resource: log.entity_name ?? '',
        resource_id: log.entity_id ?? '',
        description: `${log.action ?? ''} on ${log.entity_name ?? ''} ${log.entity_id ?? ''}`,
        result: 'success',
        metadata: log.new_value
          ? { newValue: log.new_value, oldValue: log.old_value }
          : null,
      })),
      total,
      page: params.page,
      limit: params.limit,
      last_page: Math.ceil(total / params.limit),
    };
  }
}
