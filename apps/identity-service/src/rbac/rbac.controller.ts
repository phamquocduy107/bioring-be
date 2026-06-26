import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RbacService } from './rbac.service';

@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @GrpcMethod('IdentityService', 'GetRoles')
  async getRoles() {
    const roles = await this.rbacService.findAllRoles();
    return { roles };
  }

  @GrpcMethod('IdentityService', 'GetRoleWithPermissions')
  async getRoleWithPermissions(data: { id: string }) {
    const role = await this.rbacService.getRoleWithPermissions(data.id);
    return { role };
  }

  @GrpcMethod('IdentityService', 'CreateRole')
  async createRole(data: { name: string; description?: string }) {
    return this.rbacService.createRole(data.name, data.description);
  }

  @GrpcMethod('IdentityService', 'UpdateRole')
  async updateRole(data: { id: string; name?: string; description?: string }) {
    return this.rbacService.updateRole(data.id, data.name, data.description);
  }

  @GrpcMethod('IdentityService', 'DeleteRole')
  async deleteRole(data: { id: string }) {
    return this.rbacService.deleteRole(data.id);
  }

  @GrpcMethod('IdentityService', 'GetPermissions')
  async getPermissions() {
    const permissions = await this.rbacService.findAllPermissions();
    return { permissions };
  }

  @GrpcMethod('IdentityService', 'AssignPermissionsToRole')
  async assignPermissionsToRole(data: {
    roleId: string;
    permissionIds: string[];
  }) {
    return this.rbacService.assignPermissionsToRole(
      data.roleId,
      data.permissionIds,
    );
  }

  @GrpcMethod('IdentityService', 'GetUserPermissions')
  async getUserPermissions(data: { userId: string }) {
    const slugs = await this.rbacService.getPermissionsByUserId(data.userId);
    return { permissionSlugs: slugs };
  }

  @GrpcMethod('IdentityService', 'GetUserRoles')
  async getUserRoles(data: { userId: string }) {
    const roles = await this.rbacService.getUserRoles(data.userId);
    return { roles };
  }
}
