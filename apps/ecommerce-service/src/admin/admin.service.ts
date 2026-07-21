import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [orderStats, activeUsers] = await Promise.all([
      this.prisma.orders.aggregate({
        _count: { id: true },
        _sum: { total_price: true },
      }),
      this.prisma.users.count({ where: { status: 'ACTIVE' } }),
    ]);

    const completedOrders = await this.prisma.orders.count({
      where: { status: 'COMPLETED' },
    });

    return {
      totalOrders: orderStats._count.id,
      completedOrders,
      totalRevenue: Number(orderStats._sum.total_price ?? 0),
      activeUsers,
    };
  }

  async getOrdersByStatus() {
    const groups = await this.prisma.orders.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return {
      data: groups.map((g) => ({
        status: g.status ?? 'UNKNOWN',
        count: g._count.id,
      })),
    };
  }

  async getRevenueTimeline(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const groups = await this.prisma.orders.groupBy({
      by: ['created_at'],
      where: { created_at: { gte: since } },
      _sum: { total_price: true },
    });

    // ponytail: group by date client-side, add when perf matters
    const map = new Map<string, number>();
    for (const g of groups) {
      if (!g.created_at) continue;
      const date = g.created_at.toISOString().slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + Number(g._sum.total_price ?? 0));
    }

    return {
      data: Array.from(map, ([date, revenue]) => ({ date, revenue })),
    };
  }

  async getMonthlyGrowth(months: number) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const payments = await this.prisma.payments.findMany({
      where: {
        status: { in: ['PAID', 'SUCCESS'] },
        paid_at: { gte: start, lte: now },
      },
      select: { amount: true, paid_at: true },
    });

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const map = new Map<string, number>();

    for (const p of payments) {
      if (!p.paid_at) continue;
      const key = `${monthNames[p.paid_at.getMonth()]} ${p.paid_at.getFullYear()}`;
      map.set(key, (map.get(key) ?? 0) + Number(p.amount));
    }

    const data: { month: string; revenue: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      data.push({
        month: monthNames[d.getMonth()],
        revenue: map.get(key) ?? 0,
      });
    }

    return { data };
  }

  async getTopProducts(limit: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; orderCount: bigint }>
    >`
      SELECT p.id, p.name, COUNT(o.id) AS "orderCount"
      FROM products p
      JOIN engravings e ON e.product_id = p.id
      JOIN orders o ON o.id = e.order_id
      WHERE o.status = 'COMPLETED'
      GROUP BY p.id, p.name
      ORDER BY "orderCount" DESC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        orderCount: Number(r.orderCount),
      })),
    };
  }

  async getProductionStats() {
    const [taskCountsByStatus, distinctJewelers, pendingQa] = await Promise.all(
      [
        this.prisma.production_tasks.groupBy({ by: ['status'], _count: true }),
        this.prisma.production_tasks.findMany({
          where: { assigned_jeweler_id: { not: null } },
          distinct: ['assigned_jeweler_id'],
          select: { assigned_jeweler_id: true },
        }),
        this.prisma.qa_checks.count({ where: { result: null } }),
      ],
    );
    const countMap = new Map(
      taskCountsByStatus.map((t) => [t.status, t._count]),
    );
    return {
      total_jewelers: distinctJewelers.length,
      in_progress: countMap.get('IN_PROGRESS') ?? 0,
      pending_qa: pendingQa,
    };
  }
}
