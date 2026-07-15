# MF06 — Warranty & Service Claim — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| Order MF-02/03/04 đã COMPLETED | Có warranty active, có order_code |
| Manager JWT token | User có quyền `order.write` |
| Staff JWT token | User có quyền `order.write` |
| Customer JWT token | Chủ sở hữu order |
| Jeweler JWT token | User có quyền `order.write` |
| Giả lập PayOS | Cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `.env` |

> 📌 MF-06 bắt đầu sau khi order đã COMPLETED (MF-05). Customer có warranty active, có thể tạo claim.

---

## 1. Customer: Tạo Warranty Claim

> Customer có tài khoản, tạo yêu cầu bảo hành từ order đã mua.

```http
POST /api/v1/warranty-claims
Authorization: Bearer {{customerJwt}}
Content-Type: application/json

{
  "warrantyId": "{{WARRANTY_ID}}",
  "orderId": "{{ORDER_ID}}",
  "serviceType": "WARRANTY",
  "issueDescription": "Nhẫn bị trầy xước sau 2 tháng sử dụng",
  "proofImages": ["https://res.cloudinary.com/dpm0zc06s/image/upload/v1/scratch.jpg"]
}
```

**Expected Response (201):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "claimCode": "WCL-XXXXXX",
    "warrantyId": "{{WARRANTY_ID}}",
    "orderId": "{{ORDER_ID}}",
    "serviceType": "WARRANTY",
    "issueDescription": "Nhẫn bị trầy xước sau 2 tháng sử dụng",
    "proofImages": ["https://res.cloudinary.com/..."],
    "status": "PENDING_REVIEW",
    "chargeStatus": "",
    "extraFee": 0,
    "managerNote": "",
    "customerConfirmedAt": "",
    "createdAt": "2026-07-19T...",
    "serviceTickets": [
      {
        "id": "{{TICKET_ID}}",
        "ticketCode": "SVT-XXXXXX",
        "warrantyClaimId": "{{CLAIM_ID}}",
        "status": "PENDING"
      }
    ]
  }
}
```

**Verify DB:**
```sql
SELECT * FROM warranty_claims WHERE order_id = '{{ORDER_ID}}';
-- status = PENDING_REVIEW, claim_code = WCL-XXXXXX

SELECT * FROM service_tickets WHERE warranty_claim_id = '{{CLAIM_ID}}';
-- status = PENDING, ticket_code = SVT-XXXXXX
```

---

## 2. Guest: Tạo Claim bằng Order Code

> Guest (walk-in) không có tài khoản, dùng order_code để tạo claim.

```http
POST /api/v1/warranty-claims/lookup
Content-Type: application/json

{
  "orderCode": "{{ORDER_CODE_GUEST}}",
  "serviceType": "REPAIR",
  "issueDescription": "Cần chỉnh lại size từ 7 lên 8",
  "proofImages": []
}
```

**Expected Response (201):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID_GUEST}}",
    "claimCode": "WCL-YYYYYY",
    "status": "PENDING_REVIEW",
    "serviceType": "REPAIR",
    "serviceTickets": [{ "status": "PENDING" }]
  }
}
```

> 🧪 **Test:** Gọi với `orderCode` sai → 404 "Order not found"

---

## 3. Manager: Review Claim — Approve (trong bảo hành)

> Manager kiểm tra claim, thấy trong phạm vi bảo hành → duyệt miễn phí.

```http
PATCH /api/v1/warranty-claims/{{CLAIM_ID}}/review
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "action": "approve",
  "managerNote": "Trong phạm vi bảo hành, xử lý miễn phí"
}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "status": "PENDING_RECEIVE",
    "chargeStatus": "FREE",
    "extraFee": 0,
    "managerNote": "Trong phạm vi bảo hành, xử lý miễn phí"
  }
}
```

**Verify DB:**
```sql
SELECT status, charge_status, extra_fee FROM warranty_claims WHERE id = '{{CLAIM_ID}}';
-- status = PENDING_RECEIVE, charge_status = FREE, extra_fee = 0
```

---

## 4. Manager: Review Claim — Quotation (ngoài bảo hành)

> Dùng claim khác (từ bước 2), manager thấy ngoài bảo hành → gửi báo giá.

```http
PATCH /api/v1/warranty-claims/{{CLAIM_ID_GUEST}}/review
Authorization: Bearer {{managerJwt}}
Content-Type: application/json

{
  "action": "quotation",
  "extraFee": 500000,
  "managerNote": "Chỉnh size không thuộc bảo hành. Chi phí: 500,000 VND"
}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID_GUEST}}",
    "status": "QUOTATION_SENT",
    "extraFee": 500000,
    "managerNote": "Chỉnh size không thuộc bảo hành. Chi phí: 500,000 VND"
  }
}
```

> 🧪 **Test:** Review với `action` không hợp lệ → 400
> 🧪 **Test:** Quotation không có `extraFee` → 400

---

## 5. Customer: Confirm Quotation

> Customer xem báo giá, đồng ý.

```http
PATCH /api/v1/warranty-claims/{{CLAIM_ID_GUEST}}/confirm
Authorization: Bearer {{customerJwt}}
Content-Type: application/json

{}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID_GUEST}}",
    "status": "AWAITING_PAYMENT",
    "customerConfirmedAt": "2026-07-19T..."
  }
}
```

**Verify DB:**
```sql
SELECT status, customer_confirmed_at FROM warranty_claims WHERE id = '{{CLAIM_ID_GUEST}}';
-- status = AWAITING_PAYMENT, customer_confirmed_at NOT NULL
```

---

## 6. Customer: Pay Extra Fee

> Customer thanh toán phí dịch vụ qua PayOS.

```http
POST /api/v1/warranty-claims/{{CLAIM_ID_GUEST}}/payments
Authorization: Bearer {{customerJwt}}
```

**Expected Response (201):**
```json
{
  "payment": {
    "id": "{{PAYMENT_ID}}",
    "paymentPhase": "EXTRA_FEE",
    "amount": 500000,
    "method": "PAYOS",
    "status": "PENDING",
    "paymentUrl": "https://pay.payos.vn/..."
  },
  "paymentUrl": "https://pay.payos.vn/..."
}
```

> 📌 Sau khi PayOS webhook callback: `payments.status = PAID`, `warranty_claims.status = PENDING_RECEIVE`

**Verify DB sau webhook:**
```sql
SELECT status FROM warranty_claims WHERE id = '{{CLAIM_ID_GUEST}}';
-- PENDING_RECEIVE
```

---

## 7. Staff: Nhận Sản Phẩm + Assign Jeweler

> Khách mang nhẫn đến cửa hàng. Staff kiểm tra, nhận sản phẩm, assign jeweler.

```http
POST /api/v1/warranty-claims/{{CLAIM_ID}}/receive
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "claimId": "{{CLAIM_ID}}",
  "conditionNote": "Nhẫn có vết xước nhẹ ở mặt trên, không bị móp",
  "receivedImages": ["https://res.cloudinary.com/dpm0zc06s/image/upload/v1/received.jpg"],
  "jewelerId": "{{JEWELER_ID}}"
}
```

> ⚠️ **Lưu ý:** POST body dùng chính claimId trong URL, không cần claimId trong body (controller đọc từ param).

```http
POST /api/v1/warranty-claims/{{CLAIM_ID}}/receive
Authorization: Bearer {{staffJwt}}
Content-Type: application/json

{
  "conditionNote": "Nhẫn có vết xước nhẹ ở mặt trên, không bị móp",
  "receivedImages": ["https://res.cloudinary.com/dpm0zc06s/image/upload/v1/received.jpg"],
  "jewelerId": "{{JEWELER_ID}}"
}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "status": "IN_SERVICE",
    "serviceTickets": [
      {
        "id": "{{TICKET_ID}}",
        "status": "RECEIVED",
        "assignedJewelerId": "{{JEWELER_ID}}",
        "receivedProductAt": "2026-07-19T..."
      }
    ]
  }
}
```

**Verify DB:**
```sql
SELECT status FROM warranty_claims WHERE id = '{{CLAIM_ID}}';
-- IN_SERVICE

SELECT status, assigned_jeweler_id, received_product_at FROM service_tickets WHERE warranty_claim_id = '{{CLAIM_ID}}';
-- RECEIVED, assigned_jeweler_id NOT NULL, received_product_at NOT NULL

SELECT * FROM staff_assignments WHERE warranty_claim_id = '{{CLAIM_ID}}';
-- assignment_type = SERVICE, status = ASSIGNED
```

---

## 8. Jeweler: Hoàn Thành Sửa Chữa

> Jeweler sửa xong, cập nhật kết quả.

```http
PATCH /api/v1/warranty-claims/{{CLAIM_ID}}/complete
Authorization: Bearer {{jewelerJwt}}
Content-Type: application/json

{
  "resultNote": "Đã đánh bóng lại toàn bộ nhẫn, vết xước đã hết",
  "costUpdate": 0
}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "status": "IN_SERVICE",
    "serviceTickets": [
      {
        "id": "{{TICKET_ID}}",
        "status": "COMPLETED",
        "resultNote": "Đã đánh bóng lại toàn bộ nhẫn, vết xước đã hết",
        "costUpdate": 0,
        "serviceCompletedAt": "2026-07-19T..."
      }
    ]
  }
}
```

**Verify DB:**
```sql
SELECT status, result_note, cost_update, service_completed_at FROM service_tickets WHERE warranty_claim_id = '{{CLAIM_ID}}';
-- COMPLETED, result_note NOT NULL, service_completed_at NOT NULL
```

---

## 9. Staff: Trả Sản Phẩm → COMPLETED

> Staff trả nhẫn cho khách, đóng claim.

```http
PATCH /api/v1/warranty-claims/{{CLAIM_ID}}/return
Authorization: Bearer {{staffJwt}}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "status": "COMPLETED"
  }
}
```

**Verify DB:**
```sql
SELECT status, updated_at FROM warranty_claims WHERE id = '{{CLAIM_ID}}';
-- COMPLETED, updated_at = NOW
```

---

## 10. Customer: Xem Danh Sách Claims

> Customer xem tất cả claims của mình.

```http
GET /api/v1/warranty-claims?page=1&limit=10
Authorization: Bearer {{customerJwt}}
```

**Expected Response (200):**
```json
{
  "data": [
    {
      "id": "{{CLAIM_ID}}",
      "claimCode": "WCL-XXXXXX",
      "status": "COMPLETED",
      "serviceType": "WARRANTY",
      "serviceTickets": [{ "status": "COMPLETED" }]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "lastPage": 1
  }
}
```

> 📌 List API phải dùng `?? []` fallback cho `data` và `?? { total: 0, ... }` fallback cho `meta`.

---

## 11. Customer: Xem Detail Claim

```http
GET /api/v1/warranty-claims/{{CLAIM_ID}}
Authorization: Bearer {{customerJwt}}
```

**Expected Response (200):**
```json
{
  "claim": {
    "id": "{{CLAIM_ID}}",
    "claimCode": "WCL-XXXXXX",
    "status": "COMPLETED",
    "serviceTickets": [...],
    "payments": []
  }
}
```

---

## 12. Test Edge Cases

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Customer tạo claim với `warrantyId` không thuộc order | 400 |
| 2 | Customer tạo claim với `orderId` không phải của mình | 403 |
| 3 | Guest tạo claim với `orderCode` không tồn tại | 404 |
| 4 | Manager review claim không ở PENDING_REVIEW | 400 |
| 5 | Manager quotation không có `extraFee` | 400 |
| 6 | Customer confirm claim không ở QUOTATION_SENT | 400 |
| 7 | Customer confirm claim không phải của mình | 403 |
| 8 | Staff receive claim không ở PENDING_RECEIVE hoặc APPROVED | 400 |
| 9 | Jeweler complete claim không ở IN_SERVICE | 400 |
| 10 | Staff return claim khi service ticket chưa COMPLETED | 400 |
| 11 | GET claims list với `?? []` — database rỗng → `{ data: [], meta: { total: 0 } }` | curl |
| 12 | Lookup claim với order chưa có warranty → 404 | curl |

---

## 13. Variable Reference

| Variable | Nguồn | Ghi chú |
|----------|-------|---------|
| `{{customerJwt}}` | Login customer | Chủ sở hữu order |
| `{{managerJwt}}` | Login manager | User có `order.write` |
| `{{staffJwt}}` | Login staff | User có `order.write` |
| `{{jewelerJwt}}` | Login jeweler | User có `order.write` |
| `{{ORDER_ID}}` | Tests trước | UUID orders |
| `{{ORDER_CODE_GUEST}}` | Tests trước | order_code của guest order |
| `{{WARRANTY_ID}}` | Auto-generated sau COMPLETED | UUID warranties |
| `{{CLAIM_ID}}` | Response bước 1 | UUID warranty_claims |
| `{{CLAIM_ID_GUEST}}` | Response bước 2 | UUID warranty_claims cho guest |
| `{{TICKET_ID}}` | Response bước 1 | UUID service_tickets |
| `{{JEWELER_ID}}` | Users table | UUID jeweler |
| `{{PAYMENT_ID}}` | Response bước 6 | UUID payments |
