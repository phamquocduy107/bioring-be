# MF03 — Offline Biometric Capture Order — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| MF01 hoàn tất bước 6 | Đã claim draft → có `ENGRAVING_ID`, `VERSION_ID` |
| JWT token | User đã đăng nhập |
| Staff JWT token | User có permission `order.write` (để upload biometrics) |
| Manager JWT token | User có quyền `order.write` (để duyệt) |
| Cloudinary audio URL | Đã upload raw audio cho SW (xem hướng dẫn dưới) |
| Cloudinary image URL | Đã upload ảnh fingerprint / heartbeat (nếu test FP/HB) |
| Giả lập PayOS | Cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `.env` |

---

## 0. Chuẩn bị raw file URLs

### Audio (SW)

```powershell
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/auto/upload" -F "file=@đường_dẫn_tới_audio.mp3" -F "upload_preset=BioRing"
```

Ghi nhớ `secure_url`:
```
https://res.cloudinary.com/dpm0zc06s/video/upload/v1782360241/audio.mp3
```

### Fingerprint ảnh (FP)

```powershell
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/auto/upload" -F "file=@đường_dẫn_tới_fingerprint.png" -F "upload_preset=BioRing"
```

Ghi nhớ `secure_url`:
```
https://res.cloudinary.com/dpm0zc06s/image/upload/v1782360242/fingerprint.png
```

### Heartbeat (HB) — nếu test

```powershell
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/auto/upload" -F "file=@đường_dẫn_tới_heartbeat.png" -F "upload_preset=BioRing"
```

---

## 1. Cập nhật engraving version config — Simple Design

> Giống MF-02: chọn ring style, shape, material, gemstone, vị trí khắc.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"sw\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}},\"fp\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":270,\"width\":90}}}}"
}
```

---

## 2. Cập nhật engraving version config — Package Selection

> Chọn package có biometrics (VD: SW_FP). Lưu `selectedBiometrics`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "selectedBiometrics": ["SW","FP"]
}
```

---

## 3. Cập nhật engraving version config — Advanced Design (non-audio)

> Chọn material, ring size, vị trí hiển thị. Biometrics sẽ được staff upload **sau** tạo order.
> `customizationConfig` không chứa `selectedBiometrics` hay `audioUrl`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"sw\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}},\"fp\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":270,\"width\":90}}}}",
  "ringSize": "M",
  "selectedMaterialId": "MATERIAL_ID"
}
```

---

## 4. Chỉnh sửa QR memory

> Phải làm **trước** tạo order. Sau POST /orders không edit được qr_memories nữa.
> `recipientEmail` hiện được lưu và trả về (trước đây bị silently drop).

```http
PUT /api/v1/qr-memories/ENGRAVING_ID
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "cardTitle": "Our Special Ring",
  "greetingMessage": "Thank you for being with me!",
  "recipientEmail": "friend@example.com"
}
```

**Response mẫu:**
```json
{
  "qrMemory": {
    "id": "QR_MEMORY_ID",
    "engravingId": "ENGRAVING_ID",
    "qrCode": "a1b2c3d4e5f6",
    "cardTitle": "Our Special Ring",
    "greetingMessage": "Thank you for being with me!",
    "recipientEmail": "friend@example.com",
    "isLocked": true
  }
}
```

---

## 5. Tạo order

> Gói đã chọn, design + mem card đã hoàn tất. Tạo order để chốt.
> Server tự derive `packageType` từ `selected_biometrics`.
> **Sau bước này: CHỈ block đổi package (selectedBiometrics). Vẫn cho PATCH config design, PUT qr-memories, POST biometrics.**

```http
POST /api/v1/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "engravingId": "ENGRAVING_ID"
}
```

**Response mẫu:**
```json
{
  "order": {
    "id": "ORDER_ID",
    "orderCode": "1741234567890",
    "userId": "USER_ID",
    "designDraftId": "DRAFT_ID",
    "designSource": "CUSTOM",
    "captureRoute": "OFFLINE",
    "status": "AWAITING_DEPOSIT_1",
    "totalPrice": 13200000,
    "subtotal": 12000000,
    "serviceFee": 1000000,
    "extraFee": 0,
    "discountAmount": 0,
    "paidAmount": 0,
    "remainingAmount": 13200000,
    "note": null,
    "createdAt": "2026-07-18T10:00:00.000Z",
    "updatedAt": "2026-07-18T10:00:00.000Z",
    "payments": []
  }
}
```

Ghi nhớ `ORDER_ID`. Order hiện ở `AWAITING_DEPOSIT_1` — cần đóng IoT fee trước.

---

## 6. Thanh toán DEPOSIT_1 (IoT fee 100k)

### 6a. Tạo link thanh toán

```http
POST /api/v1/orders/ORDER_ID/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "paymentPhase": "DEPOSIT_1",
  "returnUrl": "https://bioring.vn/order/success",
  "cancelUrl": "https://bioring.vn/order/cancel"
}
```

**Response mẫu:**
```json
{
  "payment": {
    "id": "PAYMENT_ID",
    "orderId": "ORDER_ID",
    "paymentPhase": "DEPOSIT_1",
    "amount": 100000,
    "method": "PAYOS",
    "status": "PENDING",
    "payosTransactionId": "txn_iot_001",
    "paymentUrl": "https://pay.payos.vn/checkout/iot001"
  },
  "paymentUrl": "https://pay.payos.vn/checkout/iot001",
  "qrCode": "000201010212..."
}
```

### 6b. Webhook callback (PayOS → server)

> Giả lập webhook để test (thực tế PayOS gọi tự động sau khi user thanh toán).

```http
POST /api/v1/orders/payments/webhook
Content-Type: application/json

{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": 123456789,
    "amount": 100000,
    "description": "IoT 1741234567890",
    "reference": "txn_iot_001",
    "code": "00"
  },
  "signature": "<HMAC-SHA256 signature>"
}
```

> `signature` phải hợp lệ (HMAC-SHA256 với `PAYOS_CHECKSUM_KEY`), nếu không server trả `{ success: false }`.

**Kết quả:** Order → `AWAITING_SUBMIT`. `paidAmount` += 100.000.

### 6c. SSE — realtime payment status (optional)

```http
GET /api/v1/orders/ORDER_CODE/payments/events
```

> Server-sent events: nhận `PAID` khi webhook xử lý xong.

---

## 7. Staff xử lý & Upload biometrics tại store (Admin Biometric Assets Flow)

> Yêu cầu **staff token** (permission `order.write`).
> Luồng tại Store: Staff dùng bộ API `/api/v1/admin/biometric-assets` để Upload $\rightarrow$ Kiểm tra/Reprocess với Presets $\rightarrow$ Approve $\rightarrow$ Assign vào Engraving của khách.

### 7a. Upload & Xử lý thô (Stage `REVIEW`)

**Fingerprint:**
```http
POST /api/v1/admin/biometric-assets/fingerprint
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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

**Response mẫu (trả về `assetJson`):**
```json
{
  "assetJson": "{\"id\":\"ASSET_FP_001\",\"artifactId\":\"fp_12345\",\"assetType\":\"fingerprint\",\"status\":\"READY_FOR_REVIEW\",\"reviewFiles\":{\"viewerFiles\":{...},\"productionFiles\":{\"svg\":\"http://localhost:9000/bioring-personalization/personalization/review/fingerprint/fp_12345/fingerprint.svg\"}}}"
}
```

---

### 7b. Tinh chỉnh & Reprocess với Preset (Nếu xem review thấy chưa tối ưu)

**Lấy danh sách Presets gợi ý:**
```http
GET /api/v1/admin/biometric-assets/fingerprint/presets
# Hoặc GET /api/v1/admin/biometric-assets/soundwave/presets
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Reprocess lại với preset đã chọn:**
```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/reprocess
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "preset": "keep_ridges",
  "minArea": 8
}
```

---

### 7c. Phê duyệt Asset (Approve)

> Chuyển toàn bộ asset đã xử lý ưng ý từ MinIO stage `REVIEW` sang `APPROVED`.

```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/approve
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "note": "Đã duyệt ảnh vân tay nét đẹp",
  "copyDebugFiles": false
}
```

**Response mẫu:**
```json
{
  "assetJson": "{\"id\":\"ASSET_FP_001\",\"status\":\"ASSET_APPROVED\",\"approvedFiles\":{...}}"
}
```

---

### 7d. Gán Asset đã duyệt vào Engraving của Khách (Assign)

> Gán `ASSET_FP_001` vào `ENGRAVING_ID`, tự động cập nhật `engraving_biometrics` checklist sang status `CAPTURED`.

```http
POST /api/v1/admin/biometric-assets/ASSET_FP_001/assign
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "engravingId": "ENGRAVING_ID"
}
```

**Response mẫu:**
```json
{
  "assetJson": "{\"id\":\"ASSET_FP_001\",\"engraving_id\":\"ENGRAVING_ID\",\"assigned_user_id\":\"USER_ID\",\"status\":\"ASSET_APPROVED\"}"
}
```

---

## 8. Submit order — gửi duyệt

```http
PATCH /api/v1/orders/ORDER_ID/submit
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Kết quả:** Order → `PENDING_REVIEW`.

---

## 9. Duyệt order (manager)

> **1 order = 1 engraving.** Yêu cầu manager token.

### 9a. APPROVE

```http
PUT /api/v1/orders/ORDER_ID/review
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "action": "approve",
  "note": "OK, proceed."
}
```

**Kết quả:** engraving version → `APPROVED`, `qr_memories.biometric_display_settings` cập nhật. Order → `AWAITING_DEPOSIT`.

### 9b. REJECT

```http
PUT /api/v1/orders/ORDER_ID/review
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "action": "reject",
  "note": "Cần chỉnh vị trí fingerprint."
}
```

**Kết quả:** Version → `REJECTED` + branch version mới. Order → `REVISION_REQUIRED`.

### 9c. Resubmit — user sửa xong → gửi lại duyệt

Sau khi reject (order → `REVISION_REQUIRED`), user sửa design qua PATCH config. Order **giữ nguyên** `REVISION_REQUIRED`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"mixed\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}},\"fp\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":270,\"width\":90}}}}"
}
```

> Server cho edit vì order đang `REVISION_REQUIRED`. **Giữ nguyên** `REVISION_REQUIRED`.
> `selectedBiometrics` vẫn block — không đổi được gói.

Sau đó user submit (bước 8) → thẳng `PENDING_REVIEW` (không qua `AWAITING_SUBMIT`). Manager duyệt lại (bước 9a).

---

## 10. Thanh toán DEPOSIT_2 (30% min 3000)

> Sau khi approve, order ở `AWAITING_DEPOSIT`. User đóng DEPOSIT_2.

```http
POST /api/v1/orders/ORDER_ID/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "paymentPhase": "DEPOSIT_2",
  "returnUrl": "https://bioring.vn/order/success",
  "cancelUrl": "https://bioring.vn/order/cancel"
}
```

**Kết quả (sau webhook):** Order → `DEPOSIT_PAID`.

---

## 11. Address CRUD

> Sau DEPOSIT_2 (`DEPOSIT_PAID`), customer có thể quản lý địa chỉ giao hàng và chọn phương thức nhận hàng trước khi thanh toán remaining. Các endpoint tương tự MF-02.

### 11a. Danh sách địa chỉ

```http
GET /api/v1/addresses
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### 11b. Thêm địa chỉ mới

```http
POST /api/v1/addresses
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "recipientName": "Nguyen Van A",
  "phone": "0901234567",
  "fullAddress": "123 Nguyen Hue, Bến Nghé",
  "ward": "Bến Nghé",
  "district": "Quận 1",
  "province": "TP Hồ Chí Minh",
  "isDefault": true
}
```

### 11c. Sửa địa chỉ

```http
PUT /api/v1/addresses/ADDR_ID
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "fullAddress": "123 Nguyen Hue, Bến Nghé, Quận 1",
  "isDefault": true
}
```

### 11d. Xoá địa chỉ

```http
DELETE /api/v1/addresses/ADDR_ID
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 12. Chọn phương thức nhận hàng (Delivery Preference)

> Khi nhẫn chế tác xong và chuyển sang bước tất toán phần còn lại (`AWAITING_REMAINING` hoặc `READY_FOR_DELIVERY`), customer chọn phương thức nhận hàng (DELIVERY từ danh bạ địa chỉ hoặc PICKUP tại cửa hàng).
> Lưu vào `shipments` với `status = 'PENDING'`. Order chuyển sang `READY_FOR_DELIVERY` (hoặc `READY_FOR_PICKUP`) sau khi tất toán REMAINING.

```http
POST /api/v1/orders/ORDER_ID/delivery-preference
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "addressId": "ADDR_ID",
  "method": "DELIVERY"
}
```

**Response mẫu:**
```json
{
  "shipmentId": "SHIPMENT_ID",
  "status": "PENDING"
}
```

> Nếu method `PICKUP`: khách đến cửa hàng nhận, không cần địa chỉ giao.
> Có thể gọi lại endpoint để đổi address/method — nếu đã có shipment PENDING, server update thay vì tạo mới.

---

## 13. Sản xuất

### 13a. Giao thợ

```http
POST /api/v1/orders/ORDER_ID/assign-jeweler
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "jewelerId": "JEWELER_USER_ID"
}
```

**Kết quả:** Tạo `production_task`, order → `IN_PRODUCTION`.

### 13b. Cập nhật tiến độ

```http
PUT /api/v1/orders/production-tasks/TASK_ID/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "status": "COMPLETED",
  "note": "Hoàn thành sản xuất."
}
```

**Kết quả:** Order → `PENDING_QC`.

### 13c. QC kiểm tra (manager)

```http
PUT /api/v1/orders/ORDER_ID/qc-accept
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "result": "PASS",
  "checklist": "{\"engraving\":true,\"material\":true,\"size\":true,\"finish\":true}",
  "proofImages": [
    "https://res.cloudinary.com/.../proof1.jpg"
  ],
  "note": "Sản phẩm đạt yêu cầu."
}
```

**Kết quả:** Nếu còn nợ → `AWAITING_REMAINING`. Nếu hết → `READY_FOR_DELIVERY` (hoặc `READY_FOR_PICKUP` nếu delivery-preference = PICKUP).

---

## 14. Thanh toán REMAINING (nếu còn nợ)

> Sau sản xuất, nếu còn `remainingAmount` > 0 → order `AWAITING_REMAINING`.

```http
POST /api/v1/orders/ORDER_ID/payments
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "paymentPhase": "REMAINING",
  "returnUrl": "https://bioring.vn/order/success",
  "cancelUrl": "https://bioring.vn/order/cancel"
}
```

**PayOS webhook:**
```http
POST /api/v1/orders/payments/webhook
Content-Type: application/json

{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": 123456789,
    "amount": 9240000,
    "description": "Thanh toán 1741234567890",
    "reference": "txn_remaining_001",
    "code": "00"
  },
  "signature": "<HMAC-SHA256 signature>"
}
```

**Kết quả (sau webhook):** `remainingAmount` = 0.
- Nếu đã có shipment PENDING (từ delivery-preference): server auto update `status = 'ACTIVE'`.
- `method = 'DELIVERY'` → order → `READY_FOR_DELIVERY`.
- `method = 'PICKUP'` → order → `READY_FOR_PICKUP`.
- Nếu chưa có shipment: order → `READY_FOR_DELIVERY` (mặc định, chờ staff xử lý sau).

---

## Flow hoàn chỉnh

```
                         MF01 ──→ claim draft ──→ engravingId + versionId + qr_memories
                                                        │
                     ┌──────────────────────────────────┘
                     ▼
           [Mobile] PATCH config (simple design — engravingPositions)
                     │
                     ▼
           [Mobile] PATCH config (package selection — selectedBiometrics)
                     │
                     ▼
           [Mobile] PATCH config (advanced design — material, ringSize)
                     │
                     ▼
           [Mobile] PUT /api/v1/qr-memories/:engravingId (memory card)
                     │
                     ▼
           POST createOrder { engravingId }
           (vẫn cho PATCH config design + PUT qr-memories + POST biometrics
            CHỈ block đổi package / selectedBiometrics)
                     │
                     ▼
                   AWAITING_DEPOSIT_1
                     │
                     ▼
           POST initiatePayment (DEPOSIT_1 — IoT fee 100k)
                     │
                     ▼
           PayOS webhook → AWAITING_SUBMIT
                     │
                     ▼
     ┌────[Staff] POST /engravings/:id/biometrics (SW, FP, HB...)
     │                    │
     │                    ▼
     │          FE GET engraving → thấy biometrics → render
     │                    │
     │                    ▼
     │          PATCH /orders/:id/submit → PENDING_REVIEW
     │          ╔═══ LOCK: ko cho PATCH config / PUT qr-memories nữa ═══╗
     │                    │
     │                    ▼
     │    ┌───[Manager] review (1 order = 1 engraving)
     │    │      │
     │    │      ├── approve → AWAITING_DEPOSIT
     │    │      │
     │    │      └── reject → REVISION_REQUIRED
     │    │             └── user PATCH config (UNLOCK — edit design)
     │    │                   └── giữ REVISION_REQUIRED → submit → review lại
     │    │                   │
     │    │                   ▼
     │    │             POST initiatePayment (DEPOSIT_2 — 30% min 3000)
     │    │                   │
     │    │                   ▼
     │    │             PayOS webhook → DEPOSIT_PAID
     │    │                   │
     │    │                   ▼
     │    │             POST assign-jeweler → IN_PRODUCTION
     │    │                   │
     │    │                   ▼
     │    │             PUT production status → COMPLETED → PENDING_QC
     │    │                   │
     │    │                   ▼
     │    │             PUT /orders/:id/qc-accept (PASS) → AWAITING_REMAINING
     │    │                   │
     │    │                   ├── [NEW] GET/POST/PUT/DELETE /api/v1/addresses
     │    │                   │         (quản lý danh bạ địa chỉ giao hàng)
     │    │                   │
     │    │                   ├── [NEW] POST /orders/:id/delivery-preference
     │    │                   │         { addressId, method: DELIVERY|PICKUP }
     │    │                   │         → shipments PENDING
     │    │                   │
     │    │                   ▼
     │    │             POST initiatePayment (REMAINING)
     │    │                   │
     │    │                   ▼
     │    │             PayOS webhook
     │    │                   │
     │    │                   ├── có shipment PENDING → ACTIVE
     │    │                   │
     │    │                   ├── method DELIVERY → READY_FOR_DELIVERY
     │    │                   │
     │    │                   └── method PICKUP → READY_FOR_PICKUP
```
