import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('IdentityService', 'GetUsers')
  async getUsers(data: { page?: number; limit?: number; role?: string }) {
    return this.usersService.findAll(
      data.page ?? 1,
      data.limit ?? 10,
      data.role,
    );
  }

  @GrpcMethod('IdentityService', 'GetUserById')
  async getUserById(data: { id: string }) {
    const user = await this.usersService.findById(data.id);
    return { user };
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

  @GrpcMethod('IdentityService', 'CreateUser')
  async createUser(data: {
    email: string;
    fullName: string;
    phone?: string;
    roleId?: string;
  }) {
    const user = await this.usersService.createUser(data);
    return { user };
  }

  @GrpcMethod('IdentityService', 'UpdateUser')
  async updateUser(data: {
    id: string;
    email?: string;
    fullName?: string;
    phone?: string;
    status?: string;
  }) {
    const user = await this.usersService.updateUser(data);
    return { user };
  }
}
