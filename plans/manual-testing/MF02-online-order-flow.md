# MF02 — Online Custom Ring Order — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| MF01 hoàn tất bước 6 | Đã claim draft → có `ENGRAVING_ID`, `VERSION_ID` |
| JWT token | User đã đăng nhập |
| Manager JWT token | User có quyền `order.write` |
| Cloudinary audio URL | Đã upload raw audio (xem hướng dẫn dưới) |
| Giả lập PayOS | Cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `.env` |

---

## 0. Chuẩn bị raw audio URL (nếu test engraved type = SW)

Upload file audio MP3 lên Cloudinary:

```powershell
curl.exe -X POST "https://api.cloudinary.com/v1_1/dpm0zc06s/auto/upload" -F "file=@đường_dẫn_tới_audio.mp3" -F "upload_preset=BioRing"
```

Ghi nhớ `secure_url` từ response, VD:
```
https://res.cloudinary.com/dpm0zc06s/video/upload/v1782360241/hn8hyejtzt6h0tqo25ns.mp3
```

---

## 1. Cập nhật engraving version config — Simple Design

> Chọn ring style, shape, material, vị trí khắc. `customizationConfig` chứa design data, **không** chứa `selectedBiometrics`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"sw\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}}}}"
}
```

`VERSION_ID` lấy từ response claim draft (MF02 bước 6).

**Response mẫu:**
```json
{
  "version": {
    "id": "VERSION_ID",
    "engravingId": "ENGRAVING_ID",
    "versionNumber": 1,
    "customizationConfig": "{...}",
    "selectedBiometrics": null,
    "status": "PENDING"
  }
}
```

---

## 2. Cập nhật engraving version config — Package Selection

> Chọn gói biometrics. `selectedBiometrics` lưu vào **column riêng**, không nằm trong `customizationConfig`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "selectedBiometrics": ["SW","FP"]
```


**Response mẫu:**
```json
{
  "version": {
    "id": "VERSION_ID",
    "engravingId": "ENGRAVING_ID",
    "versionNumber": 1,
    "customizationConfig": "{...}",
    "selectedBiometrics": "SW",
    "status": "PENDING"
  }
}
```

---

## 3. Cập nhật engraving version config — Advanced Design (non-audio)

> Chọn material, ring size, vị trí hiển thị. Audio sẽ upload **sau** tạo order qua endpoint biometrics riêng.
> `customizationConfig` không chứa `selectedBiometrics` hay `audioUrl`.

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"sw\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}}}}",
  "ringSize": "M",
  "selectedMaterialId": "MATERIAL_ID"
}
```

**Response mẫu:**
```json
{
  "version": {
    "id": "VERSION_ID",
    "engravingId": "ENGRAVING_ID",
    "versionNumber": 1,
    "customizationConfig": "{...}",
    "selectedBiometrics": "SW",
    "status": "PENDING"
  }
}
```

---

## 4. Chỉnh sửa QR memory

> Memory card data được lưu trong `qr_memories` table, **không** trong customization_config.
> Phải làm **trước** khi tạo order. Sau POST /orders không edit được qr_memories nữa.

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

### Xem QR memory

```http
GET /api/v1/qr-memories/ENGRAVING_ID
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Activate (kích hoạt và xem) — không cần auth

```http
POST /api/v1/qr-memories/activate
Content-Type: application/json

{
  "qrCode": "a1b2c3d4e5f6",
  "accessPin": "123456"
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
    "isLocked": false
  }
}
```

> **Kết quả:** `isLocked` → `false`. Nếu sai PIN → 404.

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

`ENGRAVING_ID` lấy từ response claim draft.

**Response mẫu:**
```json
{
  "order": {
    "id": "ORDER_ID",
    "orderCode": "1741234567890",
    "userId": "USER_ID",
    "designDraftId": "DRAFT_ID",
    "designSource": "CUSTOM",
    "captureRoute": "ONLINE",
    "status": "AWAITING_SUBMIT",
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

Ghi nhớ `ORDER_ID`. Order ở `AWAITING_SUBMIT` — không edit được gì nữa, chỉ có thể submit.

---

## 6. Upload audio biometric + chọn segment

> Sau tạo order, user ghi âm → upload raw audio lên Cloudinary → gọi POST biometrics.
> `rawFileUrl` lưu toàn bộ audio gốc (dùng cho mem card). `extraData` chứa segment để xử lý khắc.

```http
POST /api/v1/engravings/ENGRAVING_ID/biometrics
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "biometricType": "SW",
  "rawFileUrl": "https://res.cloudinary.com/dpm0zc06s/video/upload/v1782360241/hn8hyejtzt6h0tqo25ns.mp3",
  "extraData": "{\"startMs\":2000,\"endMs\":5000}"
}
```

**Response mẫu:**
```json
{
  "biometric": {
    "id": "BIO_SW_ID",
    "engravingId": "ENGRAVING_ID",
    "biometricType": "SW",
    "requiredChannel": "ENGRAVING",
    "rawFileUrl": "https://res.cloudinary.com/.../audio.mp3",
    "processedSvgUrl": "https://res.cloudinary.com/.../waveform.svg",
    "extraData": "{\"startMs\":2000,\"endMs\":5000}",
    "status": "CAPTURED"
  }
}
```

> Server nhận `rawFileUrl`, gọi Python service xử lý waveform → trả về `processedSvgUrl` (SVG đã xử lý). Cả raw (dùng cho mem card) và processed (dùng cho engraving) đều được lưu.
> FE có thể gọi GET engraving → thấy `engraving_biometrics` list → render SW vào vị trí đã đặt.

---

## 7. Submit order — gửi duyệt

```http
PATCH /api/v1/orders/ORDER_ID/submit
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response mẫu:**
```json
{
  "order": {
    "id": "ORDER_ID",
    "orderCode": "BIORING-ABC123",
    "status": "PENDING_REVIEW",
    "...": "..."
  }
}
```

> Sau submit, order chuyển `AWAITING_SUBMIT` → `PENDING_REVIEW`. Chờ manager duyệt.

---

## 8. Lấy chi tiết order

```http
GET /api/v1/orders/ORDER_ID
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response** bao gồm engravings, versions, biometrics, payments.

---

## 9. Lấy danh sách orders của user

```http
GET /api/v1/orders?page=1&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 10. Duyệt order (manager)

> **1 order = 1 engraving.** Approve → luôn `AWAITING_DEPOSIT`. Reject → luôn `REVISION_REQUIRED`. Không có subset/granular.  
> Yêu cầu manager token có permission `order.write`.  
> Order phải ở status `PENDING_REVIEW` (đã submit ở bước 7).

### 10a. APPROVE

```http
PUT /api/v1/orders/ORDER_ID/review
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "action": "approve",
  "note": "Thiết kế đẹp, duyệt."
}
```

**Kết quả:** engraving version → `APPROVED`, `engraving.status` → `APPROVED`. `qr_memories.biometric_display_settings` được cập nhật. Order → `AWAITING_DEPOSIT`.

### 10b. REJECT

```http
PUT /api/v1/orders/ORDER_ID/review
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "action": "reject",
  "note": "Cần chỉnh lại vị trí khắc."
}
```

**Kết quả:** Version cũ → `REJECTED`, `engraving.status` → `REJECTED`, version mới được branch (copy, status = `PENDING`). Order → `REVISION_REQUIRED`.

### 10c. Resubmit — user sửa xong → gửi lại duyệt

Sau khi reject (order → `REVISION_REQUIRED`), user sửa design qua PATCH config. Order **giữ nguyên** `REVISION_REQUIRED` (không auto change).

```http
PATCH /api/v1/engravings/versions/VERSION_ID/config
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "customizationConfig": "{\"engravedType\":\"sw\",\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":30,\"width\":180}}}}"
}
```

> Server cho edit vì order đang `REVISION_REQUIRED`. **Giữ nguyên** `REVISION_REQUIRED`.
> `selectedBiometrics` vẫn block — không đổi được gói.

Sau đó user submit lại (bước 7) → thẳng `PENDING_REVIEW` (không qua `AWAITING_SUBMIT`). Manager duyệt lại (bước 10a).

---

## 11. Thanh toán (PayOS)

### 11a. Tạo link thanh toán (DEPOSIT_2 — 30%)

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

**Response mẫu:**
```json
{
  "payment": {
    "id": "PAYMENT_ID",
    "orderId": "ORDER_ID",
    "paymentPhase": "DEPOSIT_2",
    "amount": 3960000,
    "method": "PAYOS",
    "status": "PENDING",
    "payosTransactionId": "txn_abc123",
    "paymentUrl": "https://pay.payos.vn/checkout/abc123"
  },
  "paymentUrl": "https://pay.payos.vn/checkout/abc123"
}
```

> Mở `paymentUrl` trong browser để test thanh toán (hoặc dùng PayOS sandbox).

> **Note:** `InitiatePayment` cũng hỗ trợ `DEPOSIT_1` (IoT fee 100k → unlocks `AWAITING_SUBMIT` cho offline flow) và `FULL` (guest walk-in thanh toán 100% → thẳng `READY_FOR_DELIVERY`). Xem MF03 và MF04.

### 11b. Webhook callback (PayOS → server)

Sau khi thanh toán xong, PayOS gọi webhook. Có thể giả lập:

```http
POST /api/v1/orders/payments/webhook
Content-Type: application/json

{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": 123456789,
    "amount": 3960000,
    "description": "Cọc 1741234567890",
    "reference": "txn_abc123",
    "code": "00"
  },
  "signature": "<HMAC-SHA256 signature>"
}
```

> `data.orderCode` phải trùng với `payment_code` trong DB (là số timestamp server sinh ra khi tạo link thanh toán).

> `signature` phải hợp lệ (HMAC-SHA256 với `PAYOS_CHECKSUM_KEY`), nếu không server trả `{ success: false }`.

**Kết quả:** Order → `DEPOSIT_PAID`, `paidAmount` = 3.960.000, `remainingAmount` = 9.240.000.

### 11c. Thanh toán phần còn lại (REMAINING)

Sau khi sản xuất xong → order `AWAITING_REMAINING`:

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

Sau webhook → `remainingAmount` = 0, order → `READY_FOR_DELIVERY`.

---

## 12. Sản xuất (Production)

### 12a. Giao thợ (manager)

```http
POST /api/v1/orders/ORDER_ID/assign-jeweler
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "jewelerId": "JEWELER_USER_ID"
}
```

**Kết quả:** Tạo `production_task`, order → `IN_PRODUCTION`.

### 12b. Cập nhật tiến độ (manager)

```http
PUT /api/v1/orders/production-tasks/TASK_ID/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "status": "COMPLETED",
  "note": "Hoàn thành sản xuất nhẫn."
}
```

**Kết quả:** Order → `PENDING_QC`.

### 12c. QC kiểm tra (manager)

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

**Kết quả:** Nếu còn `remainingAmount` > 0 → order → `AWAITING_REMAINING`.  
Nếu đã thanh toán hết → order → `READY_FOR_DELIVERY`.

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
           [Mobile] PATCH config (advanced design — material, ringSize, position)
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
           POST /engravings/:id/biometrics { SW, rawFileUrl, extraData (segment) }
                     │
                     ▼
           FE GET engraving → thấy biometrics → render
                     │
                     ▼
           PATCH /orders/:id/submit → PENDING_REVIEW
           ╔═══ LOCK PATCH config + PUT qr-memories, CHỈ ALLOW POST biometrics ═══╗
                     │
                     ▼
     ┌────[Manager] review (1 order = 1 engraving)
     │         │
     │         ├── approve → engraving APPROVED + qr_memories updated → AWAITING_DEPOSIT
     │         │
     │         └── reject → engraving REJECTED + version branched → REVISION_REQUIRED
     │                └── user PATCH config (UNLOCK — edit design)
     │                      └── giữ REVISION_REQUIRED → PATCH submit → review lại
     │                           │
     │                           ▼
     │                    (quay lại review)
     │                           │
     │                    ───────┘
     │                    ▼
     │              POST initiatePayment (DEPOSIT_2 — 30% min 3000)
     │                    │
     │                    ▼
     │              PayOS webhook → DEPOSIT_PAID
     │                    │
     │                    ▼
     │              POST assign-jeweler → IN_PRODUCTION
     │                    │
     │                    ▼
              │              PUT production status → COMPLETED → PENDING_QC
              │                    │
              │                    ▼
              │              PUT /orders/:id/qc-accept (PASS)
              │                    │
              │                    ├── còn nợ → AWAITING_REMAINING
              │                    │         │
              │                    │         ▼
              │                    │    POST initiatePayment (REMAINING)
              │                    │         │
              │                    │         ▼
              │                    │    PayOS webhook
              │                    │         │
              │                    │         ▼
              │                    │    READY_FOR_DELIVERY
              │                    │
              │                    └── hết nợ → READY_FOR_DELIVERY
```
