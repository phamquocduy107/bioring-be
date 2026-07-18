# OrchidPal IAM Service — Phân Tích Chi Tiết

## 1. Tổng Quan

**IAM Service** (Identity & Access Management) là một **NestJS microservice** trong hệ thống OrchidPal, chịu trách nhiệm quản lý danh tính, xác thực và phân quyền người dùng. Service này **không có HTTP endpoint** — giao tiếp hoàn toàn qua **TCP message patterns** với **API Gateway**.

---

## 2. Chức Năng Chi Tiết

### 2.1. Xác Thực (Authentication) — `auth/`

| Chức năng | Message Pattern | Mô tả |
|---|---|---|
| Google OAuth Login | `{ cmd: 'google_login' }` | Nhận thông tin profile Google, tìm/tạo user, sinh JWT access + refresh token, giới hạn 5 refresh token active/user |
| Refresh Token | `{ cmd: 'refresh_token' }` | Xác thực refresh token cũ, xoay vòng (rotate) cấp cặp token mới, xóa token cũ trong transaction |
| Logout | `{ cmd: 'logout' }` | Thu hồi refresh token (xóa khỏi DB) |

**Luồng xử lý Google Login:**
1. API Gateway nhận callback Google OAuth
2. Gateway gửi TCP message `google_login` tới IAM Service
3. IAM tra email trong bảng `users`, nếu chưa có thì tạo mới với role mặc định (`DEFAULT_USER_ROLE`)
4. Sinh JWT access token + refresh token
5. Nếu user đã có >= 5 refresh token active, xóa token cũ nhất
6. Lưu refresh token vào bảng `refresh_tokens` kèm `device_agent` và `ip_address`
7. Trả `{ user, accessToken, refreshToken }` về Gateway

### 2.2. Phân Quyền (RBAC) — `rbac/`

| Chức năng | Message Pattern | Mô tả |
|---|---|---|
| Danh sách roles | `{ cmd: 'get_roles' }` | Liệt kê tất cả roles |
| Tạo role | `{ cmd: 'create_role' }` | Tạo role mới (name tự động viết hoa), kiểm tra trùng |
| Cập nhật role | `{ cmd: 'update_role' }` | Cập nhật tên/mô tả, không cho sửa System Role (id=1) |
| Xóa role | `{ cmd: 'delete_role' }` | Xóa role, không cho xóa System Role (id=1) |
| Role chi tiết + permissions | `{ cmd: 'get_role_with_permissions' }` | Lấy role kèm permissions qua bảng junction `role_permissions` |
| Danh sách permissions | `{ cmd: 'get_permissions' }` | Liệt kê tất cả permissions |
| Gán permissions cho role | `{ cmd: 'assign_permissions_to_role' }` | Xóa hết permissions cũ, insert permissions mới trong transaction |

### 2.3. Quản Lý Người Dùng (Users) — `users/`

| Chức năng | Message Pattern | Mô tả |
|---|---|---|
| Danh sách users | `{ cmd: 'get_users' }` | Phân trang, select các field không nhạy cảm (id, email, full_name, phone, avatar_url, preferences, is_active) |
| Khóa user | `{ cmd: 'ban_user' }` | Soft-deactivate: set `is_active = false` |
| Gán role cho user | `{ cmd: 'assign_role' }` | Kiểm tra user và role tồn tại, kiểm tra trùng, tạo entry trong `user_roles` |

### 2.4. Background Worker — `worker/`

| Chức năng | Công nghệ | Mô tả |
|---|---|---|
| Dọn token hết hạn | BullMQ + Redis | Cron job chạy lúc **00:00 mỗi ngày**, xóa các `refresh_tokens` có `expires_at < now()` |

---

## 3. Database Models (Prisma ORM — PostgreSQL)

| Model | Fields chính | Quan hệ |
|---|---|---|
| `users` | id (UUID), email, full_name, avatar_url, password_hash, phone, preferences, is_active, created_at | `user_roles`, `refresh_tokens` |
| `roles` | id (int), name (unique), description | `user_roles`, `role_permissions` |
| `permissions` | id (int), slug (unique), description | `role_permissions` |
| `user_roles` | user_id + role_id (composite unique) | junction |
| `role_permissions` | role_id + permission_id | junction |
| `refresh_tokens` | id, user_id, token (unique), expires_at, is_revoked, device_agent, ip_address, created_at | N:1 với `users` |

---

## 4. Technology Stack

| Công nghệ | Mục đích |
|---|---|
| **NestJS 11** (Node.js/TypeScript) | Framework chính |
| **@nestjs/microservices** | TCP transport — giao tiếp với API Gateway |
| **@nestjs/jwt** | Sinh và xác thực JWT access token & refresh token |
| **@nestjs/config** | Quản lý biến môi trường |
| **Prisma ORM 6** + PostgreSQL 16 | Truy vấn & migration database |
| **BullMQ** + Redis 7 | Queue xử lý background jobs (dọn token hết hạn) |
| **@nestjs/bullmq** | BullMQ integration cho NestJS |
| **dotenv** | Load biến môi trường |
| **@app/common** (shared library) | DTOs, constants, filters, pipes, interceptors, queue config |
| **@app/prisma** (shared library) | PrismaService instance dùng chung |

---

## 5. Kiến Trúc Giao Tiếp

```
┌──────────────┐       TCP (MessagePattern)       ┌──────────────┐
│              │  ──────────────────────────────>  │              │
│  API Gateway │  { cmd: 'google_login' }          │  IAM Service │
│  (port 3000) │  { cmd: 'refresh_token' }         │  (port 3001) │
│              │  { cmd: 'logout' }                 │              │
│              │  { cmd: 'get_roles' }              │              │
│              │  { cmd: 'create_role' }            │              │
│              │  { cmd: 'get_users' }              │              │
│              │  { cmd: 'ban_user' }               │              │
│              │  ...                               │              │
└──────────────┘                                    └──────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  PostgreSQL  │
                                                    │  (port 5435) │
                                                    └──────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  Redis       │
                                                    │  (BullMQ)    │
                                                    └──────────────┘
```

---

## 6. Global Providers (áp dụng toàn service)

| Provider | Mục đích |
|---|---|
| `FitRpcExceptionFilter` | Format lỗi RPC trả về cho API Gateway |
| `CustomValidationPipe` | Validate DTOs đầu vào |
| `LoggingInterceptor` | Ghi log request/response |
| `TimeoutInterceptor` | Xử lý timeout request |

---

## 7. Tổng Kết

**IAM Service** là một microservice thuần túy (pure microservice) với các đặc điểm:
- **Chỉ giao tiếp qua TCP** — không expose HTTP, không có Swagger
- **Chịu trách nhiệm duy nhất (Single Responsibility):** toàn bộ logic xác thực và phân quyền tập trung tại đây
- **Sử dụng JWT token rotation** với cơ chế revoke token cũ, giới hạn 5 refresh token active/user
- **Phân quyền dạng RBAC** với 3 model: roles ↔ permissions (many-to-many qua bảng junction), users ↔ roles (many-to-many)
- **Bảo vệ System Role** (id=1) — không cho phép sửa/xóa/gán permissions
- **Background job** dùng BullMQ chạy cron hàng ngày dọn token hết hạn
- **Tech stack quen thuộc:** NestJS + Prisma + PostgreSQL + Redis/BullMQ
