import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiGetUsersDocs()
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.identityService.getUsers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get(':id')
  @ApiGetUserByIdDocs()
  getUserById(@Param('id') id: string) {
    return this.identityService.getUserById(id);
  }

  @Patch(':id/ban')
  @ApiBanUserDocs()
  banUser(@Param('id') id: string) {
    return this.identityService.banUser(id);
  }

  @Patch(':id/unban')
  @ApiUnbanUserDocs()
  unbanUser(@Param('id') id: string) {
    return this.identityService.unbanUser(id);
  }

  @Post(':id/assign-role')
  @ApiAssignRoleDocs()
  assignRole(
    @Param('id') userId: string,
    @Query('roleId') roleId: string,
  ) {
    return this.identityService.assignRole(userId, roleId);
  }
}
