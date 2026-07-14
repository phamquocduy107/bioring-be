import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import type { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    sort_by?: string;
    sort_order?: string;
  }) {
    const where: Prisma.usersWhereInput = {};
    if (params.search) {
      where.OR = [
        { full_name: { contains: params.search } },
        { email: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }
    if (params.status) where.status = params.status.toUpperCase();

    const total = await this.prisma.users.count({ where });

    // ponytail: client-side sort for aggregate fields, add DB sort when throughput matters
    let orderBy: Prisma.usersOrderByWithRelationInput = { created_at: 'desc' };
    if (params.sort_by === 'name') orderBy = { full_name: params.sort_order === 'asc' ? 'asc' : 'desc' };
    else if (params.sort_by === 'email') orderBy = { email: params.sort_order === 'asc' ? 'asc' : 'desc' };
    else if (params.sort_by === 'joinDate') orderBy = { created_at: params.sort_order === 'asc' ? 'asc' : 'desc' };

    const users = await this.prisma.users.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        orders_orders_user_idTousers: { select: { id: true, total_price: true, created_at: true, status: true } },
        user_addresses: { select: { province: true }, take: 1, orderBy: { created_at: 'desc' } },
      },
    });

    const data = users.map(u => {
      const completed = u.orders_orders_user_idTousers.filter(o => o.status === 'COMPLETED');
      return {
        id: u.id,
        name: u.full_name ?? '',
        email: u.email ?? '',
        phone: u.phone ?? '',
        avatar: null as string | null,
        status: u.status?.toLowerCase() ?? 'active',
        total_orders: completed.length,
        total_spent: completed.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0),
        last_order_date: completed.length > 0
          ? completed.sort((a, b) => b.created_at!.getTime() - a.created_at!.getTime())[0].created_at!.toISOString()
          : null,
        join_date: u.created_at?.toISOString() ?? '',
        location: u.user_addresses[0]?.province ?? '',
      };
    });

    // ponytail: client sort aggregate fields, acceptable at < 10k users
    const order = params.sort_order === 'asc' ? 1 : -1;
    if (params.sort_by === 'totalSpent') data.sort((a, b) => (a.total_spent - b.total_spent) * order);
    else if (params.sort_by === 'totalOrders') data.sort((a, b) => (a.total_orders - b.total_orders) * order);
    else if (params.sort_by === 'lastOrderDate') {
      data.sort((a, b) => {
        const da = a.last_order_date ? new Date(a.last_order_date).getTime() : 0;
        const db = b.last_order_date ? new Date(b.last_order_date).getTime() : 0;
        return (da - db) * order;
      });
    }

    return { data, total, page: params.page, limit: params.limit, last_page: Math.ceil(total / params.limit) };
  }

  async lookupCustomer(email: string) {
    const user = await this.prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
      },
    });

    if (user) {
      const userOrderCount = await this.prisma.orders.count({
        where: { user_id: user.id },
      });

      const guest = await this.prisma.guest_customers.findFirst({
        where: { email, converted_user_id: user.id },
        select: { id: true, guest_code: true, created_at: true },
      });

      const activeOrders = await this.prisma.orders.count({
        where: {
          user_id: user.id,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
        },
      });

      return {
        type: 'member' as const,
        member: {
          id: user.id,
          fullName: user.full_name ?? '',
          email: user.email ?? '',
          phone: user.phone ?? '',
          orderCount: userOrderCount,
          activeOrders,
        },
        guest: guest
          ? {
              id: guest.id,
              guestCode: guest.guest_code ?? '',
              convertedAt: guest.created_at?.toISOString() ?? '',
            }
          : null,
      };
    }

    const guest = await this.prisma.guest_customers.findFirst({
      where: { email },
      orderBy: { created_at: 'desc' },
    });

    if (guest) {
      const guestOrders = await this.prisma.orders.findMany({
        where: { guest_customer_id: guest.id },
        select: { created_at: true },
        orderBy: { created_at: 'desc' },
        take: 1,
      });

      return {
        type: 'walk-in' as const,
        member: null,
        guest: {
          id: guest.id,
          guestCode: guest.guest_code ?? '',
          fullName: guest.full_name ?? '',
          phone: guest.phone ?? '',
          email: guest.email ?? '',
          orderCount: await this.prisma.orders.count({
            where: { guest_customer_id: guest.id },
          }),
          lastOrderAt: guestOrders[0]?.created_at?.toISOString() ?? null,
        },
      };
    }

    return { type: 'new' as const };
  }
}
