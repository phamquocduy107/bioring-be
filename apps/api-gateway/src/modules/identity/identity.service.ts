import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

interface IdentityGrpcService {
  googleLogin(data: any): Observable<any>;
  refreshToken(data: any): Observable<any>;
  logout(data: any): Observable<any>;
  getUsers(data: any): Observable<any>;
  getUserById(data: any): Observable<any>;
  banUser(data: any): Observable<any>;
  unbanUser(data: any): Observable<any>;
  assignRole(data: any): Observable<any>;
  getRoles(data: any): Observable<any>;
  getRoleWithPermissions(data: any): Observable<any>;
  createRole(data: any): Observable<any>;
  updateRole(data: any): Observable<any>;
  deleteRole(data: any): Observable<any>;
  getPermissions(data: any): Observable<any>;
  assignPermissionsToRole(data: any): Observable<any>;
  getUserPermissions(data: any): Observable<any>;
  getUserRoles(data: any): Observable<any>;
}

@Injectable()
export class IdentityService implements OnModuleInit {
  private grpc?: IdentityGrpcService;

  constructor(
    @Optional()
    @Inject('IDENTITY_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc = this.client?.getService<IdentityGrpcService>('IdentityService');
  }

  private call<T>(method: (data: any) => Observable<T>, data: any): Promise<T> {
    if (!this.grpc) {
      throw new Error('IDENTITY_SERVICE gRPC client is not initialized');
    }
    return lastValueFrom(method.call(this.grpc, data));
  }

  // Auth
  googleLogin(dto: any) {
    return this.call(this.grpc!.googleLogin, dto);
  }
  refreshToken(dto: any) {
    return this.call(this.grpc!.refreshToken, dto);
  }
  logout(dto: any) {
    return this.call(this.grpc!.logout, dto);
  }

  // Users
  getUsers(page: number, limit: number) {
    return this.call(this.grpc!.getUsers, { page, limit });
  }
  getUserById(id: string) {
    return this.call(this.grpc!.getUserById, { id });
  }
  banUser(id: string) {
    return this.call(this.grpc!.banUser, { id });
  }
  unbanUser(id: string) {
    return this.call(this.grpc!.unbanUser, { id });
  }
  assignRole(userId: string, roleId: string) {
    return this.call(this.grpc!.assignRole, { userId, roleId });
  }

  // RBAC
  getRoles() {
    return this.call(this.grpc!.getRoles, {});
  }
  getRoleWithPermissions(id: string) {
    return this.call(this.grpc!.getRoleWithPermissions, { id });
  }
  createRole(name: string, description?: string) {
    return this.call(this.grpc!.createRole, { name, description });
  }
  updateRole(id: string, name?: string, description?: string) {
    return this.call(this.grpc!.updateRole, { id, name, description });
  }
  deleteRole(id: string) {
    return this.call(this.grpc!.deleteRole, { id });
  }
  getPermissions() {
    return this.call(this.grpc!.getPermissions, {});
  }
  assignPermissionsToRole(roleId: string, permissionIds: string[]) {
    return this.call(this.grpc!.assignPermissionsToRole, { roleId, permissionIds });
  }
  getUserPermissions(userId: string) {
    return this.call(this.grpc!.getUserPermissions, { userId });
  }
  getUserRoles(userId: string) {
    return this.call(this.grpc!.getUserRoles, { userId });
  }

}
