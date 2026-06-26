import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.users.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          full_name: true,
          phone: true,
          status: true,
          customer_type: true,
          is_vip: true,
          created_at: true,
          updated_at: true,
          user_roles: {
            include: { roles: { select: { name: true } } },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.users.count(),
    ]);

    return {
      data: data.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        status: u.status,
        customerType: u.customer_type,
        isVip: u.is_vip,
        createdAt: u.created_at?.toISOString(),
        updatedAt: u.updated_at?.toISOString(),
        roles: u.user_roles.map((ur) => ur.roles.name),
      })),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      include: {
        user_roles: { include: { roles: { select: { name: true } } } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: undefined,
      status: user.status,
      customerType: user.customer_type,
      isVip: user.is_vip,
      createdAt: user.created_at?.toISOString(),
      updatedAt: user.updated_at?.toISOString(),
      roles: user.user_roles.map((ur) => ur.roles.name),
    };
  }

  async banUser(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.users.update({
      where: { id },
      data: { status: 'BANNED' },
    });

    return { success: true };
  }

  async unbanUser(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.users.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    return { success: true };
  }

  async assignRole(userId: string, roleId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.roles.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.prisma.user_roles.findUnique({
      where: { user_id_role_id: { user_id: userId, role_id: roleId } },
    });

    if (existing) {
      throw new ConflictException('User already has this role');
    }

    await this.prisma.user_roles.create({
      data: { user_id: userId, role_id: roleId },
    });

    return { success: true };
  }
}
