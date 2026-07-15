# Bioring Backend — Session Summary

**Ngày:** 2026-07-19 (updated)
**Dự án:** Monorepo NestJS + gRPC — D:\BTFPT\WDP\bioring-be
**Branch:** dev

---

## 1. Tổng quan dự án

**Nền tảng O2O** cho phép khách hàng thiết kế và đặt mua nhẫn trơn cá nhân hóa bằng công nghệ sinh trắc học (khắc vân tay, sóng âm lên nhẫn; nhịp tim hiển thị trên memory card).

**Kiến trúc:**
```
Client ──HTTP──> API Gateway (:3000) ──gRPC──> Ecommerce Service (:50051) ──Prisma──> PostgreSQL
                                              ──gRPC──> Identity Service (:50052)
                                              ──gRPC──> Biometric Service (:50053) ──HTTP──> Python FastAPI (:5051)
```

**6 luồng nghiệp vụ — TẤT CẢ ĐÃ IMPLEMENT:**

| Flow | Mô tả | Status |
|------|-------|--------|
| MF-01 | Web Design — Guest thiết kế cơ bản, nhận Design Code | ✅ Complete |
| MF-02 | Online Order (SW) — Thu âm, waveform, Manager duyệt | ✅ Complete |
| MF-03 | Offline Order (FP/HB/SW+FP...) — IoT capture tại store | ✅ Complete |
| MF-04 | Walk-in Guest — Staff iPad + khách vãng lai | ✅ Complete |
| MF-05 | Delivery, Pickup & QR Memory — Giao nhận + bảo hành | ✅ Complete |
| MF-06 | Warranty & Service Claim — Bảo hành + sửa chữa | ✅ Complete |

---

## 2. Trạng thái hiện tại — Thống kê

| Danh mục | Số lượng |
|----------|----------|
| Module ecommerce-service | 12 module |
| Controller ecommerce-service | 11 controller + 1 notification listener |
| Controller api-gateway ecommerce | 13 controller |
| Enum files | 17 enums |
| DTO files (ecommerce) | 61 files |
| gRPC RPCs | 72 RPCs |
| Prisma models | 40 models |
| Notification files | 6 files |
| Manual test docs | 4 files (MF01-MF05) |

---

## 3. Những gì đã implement trong các session gần đây

### 3.1 MF-04: Walk-in Guest (09/07/2026)

**Flow:** Staff tạo guest session (GUE-XXXXXX) → tạo order (AWAITING_SUBMIT) → chọn package + upload biometric → Guest quét QR vào tablet → Simple/Advanced Design → Memory Card → Shipping Info → Submit → Manager Review → FULL Payment → ... → COMPLETED

**Auth pattern:** Staff dùng JWT + OrderWrite; Guest dùng `@Public()` + guest_code trong query/body.

**Files:** 9 mới, 6 sửa, 0 migration. Schema tận dụng `orders.guest_customer_id` + `orders.created_by_staff_id` có sẵn.

### 3.2 System Enhancements (09-19/07/2026)

| # | Feature | Status |
|---|---------|--------|
| P0 | Validate biometrics trước submit (kiểm tra đủ file upload) | ✅ |
| P1 | CANCELLED status handling (10 trạng thái cancelable) | ✅ |
| P2 | Guest Convert → Registered User (hook trong auth.service.ts) | ✅ |
| P3 | Shared Ownership — recipientEmail (schema: `shared_user_id` + email notify) | ✅ |
| P4 | Biometric Capture Session Management (CRUD sessions tại store) | ✅ |
| P5 | Admin Dashboard API (Redis cache TTL 300s, 4 endpoints) | ✅ |

**Total:** 36 files mới + 20 files sửa, 2 migrations, 0 broken builds.

### 3.3 Notification System (10-12/07/2026)

**Kiến trúc:** EventEmitter2 → NotificationListener → EmailService (SendGrid direct, không queue).

**7 events:** order.submitted (gửi manager), order.approved, order.rejected, payment.confirmed, order.production_started, order.ready_for_delivery, order.delivered.

**7 HTML templates inline** (không MJML), **tracking pixel endpoint** (`GET /api/v1/track/open?id=xxx`), **SendGrid integration** với `email_trackings` DB.

**Files:** 6 mới, 7 sửa, 1 migration.

### 3.4 Staff Dashboard POS (19/07/2026)

| # | API | Mục đích |
|---|-----|----------|
| 1 | `GET /api/v1/customers/lookup?email=` | Check Member/Walk-in/New |
| 2 | `POST /api/v1/orders/:id/payments/manual` | Staff thu tiền mặt `method=MANUAL` |
| 3 | `GET /api/v1/orders/:id/payment-status` | Xem trạng thái từng payment phase |

**Files:** 7 mới, 14 sửa, 0 migration.

### 3.5 MF-06: Warranty & Service Claim (19/07/2026)

**Flow:** Customer/Guest tạo claim (WCL-XXXXXX) → Manager review (approve/quotation/reject) → Customer confirm + pay extra fee → Staff nhận sp + assign jeweler → Jeweler sửa xong → Staff trả sp → COMPLETED

**Status machine:** PENDING_REVIEW → APPROVED/QUOTATION_SENT → AWAITING_PAYMENT → PENDING_RECEIVE → IN_SERVICE → COMPLETED

**Guest support:** Claim bằng `order_code` lookup (giống MF-05), gắn `guest_customer_id`.

**10 HTTP endpoints**, **10 gRPC RPCs**, **5 DTOs**, **0 migration** (toàn bộ schema đã có sẵn).

**Files:** 16 mới, 5 sửa.

---

## 4. Schema key points

- **1 Order = 1 Engraving** (1:1) — FK `orders.engraving_id` @unique
- `engraving_versions.selected_biometrics` — column riêng, dạng CSV: `"SW"`, `"SW,FP"`, etc.
- `orders.package_type` — server derive từ `selected_biometrics`, dạng: `"SW"`, `"SW_FP"`, etc.
- `orders.guest_customer_id` — link guest → order (MF-04)
- `guest_customers.converted_user_id` — auto-convert khi guest đăng ký (P2)
- `qr_memories.shared_user_id` — shared ownership (P3)
- `email_trackings` — tracking pixel + open count
- `warranty_claims` + `service_tickets` + `staff_assignments` — MF-06
- `biometric_capture_sessions` + `biometric_capture_items` — P4

---

## 5. Order status machine (đầy đủ)

```
AWAITING_SUBMIT ──submit──> PENDING_REVIEW ↔ REVISION_REQUIRED
  ├── (MF-02 online: SW → AWAITING_SUBMIT)
  └── (MF-03 offline: FP/HB → AWAITING_DEPOSIT_1 → AWAITING_SUBMIT)

PENDING_REVIEW ──approve──> AWAITING_DEPOSIT ──pay──> DEPOSIT_PAID
  └──reject──> REVISION_REQUIRED ──resubmit──> PENDING_REVIEW

DEPOSIT_PAID ──assign──> IN_PRODUCTION ──complete──> PENDING_QC
  └── (MF-04 guest: FULL paid → DEPOSIT_PAID)

PENDING_QC ──QC PASS──> READY_FOR_DELIVERY (remaining=0)
  └──QC PASS──> AWAITING_REMAINING (remaining>0) ──pay──> READY_FOR_DELIVERY
  └──QC FAIL──> IN_PRODUCTION

READY_FOR_DELIVERY ──PICKUP──> READY_FOR_PICKUP ──confirm──> DELIVERED
  └──DELIVERY──> READY_FOR_DELIVERY ──start──> SHIPPING ──confirm──> DELIVERED

DELIVERED ──auto─> COMPLETED (create warranty + unlock QR)

Any state (trừ SHIPPING/DELIVERED/COMPLETED) ──cancel──> CANCELLED
```

---

## 6. Payment flow

| Flow | Payment Phases | Method |
|------|---------------|--------|
| MF-02 (SW online) | DEPOSIT_2 + REMAINING | PayOS online |
| MF-03 (offline) | DEPOSIT_1 + DEPOSIT_2 + REMAINING | PayOS online |
| MF-04 (walk-in) | FULL (100%) | PayOS hoặc Manual POS |
| Staff POS | Bất kỳ phase nào | Manual (tiền mặt/chuyển khoản) |
| MF-06 warranty | EXTRA_FEE | PayOS |

**Manual payment endpoint:** `POST /api/v1/orders/:id/payments/manual` — Staff xác nhận thu tiền, `method=MANUAL`, `status=PAID` ngay lập tức (không qua PayOS).

---

## 7. Notification System

**7 events**, **7 HTML templates**, **SendGrid direct send**:

| Event | Gửi cho | Khi nào |
|-------|---------|---------|
| `order.submitted` | Manager/Admin | Order → PENDING_REVIEW |
| `order.approved` | Customer/Guest | Manager approve |
| `order.rejected` | Customer/Guest | Manager reject |
| `payment.confirmed` | Customer/Guest | PayOS webhook / manual payment |
| `order.production_started` | Customer/Guest | Assign jeweler |
| `order.ready_for_delivery` | Customer/Guest | QC PASS + remaining=0 |
| `order.delivered` | Customer/Guest | DELIVERED → COMPLETED |

**Tracking pixel:** `GET /api/v1/track/open?id=EMAIL_ID` → update `email_trackings.opened_at`.

**Source email:** `users.email` cho customer, `guest_customers.email` cho guest.

---

## 8. Guest/User Convert Flow

Khi guest walk-in (có email) sau này đăng ký Google OAuth:
1. `convertGuest()` — tìm `guest_customers.email` trùng → update `converted_user_id` + `orders.user_id`
2. `shareQrMemories()` — tìm `qr_memories.recipient_email` trùng → update `shared_user_id`, `is_locked=false`
3. Gửi email SendGrid thông báo

---

## 9. Key files cần biết

### Business logic (ecommerce-service)
| File | Chức năng |
|------|-----------|
| `apps/ecommerce-service/src/order/order.service.ts` | Order + payment + production + delivery + cancellation + manual payment |
| `apps/ecommerce-service/src/engraving/engraving.service.ts` | Engraving CRUD + version config |
| `apps/ecommerce-service/src/guest/guest.service.ts` | Guest session + order + design + submit + shipping + biometrics validation |
| `apps/ecommerce-service/src/design/design.service.ts` | Design draft CRUD + claim |
| `apps/ecommerce-service/src/warranty/warranty.service.ts` | Warranty claim + service ticket + review + payment |
| `apps/ecommerce-service/src/admin/admin.service.ts` | Dashboard summary + stats |
| `apps/ecommerce-service/src/customer/customer.service.ts` | Customer lookup (member/walk-in) |
| `apps/ecommerce-service/src/capture-session/capture-session.service.ts` | IoT capture session CRUD |
| `apps/ecommerce-service/src/notification/notification.listener.ts` | @OnEvent listeners → gửi email |
| `apps/identity-service/src/auth/auth.service.ts` | Google OAuth + guest convert + QR share |

### Gateway (api-gateway)
| File | Chức năng |
|------|-----------|
| `apps/api-gateway/src/modules/ecommerce/` | 13 controllers (catalog, design, order, engraving, memory-card, card-theme, guest, guest-tablet, admin, capture-session, customer, warranty) |
| `apps/api-gateway/src/modules/track/track.controller.ts` | Email tracking pixel |

### Shared libs
| File | Chức năng |
|------|-----------|
| `libs/common/src/enums/` | 17 enum files |
| `libs/common/src/dtos/ecommerce/` | 61 DTO files (13 thư mục con) |
| `libs/common/src/notification/` | EmailService + templates + module |
| `libs/prisma/prisma/schema.prisma` | 40 models |
| `proto/ecommerce.proto` | 72 RPCs |

---

## 10. Convention & Rules (luôn áp dụng)

### Swagger
- Mỗi endpoint có `@ApiOperation()`, `@ApiOkResponse()` / `@ApiCreatedResponse()`
- Response example đúng wrapper (`{ claim: {...} }`, `{ guest: {...} }`)
- Status code khớp với controller logic

### UUID
- Route params: `new ParseUUIDPipe({ version: '4' })`
- DTO fields: `@IsUUID('4')`

### List API
- Mọi array response phải dùng `?? []` fallback
- Paginated list phải fallback cả `meta`

### customization_config
- `selectedBiometrics` lưu ở column riêng `engraving_versions.selected_biometrics` (CSV)
- `engravedType`, `engravingPositions`, `memoryCard` trong `customization_config` JSON
- `packageType` derive từ `selectedBiometrics` bởi server
- **Không dùng customization_config để xử lý business logic** — chỉ là FE display data

### No `any` types
- gRPC controller: inline typed interfaces cho method params
- HTTP controller: DTO + class-validator
- Service internal: typed record interfaces

---

## 11. Out of scope (chưa làm)

### Infrastructure
- ❌ SMS notification (cần Twilio)
- ❌ Push notification (cần FCM)
- ❌ Deep link `bioring://` trong email template
- ❌ Rate limiting cho public endpoints
- ❌ Audit logging tự động

### Features
- ❌ AI Chat suggest designs (bảng `ai_sessions`/`ai_messages` đã có)

### Sprint "Hoàn thiện & Bàn giao" (19/07/2026)
- ✅ **P1: Deep link trong email templates** — 6/7 templates có nút "Mở App Bioring" với `bioring://` + web fallback
- ✅ **P3: Audit logging** — AuditListener module + emits ở submit/approve/reject/payment
- ✅ **P4: Manual test doc MF-06** — 12 bước test + edge cases + variable reference
- ⏸️ **P0: Rate limiting** — chọn Redis-based guard, 30p implement
- ⏸️ **P2: Refund ghi nhận** — manual confirm (PayOS không hỗ trợ refund API), 30p implement
- ❌ Hardware IoT integration (hiện tại upload file thủ công)
- ❌ Payment refund flow qua PayOS

### Migration — Tất cả đã có
- ✅ `20260710155500_add_email_trackings`
- ✅ `20260709155323_add_shared_user_id`
- ✅ `20260702202137_add_selected_biometrics_and_engraving_id`
- ✅ 7 migrations khác cho MF-02/03/05
