import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { randomUUID } from 'node:crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 10, role?: string) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) {
      where.user_roles = { some: { roles: { name: role } } };
    }

    const [data, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
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
          refresh_tokens: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { created_at: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.users.count({ where }),
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
        lastLogin: u.refresh_tokens[0]?.created_at?.toISOString() ?? '',
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
        refresh_tokens: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true },
        },
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
      lastLogin: user.refresh_tokens[0]?.created_at?.toISOString() ?? '',
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

  async createUser(data: { email: string; fullName: string; phone?: string; roleId?: string }) {
    const existing = await this.prisma.users.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already exists');

    const id = randomUUID();
    await this.prisma.users.create({
      data: {
        id,
        email: data.email,
        full_name: data.fullName,
        phone: data.phone ?? null,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (data.roleId) {
      const role = await this.prisma.roles.findUnique({ where: { id: data.roleId } });
      if (!role) throw new BadRequestException('Role not found');
      await this.prisma.user_roles.create({
        data: { user_id: id, role_id: data.roleId },
      });
    }

    return this.findById(id);
  }

  async updateUser(data: { id: string; email?: string; fullName?: string; phone?: string; status?: string }) {
    const user = await this.prisma.users.findUnique({ where: { id: data.id } });
    if (!user) throw new NotFoundException('User not found');

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.users.findUnique({ where: { email: data.email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    await this.prisma.users.update({
      where: { id: data.id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.fullName !== undefined && { full_name: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.status !== undefined && { status: data.status }),
        updated_at: new Date(),
      },
    });

    return this.findById(data.id);
  }

  // ponytail: temporary — FE handles 1 role per user only.
  // Deletes all existing roles then adds the new one.
  // Future: change to multi-role assign when FE supports it.
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

    await this.prisma.$transaction([
      this.prisma.user_roles.deleteMany({ where: { user_id: userId } }),
      this.prisma.user_roles.create({ data: { user_id: userId, role_id: roleId } }),
    ]);

    return { success: true };
  }
}
