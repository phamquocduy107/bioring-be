import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from '../services/users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('IdentityService', 'GetUsers')
  async getUsers(data: { page?: number; limit?: number }) {
    return this.usersService.findAll(data.page ?? 1, data.limit ?? 10);
  }

  @GrpcMethod('IdentityService', 'GetUserById')
  async getUserById(data: { id: string }) {
    return this.usersService.findById(data.id);
  }

  @GrpcMethod('IdentityService', 'BanUser')
  async banUser(data: { id: string }) {
    return this.usersService.banUser(data.id);
  }

  @GrpcMethod('IdentityService', 'UnbanUser')
  async unbanUser(data: { id: string }) {
    return this.usersService.unbanUser(data.id);
  }

  @GrpcMethod('IdentityService', 'AssignRole')
  async assignRole(data: { userId: string; roleId: string }) {
    return this.usersService.assignRole(data.userId, data.roleId);
  }
}
