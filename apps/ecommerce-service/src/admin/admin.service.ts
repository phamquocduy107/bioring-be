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
}
