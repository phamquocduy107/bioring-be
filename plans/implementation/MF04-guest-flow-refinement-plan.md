# MF04 — Walk-in Guest Flow Refinement Plan (Updated 2026-07-27)

## Summary of changes

**Phase 1 (initial):** QR memory at engraving time, lock core after order, delivery/payment endpoints, confirmPlacement notes.
**Phase 2 (team feedback):** Guest tự tạo engraving + order từ tablet (public endpoints), staffId optional, guest_customer_id, bỏ biometric validation ở create order.

### Changes implemented

1. **QR memory created at engraving time** (not order time) ✅
2. **Core selection locked permanently** after order creation ✅
3. **Guest edits customization_config + memcard** after biometric collection ✅
4. **Submit → Manager approve → Delivery → Payment** ✅
5. **Guest fills delivery method + address** after manager approves ✅
6. **Guest pays FULL online** via PayOS after delivery is set ✅
7. **confirmPlacement NOT used** — notes added to 6 files ✅
8. **Public endpoints** — `POST /guest-tablet/engravings` + `POST /guest-tablet/orders` dành cho guest (không JWT) ✅
9. **staffId optional** — cả createGuestEngraving và createGuestOrder chấp nhận staffId rỗng (guest tự gọi) ✅
10. **guest_customer_id** — set engraving.guest_customer_id khi guest tạo engraving ✅
11. **Bỏ biometric validation ở createGuestOrder** — chuyển hết sang guestSubmitOrder ✅

---

## 1. Tổng quan flow

### Phân vai
| Actor | Công cụ | Việc làm |
|-------|---------|----------|
| Staff | Web (JWT) | Tạo session, refresh monitor, assign biometrics |
| Guest | Tablet (public) | Browse product, design, tạo order, edit biometric, submit |
| Manager | Web (JWT) | Review, assign jeweler |

### Flow diagram

```
STAFF (JWT)                        GUEST TABLET (@Public)              MANAGER
═══════════                       ══════════════════════               ═══════
POST /guest/sessions                  
  → guest_code                        
                                      [Browse collection — no code]
                                      [Product detail → "Design your ring"]
                                      → nhập guestCode
                                      POST /guest-tablet/engravings
                                      → engraving + version v1 + qr_memories
                                      PATCH /:vId/config
                                      → set material, gem, size, package
                                      [Package selection → popup confirm]
                                      POST /guest-tablet/orders
                                      → order AWAITING_SUBMIT
                                      → LOCK core fields
                                      → auto end session, back to browse
│
[Staff Refresh]                       
GET /sessions/:guestCode              
→ thấy order + config                 
Admin upload/approve/assign biometrics
  → biometric_assets linked           
                                      │
                                      [Guest returns → "Already have an order?"]
                                      GET /sessions/:guestCode
                                      → load order + biometric_assets
                                      → UI jump to edit biometric step
                                      (các step khác greyed out)
                                      
                                      PATCH /:vId/config
                                      → chỉ customizationConfig
                                      
                                      PUT /qr-memories/:engravingId
                                      → edit memcard
                                      
                                      [Confirm → popup final]
                                      PATCH /orders/:id/submit
                                      → PENDING_REVIEW
                                                           │
                                              ┌─────────────┴─────────────┐
                                         PUT /orders/:id/review          │
                                         → approve                       │
                                         → AWAITING_DEPOSIT ←────────────┘
                                         → reject → REVISION_REQUIRED
                                      
                                      POST /orders/:id/delivery
                                      → shipment (shipping_address_text)
                                      
                                      POST /orders/:id/pay
                                      → PayOS FULL payment
                                      → paymentUrl + qrCode
                                      
STAFF                           SYSTEM
═════                           ══════
POST /assign-jeweler            webhook FULL paid
  → IN_PRODUCTION                 → DEPOSIT_PAID
  → ... MF02/MF03                 → ready for production
```

---

## 2. Changes implemented

### 2.1 StaffId optional + guest_customer_id (Phase 2)

| File | Change |
|------|--------|
| `guest.service.ts:createGuestEngraving` | `staffId: string` → `staffId?: string`, `user_id: data.staffId \|\| null`, thêm `guest_customer_id: guest.id` |
| `guest.service.ts:createGuestOrder` | `staffId: string` → `staffId?: string`, `created_by_staff_id: data.staffId \|\| null` |

Cho phép guest tự gọi tạo engraving/order từ tablet (gửi staffId rỗng). Engraving được gán `guest_customer_id` để validate ownership sau này.

### 2.2 QR memory at engraving time (Phase 1)

| File | Change |
|------|--------|
| `guest.service.ts:createGuestEngraving` | Add `qr_memories.create` (qr_code, access_pin_hash, is_locked=true) |
| `guest.service.ts:createGuestOrder` | Remove `qr_memories` fallback |

### 2.3 Lock core fields after order (Phase 1)

| File | Change |
|------|--------|
| `guest.service.ts:guestUpdateEngravingConfig` | Check `hasOrder` → strip `selectedMaterialId`/`selectedGemstoneId`/`ringSize`/`ringStyle`/`ringShape`/`selectedBiometrics` khi order đã tồn tại; chỉ cho phép `customizationConfig` |

### 2.4 Biometric validation moved to submit (Phase 2)

| File | Change |
|------|--------|
| `guest.service.ts:createGuestOrder` | Xoá block validate biometric (lines 218-236 cũ). Biometric chỉ được check ở `guestSubmitOrder` → `validateBiometricsReady` |

Lý do: Trong flow mới, order được tạo tại step package selection **trước khi** staff assign biometrics.

### 2.5 Guest delivery endpoint (Phase 1)

| File | Change |
|------|--------|
| `guest.service.ts:guestSetShippingInfo` | Validate status `AWAITING_DEPOSIT`, tạo shipment với `shipping_address_text` |
| `guest-tablet.controller.ts` | `POST /api/v1/guest-tablet/orders/:orderId/delivery` |

**Note:** `user_address` với `user_id=null` không khả thi (schema requires FK). Lưu address text vào `shipment.shipping_address_text`.

### 2.6 Guest payment endpoint (Phase 1)

| File | Change |
|------|--------|
| `guest.service.ts:guestInitiatePayment` | Wrapper gọi `orderService.initiatePayment` với `paymentPhase = 'FULL'` + validate guest ownership |
| `guest-tablet.controller.ts` | `POST /api/v1/guest-tablet/orders/:orderId/pay` |

### 2.7 Public endpoints for guest (Phase 2)

| File | Change |
|------|--------|
| `guest-tablet.controller.ts` | Thêm `POST /api/v1/guest-tablet/engravings` (public) + `POST /api/v1/guest-tablet/orders` (public) — gọi gRPC với `staffId: ''` |
| `guest-tablet.swagger.ts` | Thêm `ApiGuestCreateEngravingDocs()` + `ApiGuestCreateOrderDocs()` |

### 2.8 confirmPlacement — NOT used (Phase 1)

| File | Status |
|------|--------|
| 6 files (proto, controllers, service, swagger, dto) | ✅ Commented |

### 2.9 Status flow

```
... → PENDING_REVIEW → [manager approve] → AWAITING_DEPOSIT
      → [guest set delivery] → [guest pay FULL] → DEPOSIT_PAID
      → [assign jeweler] → IN_PRODUCTION → ... → COMPLETED
```

---

## 3. Endpoints (all implemented)

| Endpoint | Auth | Mục đích |
|----------|------|----------|
| `POST /api/v1/guest/sessions` | `order.write` | Staff tạo guest session |
| `POST /api/v1/guest-tablet/engravings` | @Public | Guest tạo engraving (bấm "Design your ring") |
| `POST /api/v1/guest-tablet/orders` | @Public | Guest tạo order (confirm tại package selection) |
| `PATCH /api/v1/guest-tablet/engravings/:versionId/config` | @Public | Guest update config (lock logic built-in) |
| `GET /api/v1/guest-tablet/sessions/:guestCode` | @Public | Guest xem session + order + biometrics |
| `PATCH /api/v1/guest-tablet/orders/:orderId/submit` | @Public | Guest submit → PENDING_REVIEW |
| `PUT /api/v1/guest-tablet/qr-memories/:engravingId` | @Public | Guest edit memory card |
| `POST /api/v1/guest-tablet/orders/:orderId/delivery` | @Public | Guest set delivery (PICKUP/DELIVERY) |
| `POST /api/v1/guest-tablet/orders/:orderId/pay` | @Public | Guest pay FULL via PayOS |
| `PUT /api/v1/orders/:id/review` | `order.write` | Manager review |
| Admin biometric endpoints | `order.write` | Upload / approve / assign biometrics |

---

## 4. Status: ALL DONE ✅

| # | Item | Files | Status |
|---|------|-------|--------|
| 1 | QR memory at engraving time | `guest.service.ts` | ✅ |
| 2 | Lock core fields after order | `guest.service.ts` | ✅ |
| 3 | Guest delivery endpoint | `guest.service.ts`, `guest-tablet.controller.ts` | ✅ |
| 4 | Guest payment endpoint | `guest.service.ts`, `guest-tablet.controller.ts` | ✅ |
| 5 | confirmPlacement notes | 6 files | ✅ |
| 6 | staffId optional + guest_customer_id | `guest.service.ts` | ✅ |
| 7 | Public POST engraving + order | `guest-tablet.controller.ts`, `guest-tablet.swagger.ts` | ✅ |
| 8 | Remove biometric validation at create order | `guest.service.ts` | ✅ |

---

## 5. Acceptance criteria

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | Tạo engraving → DB có qr_memories | qr_memory created with engraving_id | ✅ |
| 2 | Tạo order → PATCH config: `selectedMaterialId` bị bỏ qua | Không throw, material không đổi | ✅ |
| 3 | Tạo order → PATCH config: `customizationConfig` vẫn cập nhật được | customization_config thay đổi | ✅ |
| 4 | Tạo order → PATCH config: `selectedBiometrics` bị bỏ qua | selected_biometrics không đổi | ✅ |
| 5 | Chưa có order → PATCH config: tất cả field được update | Bình thường | ✅ |
| 6 | Guest POST delivery tại AWAITING_DEPOSIT → tạo shipment | DB có record | ✅ |
| 7 | Guest POST delivery sai status → 400 | Bad request | ✅ |
| 8 | Guest POST pay → trả paymentUrl + qrCode | PayOS link | ✅ |
| 9 | Guest tự tạo engraving (public, không JWT) | 201 + engraving created | ✅ |
| 10 | Guest tự tạo order (public, không JWT) | 201 + order AWAITING_SUBMIT | ✅ |
| 11 | Engraving có guest_customer_id khi guest tạo | DB có guest_customer_id | ✅ |
| 12 | Build pass (ecommerce + gateway) | npm run build | ✅ |
