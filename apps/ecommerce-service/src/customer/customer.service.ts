import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

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
