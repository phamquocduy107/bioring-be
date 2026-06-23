import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllRoles() {
    return this.prisma.roles.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }

  async getRoleWithPermissions(id: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id },
      include: {
        role_permissions: {
          include: { permissions: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.role_permissions.map((rp) => ({
        id: rp.permissions.id,
        slug: rp.permissions.slug,
        description: rp.permissions.description,
      })),
    };
  }

  async createRole(name: string, description?: string) {
    const existing = await this.prisma.roles.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Role name already exists');
    }

    const role = await this.prisma.roles.create({
      data: { name, description },
    });

    return { id: role.id, name: role.name, description: role.description };
  }

  async updateRole(id: string, name?: string, description?: string) {
    const role = await this.prisma.roles.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (name) {
      const existing = await this.prisma.roles.findUnique({
        where: { name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Role name already exists');
      }
    }

    const updated = await this.prisma.roles.update({
      where: { id },
      data: { ...(name && { name }), ...(description && { description }) },
    });

    return { id: updated.id, name: updated.name, description: updated.description };
  }

  async deleteRole(id: string) {
    const role = await this.prisma.roles.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const usersCount = await this.prisma.user_roles.count({
      where: { role_id: id },
    });

    if (usersCount > 0) {
      throw new ForbiddenException(
        'Cannot delete role that is assigned to users',
      );
    }

    await this.prisma.role_permissions.deleteMany({
      where: { role_id: id },
    });
    await this.prisma.roles.delete({ where: { id } });

    return { success: true };
  }

  async findAllPermissions() {
    return this.prisma.permissions.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.prisma.permissions.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('Some permissions not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role_permissions.deleteMany({
        where: { role_id: roleId },
      });

      if (permissionIds.length > 0) {
        await tx.role_permissions.createMany({
          data: permissionIds.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return { success: true };
  }

  async getPermissionsByUserId(userId: string) {
    const userRoles = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: {
        roles: {
          include: {
            role_permissions: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    const permissionSlugs = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.roles.role_permissions) {
        permissionSlugs.add(rp.permissions.slug);
      }
    }

    return Array.from(permissionSlugs);
  }

  async getUserRoles(userId: string) {
    const userRoles = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: { roles: { select: { name: true } } },
    });

    return userRoles.map((ur) => ur.roles.name);
  }
}
