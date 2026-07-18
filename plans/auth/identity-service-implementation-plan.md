# Plan: Implement Identity Service (IAM) cho Bioring BE

> **Lần cập nhật gần nhất:** 2026-06-23 — Chuyển Google OAuth từ POST body client-sang-server-side OAuth redirect flow với Passport.

## Current Status Overview

| Thành phần | Trạng thái | Chi tiết |
|---|---|---|
| `apps/identity-service` | ✅ Hoàn thành | Auth, Users, RBAC services + controllers |
| `proto/identity.proto` | ✅ Hoàn thành | Đầy đủ RPC methods cho Auth, Users, RBAC |
| Prisma schema (users, roles, permissions, user_roles, role_permissions, refresh_tokens) | ✅ Đã có | `refresh_tokens` model đã thêm |
| `@app/common` — AuthGuard, JwtModule, jwt.config | ✅ Đã có | JWT_ACCESS_TOKEN_SECRET / JWT_REFRESH_TOKEN_SECRET tách riêng |
| `@app/common` — PermissionRbacGuard | ✅ Đã có | Đã register global trong `app.module.ts` |
| `@app/common` — Role enum | ✅ Hoàn thành | Admin, Manager, StoreStaff, Jeweler, DeliveryStaff, Customer |
| `@app/common` — Permission enum | ✅ Hoàn thành | 12 permissions |
| `@app/common` — DTOs (GoogleLoginDto, RefreshTokenCommandDto, LogoutCommandDto) | ✅ Đã có | |
| `@app/common` — JwtPayload interface | ✅ Đã có | `sub, email, role[]` |
| API Gateway `IdentityModule` | ✅ Hoàn thành | gRPC client + Passport Google OAuth + Controllers |
| `.env.example` | ✅ Đã cập nhật | JWT secrets, Google OAuth keys |

---

## Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (:3000)                           │
│                                                                      │
│  AuthController              PassportModule                          │
│  GET /auth/google ──────────▶ GoogleOauthGuard ──▶ GoogleStrategy    │
│  GET /auth/google/callback       │                   │               │
│  POST /auth/refresh              │                   │               │
│  POST /auth/logout               │         passport-google-oauth20   │
│                                  │         exchange code → profile   │
│                                  │               │                   │
│                    IdentityService (gRPC client)  │                   │
│                    googleLogin({email, name, ...})◀┘                  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ gRPC :50052
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      IDENTITY SERVICE (:50052)                       │
│                                                                      │
│  AuthController (@GrpcMethod)                                        │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ AuthService                                                  │  │
│    │  - handleGoogleLogin(): findOrCreateUser → genJWT → save RT │  │
│    │  - refreshToken(): verifyOld → rotate → genNew               │  │
│    │  - logout(): delete refresh token from DB                    │  │
│    └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  UsersController (@GrpcMethod)                                       │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ UsersService                                                 │  │
│    │  - findAll(), findById(), banUser(), unbanUser(), assignRole │  │
│    └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  RbacController (@GrpcMethod)                                        │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ RbacService                                                  │  │
│    │  - getRoles, getRoleWithPermissions, createRole, updateRole  │  │
│    │  - deleteRole, getPermissions, assignPermissionsToRole       │  │
│    │  - getPermissionsByUserId (cho PermissionRbacGuard)          │  │
│    └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### ✅ Bước 1: Prisma Schema — Thêm `refresh_tokens` model
- **File:** `libs/prisma/prisma/schema.prisma` (dòng 812-825)
- **Nội dung:** Model `refresh_tokens` với các trường `id, user_id, token, expires_at, is_revoked, device_agent, ip_address, created_at`
- **Relation:** Nhiều-1 với `users`, cascade delete
- **Index:** `user_id`, `token`

> **Bạn cần chạy:** `npm run prisma:migrate -- --name add_refresh_tokens && npm run prisma:generate`

---

### ✅ Bước 2: Proto — Đầy đủ RPC methods
- **File:** `proto/identity.proto`
- **Auth:** GoogleLogin, RefreshToken, Logout
- **Users:** GetUsers, GetUserById, BanUser, UnbanUser, AssignRole
- **RBAC:** GetRoles, GetRoleWithPermissions, CreateRole, UpdateRole, DeleteRole, GetPermissions, AssignPermissionsToRole, GetUserPermissions
- **Health:** Ping

```protobuf
syntax = "proto3";
package identity;

service IdentityService {
  // Auth
  rpc GoogleLogin (GoogleLoginRequest) returns (GoogleLoginResponse);
  rpc RefreshToken (RefreshTokenRequest) returns (RefreshTokenResponse);
  rpc Logout (LogoutRequest) returns (LogoutResponse);

  // Users
  rpc GetUsers (GetUsersRequest) returns (GetUsersResponse);
  rpc GetUserById (GetUserByIdRequest) returns (GetUserByIdResponse);
  rpc BanUser (BanUserRequest) returns (BanUserResponse);
  rpc UnbanUser (UnbanUserRequest) returns (UnbanUserResponse);
  rpc AssignRole (AssignRoleRequest) returns (AssignRoleResponse);

  // RBAC
  rpc GetRoles (GetRolesRequest) returns (GetRolesResponse);
  rpc GetRoleWithPermissions (GetRoleWithPermissionsRequest) returns (GetRoleWithPermissionsResponse);
  rpc CreateRole (CreateRoleRequest) returns (CreateRoleResponse);
  rpc UpdateRole (UpdateRoleRequest) returns (UpdateRoleResponse);
  rpc DeleteRole (DeleteRoleRequest) returns (DeleteRoleResponse);
  rpc GetPermissions (GetPermissionsRequest) returns (GetPermissionsResponse);
  rpc AssignPermissionsToRole (AssignPermissionsToRoleRequest) returns (AssignPermissionsToRoleResponse);
  rpc GetUserPermissions (GetUserPermissionsRequest) returns (GetUserPermissionsResponse);

  // Health
  rpc Ping (PingRequest) returns (PingResponse);
}

// --- Auth Messages ---
message GoogleLoginRequest {
  string email = 1;
  string firstName = 2;
  string lastName = 3;
  string picture = 4;
  string provider = 5;
  string deviceAgent = 6;
  string ipAddress = 7;
}

message GoogleLoginResponse {
  User user = 1;
  string accessToken = 2;
  string refreshToken = 3;
}

message RefreshTokenRequest {
  string oldRefreshToken = 1;
  string deviceAgent = 2;
  string ipAddress = 3;
}

message RefreshTokenResponse {
  string accessToken = 1;
  string refreshToken = 2;
}

message LogoutRequest {
  string refreshToken = 1;
}

message LogoutResponse {
  bool success = 1;
}

// --- User Messages ---
message User {
  string id = 1;
  string email = 2;
  string fullName = 3;
  string phone = 4;
  string avatarUrl = 5;
  string status = 6;
  string customerType = 7;
  bool isVip = 8;
  string createdAt = 9;
  string updatedAt = 10;
  repeated string roles = 11;
}

message GetUsersRequest {
  int32 page = 1;
  int32 limit = 2;
}

message GetUsersResponse {
  repeated User data = 1;
  PaginationMeta meta = 2;
}

message PaginationMeta {
  int32 total = 1;
  int32 page = 2;
  int32 limit = 3;
  int32 lastPage = 4;
}

message GetUserByIdRequest {
  string id = 1;
}

message GetUserByIdResponse {
  User user = 1;
}

message BanUserRequest {
  string id = 1;
}

message BanUserResponse {
  bool success = 1;
}

message UnbanUserRequest {
  string id = 1;
}

message UnbanUserResponse {
  bool success = 1;
}

message AssignRoleRequest {
  string userId = 1;
  string roleId = 2;
}

message AssignRoleResponse {
  bool success = 1;
}

// --- RBAC Messages ---
message Role {
  string id = 1;
  string name = 2;
  string description = 3;
  repeated Permission permissions = 4;
}

message Permission {
  string id = 1;
  string slug = 2;
  string description = 3;
}

message GetRolesRequest {}

message GetRolesResponse {
  repeated Role roles = 1;
}

message GetRoleWithPermissionsRequest {
  string id = 1;
}

message GetRoleWithPermissionsResponse {
  Role role = 1;
}

message CreateRoleRequest {
  string name = 1;
  string description = 2;
}

message CreateRoleResponse {
  Role role = 1;
}

message UpdateRoleRequest {
  string id = 1;
  string name = 2;
  string description = 3;
}

message UpdateRoleResponse {
  Role role = 1;
}

message DeleteRoleRequest {
  string id = 1;
}

message DeleteRoleResponse {
  bool success = 1;
}

message GetPermissionsRequest {}

message GetPermissionsResponse {
  repeated Permission permissions = 1;
}

message AssignPermissionsToRoleRequest {
  string roleId = 1;
  repeated string permissionIds = 2;
}

message AssignPermissionsToRoleResponse {
  bool success = 1;
}

message GetUserPermissionsRequest {
  string userId = 1;
}

message GetUserPermissionsResponse {
  repeated string permissionSlugs = 1;
}

// --- Ping ---
message PingRequest {
  string data = 1;
}

message PingResponse {
  bool pong = 1;
  string receivedAt = 2;
  string data = 3;
}
```

---

### ✅ Bước 3: Role Enum — 6 roles
- **File:** `libs/common/src/enums/role.enum.ts`
- **Roles:** `Admin`, `Manager`, `StoreStaff`, `Jeweler`, `DeliveryStaff`, `Customer`

### ✅ Bước 4: Permission Enum — 12 permissions
- **File:** `libs/common/src/enums/permission.enum.ts`
- **Permissions:** `user.read`, `user.write`, `user.block`, `role.read`, `role.write`, `product.read`, `product.write`, `order.read`, `order.write`, `dashboard.view`, `settings.read`, `settings.write`

### ✅ Bước 5: JWT Config — Tách access/refresh secrets
- **File:** `libs/common/src/config/jwt.config.ts`
- `JwtModule` giữ secret cho access token (mặc định)
- Refresh token dùng `jwtService.sign()` với `secret` override ở service layer
- **File:** `.env.example` — đã thêm JWT_ACCESS_TOKEN_SECRET, JWT_REFRESH_TOKEN_SECRET

### ✅ Bước 6: Identity Service Logic
- **Auth service** (`auth.service.ts`): `handleGoogleLogin()`, `refreshToken()`, `logout()`
- **Users service** (`users.service.ts`): `findAll()`, `findById()`, `banUser()`, `unbanUser()`, `assignRole()`
- **RBAC service** (`rbac.service.ts`): `getRoles`, `getRoleWithPermissions`, `createRole`, `updateRole`, `deleteRole`, `getPermissions`, `assignPermissionsToRole`, `getPermissionsByUserId`
- **gRPC Controllers:** AuthController, UsersController, RbacController với `@GrpcMethod`

### ✅ Bước 7: API Gateway — Controllers
- **Auth:** `auth.controller.ts` — Google OAuth redirect flow (Passport), refresh, logout
- **Users:** `users.controller.ts` — CRUD users + ban/unban/assign-role
- **RBAC:** `rbac.controller.ts` — roles & permissions CRUD
- **IdentityService:** `identity.service.ts` — gRPC wrapper client

### ✅ Bước 8: RbacPermissionResolver
- `identity.module.ts` implements `OnModuleInit`, gọi `rbacService.setPermissionResolver()` gọi gRPC `GetUserPermissions`

### ✅ Bước 9: Global Guards
- `app.module.ts` — `AuthGuard` (JWT) + `PermissionRbacGuard` registered as `APP_GUARD`

### ✅ Bước 10: Sync permissions script
- **File:** `scripts/sync-permissions.ts` — Seeds 6 roles + permissions vào DB
- **Script:** `npm run sync:permissions`

---

### 🆕 Bước 12: Chuyển Google OAuth sang Server-Side Redirect Flow

**Vấn đề:** Endpoint `POST /auth/google/callback` nhận raw user info `{ email, firstName, ... }` từ client body → **Client có thể giả mạo Google profile**, không an toàn cho production.

**Giải pháp:** Chuyển sang server-side OAuth 2.0 redirect flow qua Passport (tham khảo `orchid-pal-be`).

#### Những file đã tạo/sửa:

| File | Thay đổi |
|---|---|
| `apps/.../auth/strategies/google.strategy.ts` | **Mới** — Passport strategy dùng `passport-google-oauth20`; `validate()` gọi gRPC `googleLogin` |
| `apps/.../auth/guards/google.guard.ts` | **Mới** — Guard xử lý `platform=mobile` + `app_redirect` qua `state` param; handle cancel redirect cho mobile |
| `apps/.../auth/auth.controller.ts` | **Sửa** — `GET /auth/google` → redirect Google consent; **Xóa** `POST /auth/google/callback` cũ; **Thêm** `GET /auth/google/callback` → redirect về mobile/web kèm tokens |
| `apps/.../auth/auth.swagger.ts` | **Sửa** — Cập nhật docs cho redirect flow |
| `apps/.../identity.module.ts` | **Sửa** — Thêm `PassportModule.register()` + `GoogleStrategy` + `GoogleOauthGuard` vào providers |

#### Flow mới:

**Web:**
```
GET /auth/google
  → redirect Google consent screen
  → Google redirect → GET /auth/google/callback?code=...&state=...
  → GoogleStrategy exchange code → fetch profile from Google API
  → gRPC identity-service → JWT
  → set httpOnly cookie (refresh_token) + redirect FRONTEND_URL?token=<JWT>
```

**Mobile (Android/iOS):**
```
GET /auth/google?platform=mobile&app_redirect=myapp://callback
  → redirect Google consent screen
  → Google redirect → GET /auth/google/callback?code=...&state=<base64url>
  → GoogleStrategy exchange code → fetch profile from Google API
  → gRPC identity-service → JWT
  → redirect myapp://callback?token=<JWT>&refreshToken=<RT>
```

> **Quan trọng:** Bạn cần thêm `http://localhost:3000/auth/google/callback` vào **Authorized redirect URIs** trong Google Cloud Console.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | Public | Initiate Google OAuth (redirect) |
| `GET` | `/auth/google/callback` | Public | Google OAuth callback (internal, redirect) |
| `POST` | `/auth/refresh` | Cookie | Refresh access token |
| `POST` | `/auth/logout` | Cookie | Logout |
| `GET` | `/users` | JWT | List users (paginated) |
| `GET` | `/users/:id` | JWT | Get user by ID |
| `PATCH` | `/users/:id/ban` | JWT | Ban user |
| `PATCH` | `/users/:id/unban` | JWT | Unban user |
| `POST` | `/users/:id/assign-role` | JWT | Assign role to user |
| `GET` | `/rbac/roles` | JWT | List all roles |
| `GET` | `/rbac/roles/:id` | JWT | Get role with permissions |
| `POST` | `/rbac/roles` | JWT | Create role |
| `PATCH` | `/rbac/roles/:id` | JWT | Update role |
| `DELETE` | `/rbac/roles/:id` | JWT | Delete role |
| `GET` | `/rbac/permissions` | JWT | List all permissions |
| `POST` | `/rbac/permissions/assign` | JWT | Assign permissions to role |

---

## API Gateway Endpoints

| Endpoint | Gốc | Chi tiết |
|---|---|---|
| `POST /auth/google/callback` (cũ) | `apps/api-gateway/src/modules/identity/auth/auth.controller.ts` | **Đã xóa** — nhận raw body từ client |
| `GET /auth/google` (mới) | `apps/api-gateway/src/modules/identity/auth/auth.controller.ts:38` | Redirect Google consent |
| `GET /auth/google/callback` (mới) | `apps/api-gateway/src/modules/identity/auth/auth.controller.ts:46` | Passport OAuth callback |

---

## Tổng kết: Những gì đã hoàn thành

### ✅ AI đã làm (code):
| Bước | File/Folder | Nội dung |
|---|---|---|
| 1 | `libs/prisma/prisma/schema.prisma` | Thêm model `refresh_tokens` |
| 2 | `proto/identity.proto` | Đầy đủ RPC methods |
| 3 | `libs/common/src/enums/role.enum.ts` | 6 roles |
| 4 | `libs/common/src/enums/permission.enum.ts` | 12 permissions |
| 5 | `libs/common/src/config/jwt.config.ts`, `.env.example` | Tách JWT secrets |
| 6 | `apps/identity-service/src/**` | Auth, Users, RBAC services + controllers |
| 7 | `apps/api-gateway/src/modules/identity/**` | Auth, Users, RBAC controllers + Passport Google OAuth |
| 8 | `apps/api-gateway/src/modules/identity/identity.module.ts` | RbacPermissionResolver + PassportModule |
| 9 | `apps/api-gateway/src/app.module.ts` | Global guards (AuthGuard, PermissionRbacGuard) |
| 10 | `scripts/sync-permissions.ts` | Seed script |
| 12 | `apps/api-gateway/src/modules/identity/auth/strategies/google.strategy.ts` | Passport Google strategy |
| 12 | `apps/api-gateway/src/modules/identity/auth/guards/google.guard.ts` | Google OAuth guard (mobile support) |

### 🔧 Bạn cần làm:
| Bước | Hành động | Ghi chú |
|---|---|---|
| 1a | Chạy `npm run prisma:migrate -- --name add_refresh_tokens` | Tạo migration cho `refresh_tokens` model |
| 1b | Chạy `npm run prisma:generate` | Generate Prisma client |
| 10 | Chạy `npm run sync:permissions` | Seed roles & permissions vào DB |
| 11a | Uncomment `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` trong `.env` | Cần Google OAuth credentials |
| 11b | Thêm `http://localhost:3000/auth/google/callback` vào Authorized redirect URIs | Trong Google Cloud Console |
| - | Chạy `npm run start:dev identity-service` | Test identity service |
| - | Chạy `npm run start:dev api-gateway` | Test API gateway |
