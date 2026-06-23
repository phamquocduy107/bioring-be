import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IdentityService } from '../identity.service';
import {
  ApiGetRolesDocs,
  ApiGetRoleWithPermissionsDocs,
  ApiCreateRoleDocs,
  ApiUpdateRoleDocs,
  ApiDeleteRoleDocs,
  ApiGetPermissionsDocs,
  ApiAssignPermissionsToRoleDocs,
} from './rbac.swagger';

@ApiBearerAuth('access-token')
@Controller('rbac')
export class RbacController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('roles')
  @ApiGetRolesDocs()
  async getRoles() {
    const result = await this.identityService.getRoles();
    return { roles: result?.roles ?? [] };
  }

  @Get('roles/:id')
  @ApiGetRoleWithPermissionsDocs()
  getRoleWithPermissions(@Param('id') id: string) {
    return this.identityService.getRoleWithPermissions(id);
  }

  @Post('roles')
  @ApiCreateRoleDocs()
  createRole(@Body() body: { name: string; description?: string }) {
    return this.identityService.createRole(body.name, body.description);
  }

  @Patch('roles/:id')
  @ApiUpdateRoleDocs()
  updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.identityService.updateRole(id, body.name, body.description);
  }

  @Delete('roles/:id')
  @ApiDeleteRoleDocs()
  deleteRole(@Param('id') id: string) {
    return this.identityService.deleteRole(id);
  }

  @Get('permissions')
  @ApiGetPermissionsDocs()
  async getPermissions() {
    const result = await this.identityService.getPermissions();
    return { permissions: result?.permissions ?? [] };
  }

  @Post('permissions/assign')
  @ApiAssignPermissionsToRoleDocs()
  assignPermissionsToRole(
    @Body() body: { roleId: string; permissionIds: string[] },
  ) {
    return this.identityService.assignPermissionsToRole(
      body.roleId,
      body.permissionIds,
    );
  }
}
