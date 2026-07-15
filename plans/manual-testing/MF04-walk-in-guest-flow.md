# MF04 — Walk-in Guest In-store Order — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| Staff JWT token | User có quyền `order.write` |
| Manager JWT token | User có quyền `order.write` |
| Cloudinary upload preset | Dùng cho upload biometric files |
| Giả lập PayOS | Cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `.env` |
| Tablet flow | Dùng `guestCode` thay JWT, tất cả endpoint `@Public()` |

---

## 0. Chuẩn bị biometric URLs (FP, SW)

Upload fingerprint image + audio lên Cloudinary:

```powershell
# Upload fingerprint PNG
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/image/upload" -F "file=@đường_dẫn_tới_fingerprint.png" -F "upload_preset=BioRing"

# Upload audio MP3
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/auto/upload" -F "file=@đường_dẫn_tới_audio.mp3" -F "upload_preset=BioRing"
```

Ghi nhớ `secure_url` từ response:
```
FP_URL = "https://res.cloudinary.com/dpm0zc06s/image/upload/v123/fp.png"
SW_URL = "https://res.cloudinary.com/dpm0zc06s/video/upload/v123/audio.mp3"
```

Đảm bảo Python service (`biometric-service:5051`) đang chạy để process FP → fingerprint SVG và SW → waveform SVG.

---

## 1. Staff: Tạo Guest Session

> Staff nhập thông tin khách → hệ thống sinh `guest_code`.

```http
POST /api/v1/guest/sessions
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "fullName": "Nguyễn Văn A",
  "phone": "0909123456",
  "email": "guest@example.com",
  "note": "Khách muốn nhẫn bạc"
}
```

**Expected Response (201):**
```json
{
  "guest": {
    "id": "{{GUEST_ID}}",
    "guestCode": "GUE-XXXXXX",
    "fullName": "Nguyễn Văn A",
    "phone": "0909123456",
    "email": "guest@example.com",
    "note": "Khách muốn nhẫn bạc",
    "createdAt": "2026-07-07T..."
  }
}
```

**Verify DB:**
```sql
SELECT * FROM guest_customers WHERE guest_code = 'GUE-XXXXXX';
```

> 📌 **Ghi chú:** `guest_code` format `GUE-` + 6 ký tự (không có 0/O/1/I). Dùng `guest_code` này cho tất cả tablet endpoints bên dưới.

---

## 2. Staff: Tạo Order + Engraving cho Guest

> Gộp tạo engraving + version + qr_memories + order trong 1 call.

```http
POST /api/v1/guest/orders
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "guestCustomerId": "{{GUEST_ID}}",
  "productId": "{{PRODUCT_ID}}"
}
```

**Expected Response (201):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "172000000042",
    "userId": "",
    "guestCustomerId": "{{GUEST_ID}}",
    "designSource": "WALK_IN",
    "status": "AWAITING_SUBMIT",
    "totalPrice": 13200000,
    "paidAmount": 0,
    "remainingAmount": 13200000,
    "createdAt": "2026-07-07T..."
  },
  "engraving": {
    "id": "{{ENGRAVING_ID}}",
    "userId": "{{STAFF_ID}}",
    "productId": "{{PRODUCT_ID}}",
    "status": "PENDING"
  },
  "version": {
    "id": "{{VERSION_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "versionNumber": 1,
    "status": "PENDING"
  }
}
```

**Verify DB:**
```sql
SELECT * FROM orders WHERE guest_customer_id = '{{GUEST_ID}}';
-- status = AWAITING_SUBMIT, user_id IS NULL, design_source = WALK_IN

SELECT * FROM engravings WHERE id = '{{ENGRAVING_ID}}';
-- user_id = staffId, status = PENDING

SELECT * FROM engraving_versions WHERE engraving_id = '{{ENGRAVING_ID}}';
-- version_number = 1, status = PENDING

SELECT * FROM qr_memories WHERE engraving_id = '{{ENGRAVING_ID}}';
-- is_locked = true
```

---

## 3. Staff: Chọn Package (selectedBiometrics)

> Chọn gói biometric cho đơn hàng.

```http
PATCH /api/v1/engravings/versions/{{VERSION_ID}}/config
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "selectedBiometrics": "SW,FP"
}
```

**Expected Response (200):**
```json
{
  "version": {
    "id": "{{VERSION_ID}}",
    "selectedBiometrics": "SW,FP",
    "status": "PENDING"
  }
}
```

> 📌 `selectedBiometrics` dạng CSV: `"SW"`, `"FP"`, `"HB"`, `"SW,FP"`, `"SW,FP,HB"`...

---

## 4. Staff: Upload Biometric — Finger Print (FP)

> Upload vân tay → Python process → tạo `engraving_biometrics` row.

```http
POST /api/v1/engravings/{{ENGRAVING_ID}}/biometrics
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "biometricType": "FP",
  "rawFileUrl": "{{FP_URL}}"
}
```

**Expected Response (201):**
```json
{
  "biometric": {
    "id": "{{FP_BIOMETRIC_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "biometricType": "FP",
    "requiredChannel": "ENGRAVING",
    "rawFileUrl": "{{FP_URL}}",
    "processedSvgUrl": "https://res.cloudinary.com/.../fp.svg",
    "extraData": "{}",
    "status": "CAPTURED"
  }
}
```

**Verify DB:**
```sql
SELECT * FROM engraving_biometrics WHERE engraving_id = '{{ENGRAVING_ID}}' AND biometric_type = 'FP';
-- required_channel = ENGRAVING, processed_svg_url NOT NULL, status = CAPTURED
```

---

## 5. Staff: Upload Biometric — Sound Wave (SW)

```http
POST /api/v1/engravings/{{ENGRAVING_ID}}/biometrics
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "biometricType": "SW",
  "rawFileUrl": "{{SW_URL}}"
}
```

**Expected Response (201):**
```json
{
  "biometric": {
    "id": "{{SW_BIOMETRIC_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "biometricType": "SW",
    "requiredChannel": "ENGRAVING",
    "rawFileUrl": "{{SW_URL}}",
    "processedSvgUrl": "https://res.cloudinary.com/.../waveform.svg",
    "extraData": "{}",
    "status": "CAPTURED"
  }
}
```

> 📌 Nếu package có HB: upload tương tự, `requiredChannel` sẽ là `MEMORY_CARD` (HB không khắc lên nhẫn).

---

## 6. Guest Tablet: Xem Session

> Guest quét QR → nhập `guest_code` → lấy thông tin session + order + engraving.

```http
GET /api/v1/guest-tablet/sessions/{{GUEST_CODE}}
```

**Expected Response (200):**
```json
{
  "guest": {
    "id": "{{GUEST_ID}}",
    "guestCode": "{{GUEST_CODE}}",
    "fullName": "Nguyễn Văn A",
    "phone": "0909123456"
  },
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "172000000042",
    "status": "AWAITING_SUBMIT",
    "packageType": null,
    "totalPrice": 13200000,
    "paidAmount": 0,
    "engraving": {
      "id": "{{ENGRAVING_ID}}",
      "status": "PENDING",
      "versions": [
        {
          "id": "{{VERSION_ID}}",
          "versionNumber": 1,
          "selectedBiometrics": "SW,FP",
          "status": "PENDING"
        }
      ],
      "biometrics": [
        {
          "biometricType": "FP",
          "processedSvgUrl": "https://res.cloudinary.com/.../fp.svg",
          "status": "CAPTURED"
        },
        {
          "biometricType": "SW",
          "processedSvgUrl": "https://res.cloudinary.com/.../waveform.svg",
          "status": "CAPTURED"
        }
      ]
    }
  }
}
```

> 🧪 **Test edge case:** Gọi với `guestCode` sai → 404 "Guest not found"

---

## 7. Guest Tablet: Simple Design

> Guest chọn vật liệu, đá, size, style, shape. Có thể PATCH từng field hoặc nhiều field cùng lúc.

```http
PATCH /api/v1/guest-tablet/engravings/{{VERSION_ID}}/config?guestCode={{GUEST_CODE}}
Content-Type: application/json

{
  "selectedMaterialId": "{{MATERIAL_ID}}",
  "selectedGemstoneId": "{{GEMSTONE_ID}}",
  "ringSize": "7",
  "ringStyle": "CLASSIC",
  "ringShape": "ROUND"
}
```

**Expected Response (200):**
```json
{
  "version": {
    "id": "{{VERSION_ID}}",
    "selectedMaterialId": "{{MATERIAL_ID}}",
    "selectedGemstoneId": "{{GEMSTONE_ID}}",
    "ringSize": "7",
    "ringStyle": "CLASSIC",
    "ringShape": "ROUND",
    "status": "PENDING"
  }
}
```

> 🧪 **Test edge case:** Gọi PATCH config với `guestCode` sai → 403.
> 🧪 **Test edge case:** Gọi PATCH config khi order đã submit (không phải AWAITING_SUBMIT/REVISION_REQUIRED) → 400.

---

## 8. Guest Tablet: Advanced Design (chọn engravedType + vị trí)

> Chọn loại khắc lên nhẫn (FP hoặc SW), điều chỉnh vị trí.

```http
PATCH /api/v1/guest-tablet/engravings/{{VERSION_ID}}/config?guestCode={{GUEST_CODE}}
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"fp\",\"engravingPositions\":{\"fp\":{\"enabled\":true,\"status\":\"captured\",\"imageUrl\":\"https://res.cloudinary.com/.../fp.svg\",\"position\":{\"x\":0.5,\"y\":0.3,\"rotation\":45,\"scale\":1.0}},\"sw\":{\"enabled\":false}},\"ringPreviewUrl\":\"https://res.cloudinary.com/.../ring-preview.png\"}"
}
```

**Expected Response (200):**
```json
{
  "version": {
    "id": "{{VERSION_ID}}",
    "customizationConfig": "{...}",
    "status": "PENDING"
  }
}
```

> 📌 `customizationConfig` phải là JSON string hợp lệ. `engravedType` = `"fp"` hoặc `"sw"`, chỉ 1 loại được khắc lên nhẫn.

---

## 9. Guest Tablet: Memory Card

> Guest thiết kế thiệp kỷ niệm.

```http
PUT /api/v1/guest-tablet/qr-memories/{{ENGRAVING_ID}}
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}",
  "cardTitle": "Nhẫn của chúng ta",
  "greetingMessage": "Cảm ơn em đã đến bên anh",
  "recipientEmail": "friend@example.com"
}
```

**Expected Response (200):**
```json
{
  "qrMemory": {
    "id": "{{QR_MEMORY_ID}}",
    "qrCode": "a1b2c3d4e5f6",
    "cardTitle": "Nhẫn của chúng ta",
    "greetingMessage": "Cảm ơn em đã đến bên anh",
    "recipientEmail": "friend@example.com",
    "isLocked": true
  }
}
```

---

## 10. Guest Tablet: Shipping Info

> Chọn hình thức nhận hàng. Nếu DELIVERY → nhập địa chỉ.

```http
POST /api/v1/guest-tablet/orders/{{ORDER_ID}}/shipping-info
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}",
  "deliveryMethod": "DELIVERY",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM"
}
```

**Expected Response (201):**
```json
{
  "id": "{{SHIPMENT_ID}}",
  "orderId": "{{ORDER_ID}}",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM"
}
```

**Verify DB:**
```sql
SELECT * FROM shipments WHERE order_id = '{{ORDER_ID}}';
-- status = PENDING, delivery_method = DELIVERY
```

> 🧪 **Test edge case:** Gọi lại 1 lần nữa → 400 "Shipping info already set"
> 🧪 **Test edge case:** `deliveryMethod` không phải PICKUP/DELIVERY → 400

---

## 11. Guest Tablet: Submit Design

> Guest gửi thiết kế cho Manager duyệt.

```http
PATCH /api/v1/guest-tablet/orders/{{ORDER_ID}}/submit
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}"
}
```

**Expected Response (200) — Lần đầu:**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "172000000042",
    "status": "PENDING_REVIEW",
    "isResubmit": false
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- PENDING_REVIEW
```

---

## 12. Manager: Review Order — Approve

```http
PATCH /api/v1/orders/{{ORDER_ID}}/review
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "action": "approve",
  "note": "Thiết kế đạt yêu cầu"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "AWAITING_DEPOSIT"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- AWAITING_DEPOSIT

SELECT status FROM engravings WHERE id = '{{ENGRAVING_ID}}';
-- APPROVED

SELECT status, version_number FROM engraving_versions WHERE engraving_id = '{{ENGRAVING_ID}}' ORDER BY version_number DESC;
-- version 1: APPROVED
```

---

## 13. Manager: Review Order — Reject (test riêng)

> Tạo guest mới, làm lại bước 1-11, sau đó reject.

```http
PATCH /api/v1/orders/{{ORDER_ID}}/review
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "action": "reject",
  "note": "Cần chỉnh lại vị trí khắc"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "REVISION_REQUIRED"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- REVISION_REQUIRED

SELECT status FROM engravings WHERE id = '{{ENGRAVING_ID}}';
-- REJECTED

SELECT status, version_number FROM engraving_versions WHERE engraving_id = '{{ENGRAVING_ID}}' ORDER BY version_number DESC;
-- version 1: REJECTED
-- version 2: PENDING (mới, copy config từ v1)
```

---

## 14. Guest Tablet: Resubmit sau Reject

> Guest quay lại (bước 6) → thấy order REVISION_REQUIRED + version 2 PENDING.
> Sửa design (bước 7-8) → submit lại.

```http
PATCH /api/v1/guest-tablet/orders/{{ORDER_ID}}/submit
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}"
}
```

**Expected Response (200) — Resubmit:**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "PENDING_REVIEW",
    "isResubmit": true
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- PENDING_REVIEW

SELECT status FROM engravings WHERE id = '{{ENGRAVING_ID}}';
-- PENDING
```

> 📌 Manager review lại → approve → AWAITING_DEPOSIT (như bước 12).

---

## 15. Guest Tablet: Thanh toán FULL

> Manager đã approve, order AWAITING_DEPOSIT → guest thanh toán 100%.

```http
POST /api/v1/guest-tablet/orders/{{ORDER_ID}}/payments
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}",
  "returnUrl": "bioring://payment/result",
  "cancelUrl": "bioring://payment/cancel"
}
```

**Expected Response (201):**
```json
{
  "payment": {
    "id": "{{PAYMENT_ID}}",
    "orderId": "{{ORDER_ID}}",
    "paymentPhase": "FULL",
    "amount": 13200000,
    "method": "PAYOS",
    "status": "PENDING",
    "payosTransactionId": "PAYOS-xxx",
    "paymentUrl": "https://pay.payos.vn/...",
    "qrCode": "000201010212..."
  },
  "paymentUrl": "https://pay.payos.vn/...",
  "qrCode": "000201010212..."
}
```

> 📌 Guest quét QR PayOS hoặc mở `paymentUrl` để thanh toán. Sau đó PayOS gọi webhook.

---

## 16. PayOS Webhook: FULL paid → DEPOSIT_PAID

> Giả lập webhook từ PayOS. Dùng tool postman hoặc curl tới callback URL.

```http
POST /api/v1/orders/payments/payos-callback
Content-Type: application/json

{
  "webhookBody": "{\"code\":\"00\",\"desc\":\"success\",\"success\":true,\"data\":{\"orderCode\":{{PAYOS_ORDER_CODE}},\"amount\":13200000},\"signature\":\"...\"}"
}
```

**Expected Response (200):**
```json
{
  "success": true
}
```

**Verify DB:**
```sql
SELECT status, paid_amount, remaining_amount FROM orders WHERE id = '{{ORDER_ID}}';
-- status = DEPOSIT_PAID, paid_amount = 13200000, remaining_amount = 0

SELECT status FROM payments WHERE order_id = '{{ORDER_ID}}' AND payment_phase = 'FULL';
-- PAID
```

---

## 17. Manager: Assign Jeweler (MF-05)

```http
POST /api/v1/orders/{{ORDER_ID}}/assign-jeweler
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "jewelerId": "{{JEWELER_ID}}"
}
```

**Expected Response (201):**
```json
{
  "task": {
    "id": "{{TASK_ID}}",
    "orderId": "{{ORDER_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "assignedJewelerId": "{{JEWELER_ID}}",
    "status": "IN_PROGRESS"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- IN_PRODUCTION

SELECT * FROM production_tasks WHERE order_id = '{{ORDER_ID}}';
-- status = IN_PROGRESS
```

---

## 18. Jeweler: Complete Production

```http
PUT /api/v1/production-tasks/{{TASK_ID}}/status
Authorization: Bearer {{jewelerJwt}}
Content-Type: application/json

{
  "status": "COMPLETED",
  "note": "Sản phẩm hoàn thiện"
}
```

**Expected Response (200):**
```json
{
  "task": {
    "id": "{{TASK_ID}}",
    "status": "COMPLETED",
    "completedAt": "2026-07-07T..."
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- PENDING_QC
```

---

## 19. Manager: QC Accept (MF-05)

```http
PUT /api/v1/orders/{{ORDER_ID}}/qc-accept
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "result": "PASS",
  "checklist": "{\"engraving\":true,\"material\":true,\"size\":true}",
  "proofImages": ["https://res.cloudinary.com/.../proof.jpg"],
  "note": "Đạt"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "READY_FOR_DELIVERY"
  }
}
```

> 📌 `remaining_amount = 0` (đã FULL paid) → chuyển thẳng `READY_FOR_DELIVERY`, không qua `AWAITING_REMAINING`.

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- READY_FOR_DELIVERY

SELECT * FROM qa_checks WHERE order_id = '{{ORDER_ID}}';
-- result = PASS
```

> 🧪 **Test edge case QC FAIL:** gọi lại với `"result": "FAIL"` → order về `IN_PRODUCTION`, task về `IN_PROGRESS`.

---

## 20. Staff: Kích hoạt Delivery (MF-05)

> Shipment đã có sẵn từ bước 10 (status=PENDING). Manager/staff gọi initiateDelivery → system dùng lại shipment.

```http
POST /api/v1/orders/{{ORDER_ID}}/delivery
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "deliveryMethod": "DELIVERY",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM",
  "assignedDeliveryStaffId": "{{DELIVERY_STAFF_ID}}"
}
```

**Expected Response (200):**
```json
{
  "id": "{{SHIPMENT_ID}}",
  "orderId": "{{ORDER_ID}}",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM"
}
```

> 📌 Nếu guest chọn PICKUP ở bước 10 → `orders.status = READY_FOR_PICKUP`.

---

## 21. Staff: Start Delivery (chỉ DELIVERY)

```http
PUT /api/v1/orders/{{ORDER_ID}}/shipment/status
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "status": "SHIPPING",
  "staffId": "{{STAFF_ID}}"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "SHIPPING"
  }
}
```

---

## 22. Staff: Confirm Delivered → COMPLETED

```http
PUT /api/v1/orders/{{ORDER_ID}}/shipment/status
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "status": "DELIVERED",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0909123456",
  "trackingCode": "BIORING-001",
  "proofImageUrl": "https://res.cloudinary.com/.../delivered.jpg",
  "staffId": "{{STAFF_ID}}"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "COMPLETED"
  }
}
```

**Verify DB (auto-complete đã chạy):**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- COMPLETED

SELECT * FROM warranties WHERE order_id = '{{ORDER_ID}}';
-- warranty_code = WAR-172000000042, status = ACTIVE, expiry = now + 1 year

SELECT is_locked FROM qr_memories WHERE engraving_id = '{{ENGRAVING_ID}}';
-- false (đã unlock QR memory)
```

---

## 23. Guest: Tra cứu đơn hàng (đã có MF-05)

```http
POST /api/v1/orders/lookup
Content-Type: application/json

{
  "orderCode": "172000000042"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "172000000042",
    "status": "COMPLETED",
    "totalPrice": 13200000,
    "paidAmount": 13200000
  }
}
```

---

## 24. Test Edge Cases Tổng Hợp

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Guest gọi PATCH config với `guestCode` sai | 403 Forbidden |
| 2 | Guest gọi GET session với `guestCode` không tồn tại | 404 Not Found |
| 3 | Guest submit khi order đã `PENDING_REVIEW` | 400 (phải là AWAITING_SUBMIT hoặc REVISION_REQUIRED) |
| 4 | Guest submit khi order `AWAITING_DEPOSIT` | 400 |
| 5 | Gọi POST shipping-info 2 lần | 400 "already set" |
| 6 | Guest A (guestCode A) gọi PATCH config trên engraving của Guest B | 403 |
| 7 | Guest A gọi GET order của Guest B | 403 |
| 8 | FULL payment trên order không có `guest_customer_id` (non-guest) | 400 "only for walk-in guests" |
| 9 | Biometric upload với `biometricType` không có trong package | 400 |
| 10 | Gọi initiateDelivery trước khi order READY_FOR_DELIVERY | 400 |
| 11 | Guest submit với `selectedBiometrics` rỗng | 400 |
| 12 | Gọi lookup với `orderCode` sai | 404 |

---

## 25. Variable Reference

| Variable | Nguồn | Ghi chú |
|----------|-------|---------|
| `{{staffJwt}}` | Login staff | User có `order.write` |
| `{{managerJwt}}` | Login manager | User có `order.write` |
| `{{jewelerJwt}}` | Login jeweler | Production staff |
| `{{GUEST_ID}}` | Response bước 1 | UUID guest_customers |
| `{{GUEST_CODE}}` | Response bước 1 | GUE-XXXXXX |
| `{{ORDER_ID}}` | Response bước 2 | UUID orders |
| `{{ENGRAVING_ID}}` | Response bước 2 | UUID engravings |
| `{{VERSION_ID}}` | Response bước 2 | UUID engraving_versions |
| `{{PRODUCT_ID}}` | Catalog | UUID products |
| `{{MATERIAL_ID}}` | Catalog | UUID materials |
| `{{GEMSTONE_ID}}` | Catalog | UUID gemstones |
| `{{FP_URL}}` | Cloudinary | Fingerprint PNG URL |
| `{{SW_URL}}` | Cloudinary | Audio MP3 URL |
| `{{JEWELER_ID}}` | Users table | UUID jeweler |
| `{{STAFF_ID}}` | JWT payload.sub | Staff UUID |
| `{{DELIVERY_STAFF_ID}}` | Users table | Delivery staff UUID |
| `{{SHIPMENT_ID}}` | Response bước 10 | UUID shipments |
| `{{TASK_ID}}` | Response bước 17 | UUID production_tasks |
| `{{PAYMENT_ID}}` | Response bước 15 | UUID payments |
