import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Permissions, Permission } from '@app/common';
import { IdentityService } from '../identity.service';
import {
  ApiGetUsersDocs,
  ApiGetUserByIdDocs,
  ApiBanUserDocs,
  ApiUnbanUserDocs,
  ApiAssignRoleDocs,
} from './users.swagger';

@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @Permissions(Permission.UserRead)
  @ApiGetUsersDocs()
  async getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.identityService.getUsers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
    return {
      data: result?.data ?? [],
      meta: result?.meta ?? { total: 0, page: 1, limit: 10, lastPage: 0 },
    };
  }

  @Get(':id')
  @Permissions(Permission.UserRead)
  @ApiGetUserByIdDocs()
  getUserById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.identityService.getUserById(id);
  }

  @Patch(':id/ban')
  @Permissions(Permission.UserBlock)
  @ApiBanUserDocs()
  banUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.identityService.banUser(id);
  }

  @Patch(':id/unban')
  @Permissions(Permission.UserBlock)
  @ApiUnbanUserDocs()
  unbanUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.identityService.unbanUser(id);
  }

  @Post(':id/assign-role')
  @Permissions(Permission.UserWrite)
  @ApiAssignRoleDocs()
  assignRole(@Param('id', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string) {
    return this.identityService.assignRole(userId, roleId);
  }
}
