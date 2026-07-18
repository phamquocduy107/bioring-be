# System Enhancements — Thực tế sau implement

> **Ngày implement: 09/07/2026 - 12/07/2026**

---

## P0: Validate Biometrics Trước Submit ✅

### Logic

Trong `submitOrder()` (order.service.ts) và `guestSubmitDesign()` (guest.service.ts), trước khi chuyển `PENDING_REVIEW`, kiểm tra tất cả biometric types trong package đã có `engraving_biometrics` với `status: 'CAPTURED'`.

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm validate trong `submitOrder()` |
| 2 | `apps/ecommerce-service/src/guest/guest.service.ts` | Thêm `validateBiometricsReady()` private method |

---

## P1: CANCELLED Status Handling ✅

### Logic

`cancelOrder(orderId, reason)` — cho phép cancel ở 10 trạng thái (AWAITING_SUBMIT → READY_FOR_DELIVERY). Chặn cancel ở SHIPPING, DELIVERED, COMPLETED, CANCELLED.

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `cancelOrder()` |
| 2 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm gRPC handler |
| 3 | `apps/api-gateway/.../order/order.controller.ts` | `PATCH /api/v1/orders/:id/cancel` |
| 4 | `apps/api-gateway/.../order/order.swagger.ts` | Swagger docs |
| 5 | `proto/ecommerce.proto` | Thêm `CancelOrder` RPC |

---

## P2: Guest Convert → Registered User ✅

### Logic

Hook trong `auth.service.ts` → `handleGoogleLogin()`:
- `convertGuest()`: tìm guest_customers trùng email → update `converted_user_id` + `orders.user_id`
- Không throw nếu thất bại (không block đăng ký)

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/identity-service/src/auth/auth.service.ts` | Thêm `convertGuest()` |
| 2 | `apps/identity-service/src/auth/auth.module.ts` | Đã có PrismaModule |

---

## P3: Guest Shared Ownership (recipientEmail) ✅

### Cách tiếp cận: Way D — Schema cột mới + Email notification

```prisma
model qr_memories {
  shared_user_id String?  @db.Uuid
  shared_at      DateTime?
}
```

Migration: `20260709155323_add_shared_user_id`

### Logic

Hook trong `auth.service.ts`:
- `shareQrMemories()`: tìm `qr_memories` có `recipient_email` trùng → update `shared_user_id`, `shared_at`, `is_locked = false`
- Gửi email SendGrid thông báo "Bạn vừa nhận được Memory Card"

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `libs/prisma/prisma/schema.prisma` | Thêm `shared_user_id`, `shared_at` |
| 2 | `apps/identity-service/src/auth/auth.service.ts` | Thêm `shareQrMemories()` |

### Env mới

```env
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@bioring.com
```

---

## P4: Biometric Capture Session Management ✅

### Schema

Bảng `biometric_capture_sessions` + `biometric_capture_items` đã có sẵn, không cần migration.

### API Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| `POST` | `/api/v1/capture-sessions` | OrderWrite | Tạo phiên capture |
| `PATCH` | `/api/v1/capture-sessions/:id/complete` | OrderWrite | Kết thúc capture |
| `GET` | `/api/v1/capture-sessions` | OrderWrite | List sessions |
| `GET` | `/api/v1/capture-sessions/:id` | OrderWrite | Detail session |

### Files (9 mới + 5 sửa)

| # | File | Vai trò |
|---|------|---------|
| 1 | `libs/common/src/enums/capture-session-status.enum.ts` | Enum |
| 2-4 | `libs/common/src/dtos/ecommerce/capture-session/` | 3 DTOs |
| 5-7 | `apps/ecommerce-service/src/capture-session/` | Module + controller + service |
| 8 | `apps/api-gateway/.../capture-session/capture-session.controller.ts` | REST controller |
| 9 | `proto/ecommerce.proto` | 4 RPCs + messages |
| 10 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import module |
| 11 | `apps/api-gateway/.../ecommerce.module.ts` | Register controller |
| 12 | `libs/common/src/enums/index.ts` | Export enum |
| 13 | `libs/common/src/dtos/ecommerce/index.ts` | Export DTOs |

---

## P5: Admin Dashboard API ✅

### Cách tiếp cận: Way C — Redis cache

- Ecommerce service query DB trực tiếp (Prisma aggregate/groupBy/rawQuery)
- API Gateway cache kết quả trong Redis với TTL 300s (5 phút)
- `DashboardView` permission đã có sẵn

### Endpoints

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/v1/admin/dashboard/summary` | Admin (DashboardView) |
| `GET` | `/api/v1/admin/dashboard/orders-by-status` | Admin |
| `GET` | `/api/v1/admin/dashboard/revenue-timeline` | Admin |
| `GET` | `/api/v1/admin/dashboard/top-products` | Admin |

### Files (9 mới + 5 sửa)

| # | File | Vai trò |
|---|------|---------|
| 1 | `libs/common/src/enums/permission.enum.ts` | Sửa: thêm `DashboardView` |
| 2-5 | `libs/common/src/dtos/ecommerce/admin/` | 4 DTOs |
| 6-8 | `apps/ecommerce-service/src/admin/` | Module + controller + service |
| 9-10 | `apps/api-gateway/.../admin/` | REST controller + swagger |
| 11 | `proto/ecommerce.proto` | 4 RPCs + messages |
| 12 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import module |
| 13 | `apps/api-gateway/.../ecommerce.module.ts` | Register controller |
| 14 | `scripts/sync-permissions.ts` | Sync DashboardView |

---

## Bug Fix (ngoài plan)

| Bug | File | Fix |
|-----|------|-----|
| MF-05 QC accept lần 2 reject | `order.service.ts:923` | Điều kiện QC từ `IN_PRODUCTION` → `IN_PRODUCTION \|\| PENDING_QC` |

---

## Tổng kết

| # | Feature | Status |
|---|---------|--------|
| P0 | Validate biometrics | ✅ 0 mới, 2 sửa |
| P1 | CANCELLED handling | ✅ 0 mới, 5 sửa |
| P2 | Guest convert | ✅ 0 mới, 1 sửa |
| P3 | Shared ownership | ✅ 2 migration + email notify |
| P4 | Capture session | ✅ 9 mới, 5 sửa |
| P5 | Admin dashboard | ✅ 10 mới, 4 sửa |
| Bug | MF-05 QC fix | ✅ 1 sửa |
