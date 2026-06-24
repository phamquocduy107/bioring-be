import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Permissions, Permission } from '@app/common';
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
  @Permissions(Permission.RoleRead)
  @ApiGetRolesDocs()
  async getRoles() {
    const result = await this.identityService.getRoles();
    return { roles: result?.roles ?? [] };
  }

  @Get('roles/:id')
  @Permissions(Permission.RoleRead)
  @ApiGetRoleWithPermissionsDocs()
  getRoleWithPermissions(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.identityService.getRoleWithPermissions(id);
  }

  @Post('roles')
  @Permissions(Permission.RoleWrite)
  @ApiCreateRoleDocs()
  createRole(@Body() body: { name: string; description?: string }) {
    return this.identityService.createRole(body.name, body.description);
  }

  @Patch('roles/:id')
  @Permissions(Permission.RoleWrite)
  @ApiUpdateRoleDocs()
  updateRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.identityService.updateRole(id, body.name, body.description);
  }

  @Delete('roles/:id')
  @Permissions(Permission.RoleWrite)
  @ApiDeleteRoleDocs()
  deleteRole(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.identityService.deleteRole(id);
  }

  @Get('permissions')
  @Permissions(Permission.RoleRead)
  @ApiGetPermissionsDocs()
  async getPermissions() {
    const result = await this.identityService.getPermissions();
    return { permissions: result?.permissions ?? [] };
  }

  @Post('permissions/assign')
  @Permissions(Permission.RoleWrite)
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
