
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

> Staff nhập thông tin khách → hệ thống check trùng email → sinh `guest_code`.

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

**Expected Response (201) — tạo mới:**
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
  },
  "isMember": false,
  "isExistingGuest": false,
  "message": ""
}
```

**Expected Response (200) — email đã là Member:**
```json
{
  "guest": { "id": "", "guestCode": "", "fullName": "", "phone": "", "email": "member@gmail.com", "note": "", "createdAt": "" },
  "isMember": true,
  "isExistingGuest": false,
  "message": "Email already registered as member"
}
```

**Expected Response (200) — email đã có guest cũ:**
```json
{
  "guest": { "id": "{{OLD_GUEST_ID}}", "guestCode": "GUE-XXXXXX", ... },
  "isMember": false,
  "isExistingGuest": true,
  "message": "Guest already exists. Create new?"
}
```

**Verify DB:**
```sql
SELECT * FROM guest_customers WHERE email = 'guest@example.com';
```

> 📌 **Ghi chú:** `guest_code` format `GUE-` + 6 ký tự (không có 0/O/1/I). Dùng `guest_code` này cho tất cả tablet endpoints bên dưới. Email bắt buộc — FE xử lý 3 case dựa trên `isMember` / `isExistingGuest`.

---

## 2. Guest trên Tablet: Browse + Chọn Product + Tạo Engraving

> Guest lướt collection, vào product detail, bấm "Design your ring" → nhập guestCode → hệ thống tự tạo engraving.
> **Lưu ý:** Endpoint public, không cần JWT. `qr_memories` được tự động tạo cùng lúc với engraving.

```http
POST /api/v1/guest-tablet/engravings
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}",
  "productId": "{{PRODUCT_ID}}"
}
```

**Expected Response (201):**
```json
{
  "engraving": {
    "id": "{{ENGRAVING_ID}}",
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

---

## 3. Guest trên Tablet: Simple Design (Chọn Material, Gemstone, Size)

> Guest chọn chất liệu, đá, size. Có thể gửi kèm selectedBiometrics nếu muốn.
> **Từ lúc này:** nếu chưa có order, PATCH config cho phép cập nhật mọi field.

```http
PATCH /api/v1/guest-tablet/engravings/versions/{{VERSION_ID}}/config?guestCode={{GUEST_CODE}}
Content-Type: application/json

{
  "selectedMaterialId": "MAT_1",
  "selectedGemstoneId": "GEM_1",
  "ringSize": "14",
  "selectedBiometrics": "SW,FP"
}
```

---

## 4. Guest trên Tablet: Package Selection + Tạo Order

> Guest chọn package biometric. Sau khi chọn → popup xác nhận:
> *"Bạn đã chắc chắn với những lựa chọn của mình chứ? Các lựa chọn này sẽ không được thay đổi nữa nếu bạn xác nhận."*
>
> **Confirm** → gọi API này. **Cancel** → quay lại chỉnh sửa.
> **Sau bước này: KHÓA VĨNH VIỄN** base design + package. PATCH config sau đó chỉ cho phép `customizationConfig`.
> **Sau khi tạo order thành công:** tablet tự động end session, navigate về màn hình browse.

```http
POST /api/v1/guest-tablet/orders
Content-Type: application/json

{
  "guestCode": "{{GUEST_CODE}}",
  "engravingId": "{{ENGRAVING_ID}}"
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
    "productId": "{{PRODUCT_ID}}",
    "status": "PENDING"
  },
  "version": {
    "id": "{{VERSION_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "versionNumber": 1,
    "selectedMaterialId": "MAT_1",
    "selectedGemstoneId": "GEM_1",
    "ringSize": "14",
    "selectedBiometrics": "SW,FP",
    "status": "PENDING"
  }
}
```

**Verify DB:**
```sql
SELECT * FROM orders WHERE guest_customer_id = (SELECT id FROM guest_customers WHERE guest_code = '{{GUEST_CODE}}');
-- status = AWAITING_SUBMIT, user_id IS NULL, design_source = WALK_IN

SELECT * FROM engravings WHERE id = '{{ENGRAVING_ID}}';
-- user_id IS NULL, guest_customer_id = guest_id, status = PENDING

SELECT * FROM engraving_versions WHERE engraving_id = '{{ENGRAVING_ID}}';
-- version_number = 1, status = PENDING, ring_size = '14'
```

---

## 5. Staff Web: Refresh + Xem Order của Guest

> Sau khi guest tạo order trên tablet, Staff bấm **Refresh** để kiểm tra.
> Endpoint này trả về guest + order + engraving + versions + biometrics + qrMemory.

```http
GET /api/v1/guest-tablet/sessions/{{GUEST_CODE}}
```

**Expected Response — order đã tồn tại:**
```json
{
  "guest": { "id": "{{GUEST_ID}}", "guestCode": "{{GUEST_CODE}}", "fullName": "...", ... },
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "AWAITING_SUBMIT",
    "engraving": {
      "id": "{{ENGRAVING_ID}}",
      "versions": [{
        "id": "{{VERSION_ID}}",
        "selectedMaterialId": "MAT_1",
        "selectedGemstoneId": "GEM_1",
        "ringSize": "14",
        "selectedBiometrics": "SW,FP"
      }],
      "biometricAssets": []
    }
  }
}
```

> 📌 Staff thấy ngay: guest đã chọn sản phẩm gì, vật liệu + đá nào, package nào → bắt đầu assign biometric.

---

## 6. Staff: Xử lý & Upload Biometric(s) (Admin Biometric Assets Flow)

> Luồng tại Store: Staff dùng bộ API `/api/v1/admin/biometric-assets` để Upload $\rightarrow$ Kiểm tra/Reprocess với Presets $\rightarrow$ Approve $\rightarrow$ Assign vào Engraving.

### 3a. Upload & Xử lý thô (Stage `REVIEW`)

**Fingerprint:**
```http
POST /api/v1/admin/biometric-assets/fingerprint
Authorization: Bearer {{staffJwt}}
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="fingerprint.png"
Content-Type: image/png

<binary image content>
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

**Soundwave:**
```http
POST /api/v1/admin/biometric-assets/soundwave
Authorization: Bearer {{staffJwt}}
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="voice.mp3"
Content-Type: audio/mp3

<binary audio content>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="segmentStartMs"

0
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="segmentDurationMs"

3000
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

**Expected Response (201) — `assetJson`:**
```json
{
  "assetJson": "{\"id\":\"ASSET_FP_001\",\"artifactId\":\"fp_12345\",\"assetType\":\"fingerprint\",\"status\":\"READY_FOR_REVIEW\",\"reviewFiles\":{...}}"
}
```

---

### 3b. Tinh chỉnh & Reprocess với Preset (Nếu chưa tối ưu)

**Lấy danh sách Presets gợi ý:**
```http
GET /api/v1/admin/biometric-assets/fingerprint/presets
# Hoặc GET /api/v1/admin/biometric-assets/soundwave/presets
Authorization: Bearer {{staffJwt}}
```

**Reprocess lại:**
```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/reprocess
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "preset": "keep_ridges",
  "minArea": 8
}
```

---

### 3c. Staff Approve Asset

> Chuyển toàn bộ asset từ MinIO stage `REVIEW` sang `APPROVED`.

```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/approve
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "note": "Hình ảnh vân tay rất rõ nét",
  "copyDebugFiles": false
}
```

**Expected Response (200):**
```json
{
  "assetJson": "{\"id\":\"ASSET_FP_001\",\"status\":\"ASSET_APPROVED\",\"approvedFiles\":{...}}"
}
```

---

### 3d. Staff Assign Asset vào Engraving của Guest

> Gán asset đã duyệt vào `ENGRAVING_ID`. Hệ thống tự động update `engraving_biometrics` sang `CAPTURED`.

```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/assign
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "engravingId": "{{ENGRAVING_ID}}"
}
```

**Verify DB:**
```sql
SELECT * FROM engraving_biometrics WHERE engraving_id = '{{ENGRAVING_ID}}' AND biometric_type = 'FP';
-- required_channel = ENGRAVING, biometric_asset_id = 'ASSET_FP_001', status = CAPTURED

SELECT * FROM biometric_assets WHERE id = 'ASSET_FP_001';
-- status = ASSET_APPROVED
```

### 26b. Lấy PBR Textures (viewer-assets) để hiển thị 3D trên iPad

> iPad lấy `assetId` để gọi API lấy các map (normal, alpha...) render 3D. Dựa vào đó để KHÁCH HÀNG (cùng Staff) KÉO THẢ VỊ TRÍ trên iPad.

```http
GET /api/v1/admin/biometric-assets/ASSET_FP_001
Authorization: Bearer {{staffJwt}}
```

**Response mẫu:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "asset": {
      "assetId": "ASSET_FP_001",
      "viewerFiles": {
        "overlayPng": "http://...",
        "alphaMap": "http://...",
        "normalMap": "http://..."
      }
    }
  }
}
```

---

## 7. Guest quay lại Tablet: "Already have an order?" + Edit Biometric Asset

> Staff đã assign biometric xong. Guest quay lại tablet. Màn hình browse → góc trên phải nút **"Already have an order?"** → nhập `guestCode`. Tablet gọi endpoint này để load order + biometric_assets + qrMemory. UI **nhảy thẳng vào step edit biometric asset**, các step khác visible nhưng greyed out + disabled.

```http
GET /api/v1/guest-tablet/sessions/{{GUEST_CODE}}
```

**Expected Response — biometric_assets đã có data:**
```json
{
  "guest": { "id": "{{GUEST_ID}}", "guestCode": "{{GUEST_CODE}}", ... },
  "order": {
    "id": "{{ORDER_ID}}",
    "status": "AWAITING_SUBMIT",
    "engraving": {
      "id": "{{ENGRAVING_ID}}",
      "versions": [...],
      "biometricAssets": [
        { "id": "ASSET_FP_001", "assetType": "fingerprint", "status": "ASSET_APPROVED", "rawFileUrl": "...", "processedSvgUrl": "..." },
        { "id": "ASSET_SW_001", "assetType": "soundwave", "status": "ASSET_APPROVED", "rawFileUrl": "...", "processedSvgUrl": "..." }
      ],
      "qrMemory": { "id": "...", "cardTitle": "", "greetingMessage": "", "cardTheme": null, ... }
    }
  }
}
```

---

## 8. Guest Tablet: Advanced Design (edit engravedType + vị trí)

> Chọn loại khắc lên nhẫn, chỉnh vị trí biometric.

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

> ⛔ **Lock:** Vì order đã tồn tại, các field core (`selectedMaterialId`, `selectedGemstoneId`, `ringSize`, ...) bị **bỏ qua**. Chỉ `customizationConfig` được cập nhật. 🚫 confirmPlacement không dùng.

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

> 📌 `recipientEmail` returns the actual email from DB (no longer hardcoded `""`). `accessPinHash` removed from response (security fix).

---

## 10. Guest Tablet: Confirm + Submit Design

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

## 11. Manager: Review Order — Approve

```http
PUT /api/v1/orders/{{ORDER_ID}}/review
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

## 12. Manager: Review Order — Reject (test riêng)

> Tạo guest mới, làm lại bước 1-7 (tạo guest → design → order → biometric → config → memcard → submit), sau đó reject.

```http
PUT /api/v1/orders/{{ORDER_ID}}/review
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

## 13. Guest Tablet: Resubmit sau Reject

> Guest quay lại tablet → thấy order REVISION_REQUIRED + version 2 PENDING.
> Sửa `customizationConfig` + memcard → submit lại.

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

> 📌 Manager review lại → approve → AWAITING_DEPOSIT. Sau đó guest set delivery → pay FULL.

---

## 14. Guest Tablet: Delivery (sau Manager approve)

> **Thời điểm gọi:** Order ở status `AWAITING_DEPOSIT` (Manager đã approve).
> Chọn hình thức nhận hàng. Nếu DELIVERY → nhập địa chỉ. Hệ thống tạo `user_address` (user_id=null) + `shipment`.

```http
POST /api/v1/guest-tablet/orders/{{ORDER_ID}}/delivery
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

## 15. Guest Tablet: Thanh toán FULL (sau khi set delivery)

> Order `AWAITING_DEPOSIT`, đã có delivery info → guest thanh toán 100% online.

```http
POST /api/v1/guest-tablet/orders/{{ORDER_ID}}/pay
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

> 📌 `qrCode` now returned in both `payment` and top-level. Guest quét QR PayOS hoặc mở `paymentUrl` để thanh toán. Sau đó PayOS gọi webhook.

---

## 16. PayOS Webhook: FULL paid → DEPOSIT_PAID

> Giả lập webhook từ PayOS. Gửi raw JSON payload PayOS (không wrap trong `{ webhookBody }`).

```http
POST /api/v1/orders/payments/webhook
Content-Type: application/json

{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": {{PAYOS_ORDER_CODE}},
    "amount": 13200000
  },
  "signature": "..."
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

## 27. Jeweler: Complete Production

```http
PUT /api/v1/orders/production-tasks/{{TASK_ID}}/status
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

## 27. Manager: QC Accept (MF-05)

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

## 27. Staff: Kích hoạt Delivery (MF-05)

> Shipment đã có sẵn từ bước Delivery (status=PENDING). Manager/staff gọi initiateDelivery → system dùng lại shipment.

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

> 📌 Nếu guest chọn PICKUP ở bước Delivery → `orders.status = READY_FOR_PICKUP`.

---

## 27. Staff: Start Delivery (chỉ DELIVERY)

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

## 27. Staff: Confirm Delivered → COMPLETED

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

## 27. Guest: Tra cứu đơn hàng (đã có MF-05)

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

## 27. Test Edge Cases Tổng Hợp

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Guest gọi PATCH config với `guestCode` sai | 403 Forbidden |
| 2 | Guest gọi GET session với `guestCode` không tồn tại | 404 Not Found |
| 3 | Guest submit khi order đã `PENDING_REVIEW` | 400 (phải là AWAITING_SUBMIT hoặc REVISION_REQUIRED) |
| 4 | Guest submit khi order `AWAITING_DEPOSIT` | 400 |
| 5 | Gọi POST delivery 2 lần | 400 "already set" |
| 6 | Guest A (guestCode A) gọi PATCH config trên engraving của Guest B | 403 |
| 7 | Guest A gọi GET order của Guest B | 403 |
| 8 | FULL payment trên order không có `guest_customer_id` (non-guest) | 400 "only for walk-in guests" |
| 9 | Biometric upload với `biometricType` không có trong package | 400 |
| 10 | Gọi POST delivery khi order chưa phải AWAITING_DEPOSIT | 400 |
| 11 | Guest submit với `selectedBiometrics` rỗng | 200 (silently allowed) |
| 12 | Gọi lookup với `orderCode` sai | 404 |
| 13 | PATCH config `selectedMaterialId` sau khi order tạo → field bị bỏ qua | Material không đổi |
| 14 | PATCH config `selectedBiometrics` sau khi order tạo → field bị bỏ qua | selectedBiometrics không đổi |
| 15 | PATCH config `customizationConfig` sau khi order tạo → vẫn cập nhật được | customizationConfig thay đổi |

---

## 27. Admin utility: List all orders & engravings

> Yêu cầu staff/manager token có permission `order.write`.

```http
GET /api/v1/orders/admin?page=1&limit=10&status=PENDING_REVIEW
Authorization: Bearer {{staffJwt}}
```

```http
GET /api/v1/engravings/admin?page=1&limit=10&status=PENDING
Authorization: Bearer {{staffJwt}}
```

---

## 28. Variable Reference

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
| `{{SHIPMENT_ID}}` | Response bước Delivery | UUID shipments |
| `{{TASK_ID}}` | Response bước Assign Jeweler | UUID production_tasks |
| `{{PAYMENT_ID}}` | Response bước Payment | UUID payments |
