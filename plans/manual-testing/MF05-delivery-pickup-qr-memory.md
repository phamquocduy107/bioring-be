# MF05 — Delivery, Pickup & QR Memory — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| Order MF-02/03/04 đã hoàn thành đến `DEPOSIT_PAID` | Đã sản xuất xong, Jeweler đã COMPLETED |
| Manager JWT token | User có quyền `order.write` |
| Staff JWT token | User có quyền `order.write` |
| Customer JWT token | Customer sở hữu order |
| Python processing service | Đang chạy (nếu cần re-process) |

> 📌 MF-05 bắt đầu từ lúc Jeweler báo COMPLETED. Trước đó order đã ở `IN_PRODUCTION` (step MF-02/03/04 đã làm).

---

## 1. Jeweler: Complete Production

> Thợ sản xuất xong → báo hoàn thành.

```http
PUT /api/v1/orders/production-tasks/{{TASK_ID}}/status
Authorization: Bearer {{jewelerJwt}}
Content-Type: application/json

{
  "status": "COMPLETED",
  "note": "Sản phẩm hoàn thiện, chờ QC"
}
```

**Expected Response (200):**
```json
{
  "task": {
    "id": "{{TASK_ID}}",
    "orderId": "{{ORDER_ID}}",
    "status": "COMPLETED",
    "completedAt": "2026-07-07T14:00:00.000Z"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- PENDING_QC

SELECT status, completed_at FROM production_tasks WHERE id = '{{TASK_ID}}';
-- COMPLETED, completed_at NOT NULL
```

---

## 2. Manager: QC Accept — PASS

> Manager kiểm tra sản phẩm thực tế. Nếu đạt → duyệt.

```http
PUT /api/v1/orders/{{ORDER_ID}}/qc-accept
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "result": "PASS",
  "checklist": "{\"engraving\":true,\"material\":true,\"size\":true,\"finish\":true}",
  "proofImages": [
    "https://res.cloudinary.com/dpm0zc06s/image/upload/v123/proof1.jpg",
    "https://res.cloudinary.com/dpm0zc06s/image/upload/v123/proof2.jpg"
  ],
  "note": "Sản phẩm đạt yêu cầu, sẵn sàng bàn giao"
}
```

**Expected Response (200):**

- Nếu `remaining_amount > 0`:
```json
{
  "order": { "id": "{{ORDER_ID}}", "status": "AWAITING_REMAINING" }
}
```

- Nếu `remaining_amount = 0` (VD: MF-04 FULL paid):
```json
{
  "order": { "id": "{{ORDER_ID}}", "status": "READY_FOR_DELIVERY" }
}
```

**Verify DB:**
```sql
SELECT * FROM qa_checks WHERE order_id = '{{ORDER_ID}}';
-- result = PASS, checklist NOT NULL, proof_images NOT NULL

SELECT status, remaining_amount FROM orders WHERE id = '{{ORDER_ID}}';
-- AWAITING_REMAINING (nếu còn nợ) hoặc READY_FOR_DELIVERY (nếu hết nợ)
```

---

## 3. Manager: QC Accept — FAIL (test riêng)

> Nếu sản phẩm không đạt → quay lại sản xuất.

```http
PUT /api/v1/orders/{{ORDER_ID}}/qc-accept
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "result": "FAIL",
  "checklist": "{\"engraving\":false,\"material\":true,\"size\":true}",
  "note": "Vị trí khắc bị lệch, cần làm lại"
}
```

**Expected Response (200):**
```json
{
  "order": { "id": "{{ORDER_ID}}", "status": "IN_PRODUCTION" }
}
```

**Verify DB:**
```sql
SELECT * FROM qa_checks WHERE order_id = '{{ORDER_ID}}' ORDER BY checked_at DESC LIMIT 1;
-- result = FAIL

SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- IN_PRODUCTION

SELECT status, completed_at FROM production_tasks WHERE id = '{{TASK_ID}}';
-- IN_PROGRESS, completed_at = NULL (reset)
```

> 📌 Sau FAIL, Jeweler sửa xong → COMPLETED lại bước 1 → Manager QC lại bước 2. QC history được ghi đầy đủ (cả PASS lẫn FAIL).

---

## 4. Customer: Pay Remaining (nếu còn nợ)

> Chỉ cần nếu `remaining_amount > 0` (MF-02/03). MF-04 FULL paid thì bỏ qua bước này.

```http
POST /api/v1/orders/{{ORDER_ID}}/payments
Authorization: Bearer {{customerJwt}}
Content-Type: application/json

{
  "paymentPhase": "REMAINING",
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
    "paymentPhase": "REMAINING",
    "amount": 6600000,
    "method": "PAYOS",
    "status": "PENDING"
  },
  "paymentUrl": "https://pay.payos.vn/...",
  "qrCode": "000201010212..."
}
```

**PayOS webhook:**
```http
POST /api/v1/orders/payments/payos-callback
Content-Type: application/json

{
  "webhookBody": "{\"code\":\"00\",\"desc\":\"success\",\"success\":true,\"data\":{\"orderCode\":{{PAYOS_ORDER_CODE}},\"amount\":6600000},\"signature\":\"...\"}"
}
```

**Verify DB:**
```sql
SELECT status, remaining_amount FROM orders WHERE id = '{{ORDER_ID}}';
-- READY_FOR_DELIVERY, remaining_amount = 0
```

---

## 5. Manager: Initiate Delivery — PICKUP

> Khách muốn tự đến cửa hàng nhận.

```http
POST /api/v1/orders/{{ORDER_ID}}/delivery
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "deliveryMethod": "PICKUP",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456"
}
```

**Expected Response (200):**
```json
{
  "id": "{{SHIPMENT_ID}}",
  "orderId": "{{ORDER_ID}}",
  "deliveryMethod": "PICKUP",
  "status": "PENDING",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "createdAt": "2026-07-07T..."
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- READY_FOR_PICKUP

SELECT * FROM shipments WHERE order_id = '{{ORDER_ID}}';
-- delivery_method = PICKUP, status = PENDING
```

---

## 6. Staff: Confirm Pickup → DELIVERED → COMPLETED

> Khách đến cửa hàng nhận. Staff xác nhận.
>
> Có 2 cách: (a) dùng endpoint mới `POST /confirm-pickup` (tạo warranty + lock QR tự động), hoặc (b) dùng `PUT /shipment/status` cũ.

### 6a. Dùng endpoint mới (preferred)

```http
POST /api/v1/orders/{{ORDER_ID}}/confirm-pickup
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "note": "Khách nhận tại quầy 17/07"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "1720000000042",
    "status": "COMPLETED",
    ...
  },
  "warrantyCode": "WAR-1720000000042",
  "warrantyExpiry": "2027-07-17T10:00:00.000Z",
  "qrMemoryUnlocked": true
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- COMPLETED

SELECT * FROM warranties WHERE order_id = '{{ORDER_ID}}';
-- warranty_code, status = ACTIVE, issue_date, expiry_date, engraving_id NOT NULL

SELECT is_locked FROM qr_memories WHERE engraving_id =
  (SELECT engraving_id FROM orders WHERE id = '{{ORDER_ID}}');
-- false (đã unlock)
```

### 6b. Dùng endpoint cũ (shipment/status)

```http
PUT /api/v1/orders/{{ORDER_ID}}/shipment/status
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "status": "DELIVERED",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0909123456",
  "identityNote": "CMND 123456789",
  "proofImageUrl": "https://res.cloudinary.com/.../pickup-proof.jpg"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID}}",
    "orderCode": "172000000042",
    "status": "COMPLETED"
  }
}
```

**Verify DB (auto-complete):**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID}}';
-- COMPLETED

SELECT * FROM pickup_records WHERE order_id = '{{ORDER_ID}}';
-- receiver_name, receiver_phone, identity_note, picked_up_at

SELECT * FROM warranties WHERE order_id = '{{ORDER_ID}}';
-- warranty_code = WAR-172000000042, warranty_type = STANDARD
-- status = ACTIVE, expiry_date = NOW + 1 year

SELECT is_locked FROM qr_memories WHERE engraving_id = 
  (SELECT engraving_id FROM orders WHERE id = '{{ORDER_ID}}');
-- false (đã unlock)
```

---

## 7. Initiate Delivery — DELIVERY (test riêng)

> Dùng order khác, chọn giao tận nơi.

```http
POST /api/v1/orders/{{ORDER_ID_2}}/delivery
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "deliveryMethod": "DELIVERY",
  "recipientName": "Nguyễn Văn B",
  "recipientPhone": "0987654321",
  "shippingAddressText": "456 Đường XYZ, Quận 3, TP.HCM",
  "assignedDeliveryStaffId": "{{DELIVERY_STAFF_ID}}"
}
```

**Expected Response (200):**
```json
{
  "id": "{{SHIPMENT_ID_2}}",
  "orderId": "{{ORDER_ID_2}}",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyễn Văn B",
  "recipientPhone": "0987654321",
  "shippingAddressText": "456 Đường XYZ, Quận 3, TP.HCM"
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID_2}}';
-- READY_FOR_DELIVERY (giữ nguyên, chưa chuyển SHIPPING)

SELECT * FROM shipments WHERE order_id = '{{ORDER_ID_2}}';
-- delivery_method = DELIVERY, status = PENDING
-- assigned_delivery_staff_id đã được set
```

---

## 8. Staff: Start Delivery (DELIVERY only)

```http
PUT /api/v1/orders/{{ORDER_ID_2}}/shipment/status
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "status": "SHIPPING"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID_2}}",
    "orderCode": "172000000043",
    "status": "SHIPPING"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM orders WHERE id = '{{ORDER_ID_2}}';
-- SHIPPING

SELECT status FROM shipments WHERE order_id = '{{ORDER_ID_2}}';
-- SHIPPING
```

---

## 9. Staff: Confirm Delivered → COMPLETED

> Giao hàng xong, khách nhận. Staff xác nhận.

```http
PUT /api/v1/orders/{{ORDER_ID_2}}/shipment/status
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "status": "DELIVERED",
  "receiverName": "Nguyễn Văn B",
  "receiverPhone": "0987654321",
  "identityNote": "CMND 987654321",
  "proofImageUrl": "https://res.cloudinary.com/.../delivered-proof.jpg",
  "trackingCode": "BIORING-DEL-002"
}
```

**Expected Response (200):**
```json
{
  "order": {
    "id": "{{ORDER_ID_2}}",
    "status": "COMPLETED"
  }
}
```

**Verify DB:**
```sql
SELECT status FROM shipments WHERE order_id = '{{ORDER_ID_2}}';
-- DELIVERED, tracking_code = BIORING-DEL-002, delivered_at NOT NULL

SELECT status FROM orders WHERE id = '{{ORDER_ID_2}}';
-- COMPLETED

SELECT * FROM warranties WHERE order_id = '{{ORDER_ID_2}}';
-- ACTIVE, expiry_date = NOW + 1 year

SELECT is_locked FROM qr_memories WHERE engraving_id = 
  (SELECT engraving_id FROM orders WHERE id = '{{ORDER_ID_2}}');
-- false
```

---

## 10. Customer: Xem thông tin Delivery (đã đăng nhập)

> Customer có JWT xem tracking.

```http
GET /api/v1/orders/{{ORDER_ID}}/delivery
Authorization: Bearer {{customerJwt}}
```

**Expected Response (200):**
```json
{
  "id": "{{SHIPMENT_ID}}",
  "orderId": "{{ORDER_ID}}",
  "deliveryMethod": "PICKUP",
  "status": "PENDING",
  "trackingCode": "",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "estimatedDeliveryAt": "",
  "deliveredAt": null,
  "createdAt": "2026-07-07T..."
}
```

> 📌 Sau khi COMPLETED thì có thêm `deliveredAt`, nếu DELIVERY có `trackingCode`.

---

## 11. Customer: Xem thông tin Warranty

```http
GET /api/v1/orders/{{ORDER_ID}}/warranty
Authorization: Bearer {{customerJwt}}
```

**Expected Response (200):**
```json
{
  "warranty": {
    "id": "{{WARRANTY_ID}}",
    "warrantyCode": "WAR-172000000042",
    "warrantyType": "STANDARD",
    "issueDate": "2026-07-07T...",
    "expiryDate": "2027-07-07T...",
    "status": "ACTIVE",
    "warrantyScope": "{\"description\":\"1 năm bảo hành chính hãng\",\"coverage\":[\"manufacturing_defect\"]}"
  }
}
```

> 🧪 **Test:** Gọi GET warranty cho order chưa COMPLETED → 404 hoặc warranty rỗng.

---

## 12. Customer: Xem Production & QC Info

```http
GET /api/v1/orders/{{ORDER_ID}}/production
Authorization: Bearer {{customerJwt}}
```

**Expected Response (200):**
```json
{
  "task": {
    "id": "{{TASK_ID}}",
    "orderId": "{{ORDER_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "assignedJewelerId": "{{JEWELER_ID}}",
    "assignedJewelerName": "Nguyễn Văn B",
    "status": "COMPLETED",
    "startedAt": "2026-07-06T...",
    "completedAt": "2026-07-07T..."
  },
  "qaCheck": {
    "id": "{{QA_CHECK_ID}}",
    "orderId": "{{ORDER_ID}}",
    "result": "PASS",
    "checklist": "{\"engraving\":true,\"material\":true,\"size\":true,\"finish\":true}",
    "proofImages": ["https://res.cloudinary.com/.../proof1.jpg"],
    "note": "Sản phẩm đạt yêu cầu, sẵn sàng bàn giao",
    "checkedAt": "2026-07-07T..."
  }
}
```

---

## 13. Guest (Walk-in): Tra cứu đơn bằng Order Lookup

> Không cần auth, dùng `order_code`.

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
    "paidAmount": 13200000,
    "remainingAmount": 0
  }
}
```

> 🧪 **Test:** Gọi với `orderCode` sai → 404.

---

## 14. QR Memory: Activate (quét QR)

> Người nhận quét QR code từ thiệp cứng → nhập PIN → xem memory card.

```http
POST /api/v1/qr-memories/activate
Content-Type: application/json

{
  "qrCode": "{{QR_CODE}}",
  "accessPin": "123456"
}
```

**Expected Response (200):**
```json
{
  "qrMemory": {
    "id": "{{QR_MEMORY_ID}}",
    "engravingId": "{{ENGRAVING_ID}}",
    "qrCode": "a1b2c3d4e5f6",
    "cardTitle": "Nhẫn của chúng ta",
    "greetingMessage": "Cảm ơn em đã đến bên anh",
    "recipientEmail": "friend@example.com",
    "biometricDisplaySettings": "{...}",
    "isLocked": false,
    "cardTheme": null,
    "createdAt": "2026-07-07T..."
  }
}
```

> 🧪 **Test:** Gọi với `accessPin` sai → 404 "Invalid access PIN"
> 🧪 **Test:** QR memory chưa được unlock (order chưa COMPLETED) → vẫn có thể xem sau khi nhập PIN đúng
> 📌 QR memory được system **tự động unlock** khi order COMPLETED (`is_locked` → `false`).

---

## 15. Full Flow: Từ IN_PRODUCTION → COMPLETED (DELIVERY)

| Step | Actor | API Call |
|------|-------|----------|
| 1 | Jeweler | `PUT /production-tasks/:id/status` → COMPLETED |
| 2 | Manager | `PUT /orders/:id/qc-accept` → PASS → AWAITING_REMAINING |
| 3 | Customer | `POST /orders/:id/payments` (REMAINING) + webhook → READY_FOR_DELIVERY |
| 4 | Manager | `POST /orders/:id/delivery` (DELIVERY) → giữ READY_FOR_DELIVERY |
| 5 | Staff | `PUT /orders/:id/shipment/status` (SHIPPING) → SHIPPING |
| 6 | Staff | `PUT /orders/:id/shipment/status` (DELIVERED) → COMPLETED |

---

## 16. Full Flow: Từ IN_PRODUCTION → COMPLETED (PICKUP)

| Step | Actor | API Call |
|------|-------|----------|
| 1 | Jeweler | `PUT /production-tasks/:id/status` → COMPLETED |
| 2 | Manager | `PUT /orders/:id/qc-accept` → PASS → READY_FOR_DELIVERY (remaining=0, MF-04) |
| 3 | Manager | `POST /orders/:id/delivery` (PICKUP) → READY_FOR_PICKUP |
| 4 | Staff | `PUT /orders/:id/shipment/status` (DELIVERED) → COMPLETED |

---

## 17. Test Edge Cases Tổng Hợp

| # | Test case | Expected |
|---|-----------|----------|
| 1 | QC Accept khi order không phải `IN_PRODUCTION` | 400 |
| 2 | QC Accept khi chưa có production_task COMPLETED | 400 |
| 3 | QC Accept với `checklist` JSON không hợp lệ | 400 |
| 4 | InitiateDelivery khi order không phải `READY_FOR_DELIVERY` | 400 |
| 5 | InitiateDelivery khi `remaining_amount > 0` | 400 "complete payment first" |
| 6 | InitiateDelivery 2 lần trên cùng order | 400 "already initiated" (trừ MF-04 guest flow đã có shipment PENDING) |
| 7 | UpdateShipmentStatus SHIPPING cho PICKUP | 400 "Only DELIVERY can be SHIPPING" |
| 8 | UpdateShipmentStatus SHIPPING khi order không phải READY_FOR_DELIVERY | 400 |
| 9 | UpdateShipmentStatus DELIVERED cho PICKUP khi order không phải READY_FOR_PICKUP | 400 |
| 10 | UpdateShipmentStatus DELIVERED cho DELIVERY khi order không phải SHIPPING | 400 |
| 11 | Warranty chỉ tạo 1 lần (test gọi DELIVERED 2 lần) | Lần 2 tạo warranty thứ 2 (không unique constraint) |
| 12 | GET delivery info cho order chưa initiate delivery | 404 hoặc rỗng |
| 13 | GET warranty info cho order chưa COMPLETED | 404 hoặc rỗng |
| 14 | Lookup order với `orderCode` không tồn tại | 404 |
| 15 | Activate QR memory với PIN sai | 404 |
| 16 | DELIVERED với staffId rỗng | 400 validation |
| 17 | QC Accept FAIL → order về IN_PRODUCTION → Jeweler COMPLETED lại → QC Accept PASS | Flow đúng |

---

## 18. Variable Reference

| Variable | Nguồn | Ghi chú |
|----------|-------|---------|
| `{{managerJwt}}` | Login manager | User có `order.write` |
| `{{staffJwt}}` | Login staff | User có `order.write` |
| `{{jewelerJwt}}` | Login jeweler | Production staff |
| `{{customerJwt}}` | Login customer | Chủ sở hữu order |
| `{{ORDER_ID}}` | Tests trước | UUID orders |
| `{{ORDER_ID_2}}` | Tests trước | UUID orders thứ 2 (cho DELIVERY test) |
| `{{ORDER_CODE}}` | Tests trước | order_code |
| `{{TASK_ID}}` | Assign jeweler response | UUID production_tasks |
| `{{SHIPMENT_ID}}` | Initiate delivery response | UUID shipments |
| `{{SHIPMENT_ID_2}}` | Initiate delivery response | UUID shipments thứ 2 |
| `{{QA_CHECK_ID}}` | QC Accept (tự sinh) | UUID qa_checks |
| `{{WARRANTY_ID}}` | Auto-complete (tự sinh) | UUID warranties |
| `{{JEWELER_ID}}` | Users table | UUID jeweler |
| `{{STAFF_ID}}` | JWT payload.sub | Staff UUID |
| `{{DELIVERY_STAFF_ID}}` | Users table | Delivery staff UUID |
| `{{QR_CODE}}` | QR memory response | 12 hex chars |
| `{{PAYOS_ORDER_CODE}}` | Initiate payment response | Numeric PayOS orderCode |
