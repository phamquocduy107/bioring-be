import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

// --- Response types matching identity.proto ---

interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  status: string;
  customerType: string;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
  roles: string[];
}

interface PermissionResponse {
  id: string;
  slug: string;
  description: string;
}

interface RoleResponse {
  id: string;
  name: string;
  description: string;
  permissions: PermissionResponse[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

interface IdentityGrpcService {
  googleLogin(data: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    provider: string;
    deviceAgent: string;
    ipAddress: string;
  }): Observable<{
    user: UserResponse;
    accessToken: string;
    refreshToken: string;
  }>;
  refreshToken(data: {
    oldRefreshToken: string;
    deviceAgent: string;
    ipAddress: string;
  }): Observable<{ accessToken: string; refreshToken: string }>;
  logout(data: { refreshToken: string }): Observable<{ success: boolean }>;
  getUsers(data: {
    page: number;
    limit: number;
  }): Observable<{ data: UserResponse[]; meta: PaginationMeta }>;
  getUserById(data: { id: string }): Observable<{ user: UserResponse }>;
  banUser(data: { id: string }): Observable<{ success: boolean }>;
  unbanUser(data: { id: string }): Observable<{ success: boolean }>;
  assignRole(data: {
    userId: string;
    roleId: string;
  }): Observable<{ success: boolean }>;
  getRoles(data: Record<string, never>): Observable<{ roles: RoleResponse[] }>;
  getRoleWithPermissions(data: {
    id: string;
  }): Observable<{ role: RoleResponse }>;
  createRole(data: {
    name: string;
    description?: string;
  }): Observable<{ role: RoleResponse }>;
  updateRole(data: {
    id: string;
    name?: string;
    description?: string;
  }): Observable<{ role: RoleResponse }>;
  deleteRole(data: { id: string }): Observable<{ success: boolean }>;
  getPermissions(
    data: Record<string, never>,
  ): Observable<{ permissions: PermissionResponse[] }>;
  assignPermissionsToRole(data: {
    roleId: string;
    permissionIds: string[];
  }): Observable<{ success: boolean }>;
  getUserPermissions(data: {
    userId: string;
  }): Observable<{ permissionSlugs: string[] }>;
  getUserRoles(data: { userId: string }): Observable<{ roles: string[] }>;
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

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc) {
      throw new Error('IDENTITY_SERVICE gRPC client is not initialized');
    }
    return lastValueFrom(fn());
  }

  // Auth
  googleLogin(dto: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    provider: string;
    deviceAgent: string;
    ipAddress: string;
  }) {
    return this.call(() => this.grpc!.googleLogin(dto));
  }
  refreshToken(dto: {
    oldRefreshToken: string;
    deviceAgent: string;
    ipAddress: string;
  }) {
    return this.call(() => this.grpc!.refreshToken(dto));
  }
  logout(dto: { refreshToken: string }) {
    return this.call(() => this.grpc!.logout(dto));
  }

  // Users
  getUsers(page: number, limit: number) {
    return this.call(() => this.grpc!.getUsers({ page, limit }));
  }
  getUserById(id: string) {
    return this.call(() => this.grpc!.getUserById({ id }));
  }
  banUser(id: string) {
    return this.call(() => this.grpc!.banUser({ id }));
  }
  unbanUser(id: string) {
    return this.call(() => this.grpc!.unbanUser({ id }));
  }
  assignRole(userId: string, roleId: string) {
    return this.call(() => this.grpc!.assignRole({ userId, roleId }));
  }

  // RBAC
  getRoles() {
    return this.call(() => this.grpc!.getRoles({}));
  }
  getRoleWithPermissions(id: string) {
    return this.call(() => this.grpc!.getRoleWithPermissions({ id }));
  }
  createRole(name: string, description?: string) {
    return this.call(() => this.grpc!.createRole({ name, description }));
  }
  updateRole(id: string, name?: string, description?: string) {
    return this.call(() => this.grpc!.updateRole({ id, name, description }));
  }
  deleteRole(id: string) {
    return this.call(() => this.grpc!.deleteRole({ id }));
  }
  getPermissions() {
    return this.call(() => this.grpc!.getPermissions({}));
  }
  assignPermissionsToRole(roleId: string, permissionIds: string[]) {
    return this.call(() =>
      this.grpc!.assignPermissionsToRole({ roleId, permissionIds }),
    );
  }
  getUserPermissions(userId: string) {
    return this.call(() => this.grpc!.getUserPermissions({ userId }));
  }
  getUserRoles(userId: string) {
    return this.call(() => this.grpc!.getUserRoles({ userId }));
  }
}
