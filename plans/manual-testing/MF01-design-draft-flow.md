# MF01 — Design Draft Flow — Manual Test

## Prerequisites

| Item | Note |
|------|------|
| Server đang chạy | `npm run dev` |
| Guest session cookie | Tự động set bởi gateway khi request đầu tiên |
| JWT token | Cần login để test claim endpoint |
| Dữ liệu catalog | `npm run prisma:seed` nếu DB rỗng |

---

## 1. Lấy danh sách sản phẩm

```http
GET /api/v1/products?page=1&limit=10
Cookie: guest_session_id=guest-001
```

**Response mẫu:**
```json
{
  "products": [
    {
      "id": "uuid-của-product",
      "name": "Classic Solitaire",
      "basePrice": 12000000,
      "availableMaterials": [...],
      "availableGemstones": [...]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

Ghi nhớ `id` của product muốn dùng.

---

## 2. Tạo design draft (guest)

```http
POST /api/v1/design/drafts
Cookie: guest_session_id=guest-001
Content-Type: application/json

{
  "productId": "PRODUCT_ID_TỪ_BƯỚC_1",
  "ringStyle": "CLASSIC",
  "ringShape": "ROUND",
  "ringSize": "7",
  "selectedMaterialId": "MATERIAL_ID",
  "selectedGemstoneId": "GEMSTONE_ID",
  "customizationConfig": "{\"engravedType\":null,\"engravingPositions\":{},\"selectedBiometrics\":[],\"memoryCard\":false}"
}
```

**Response mẫu:**
```json
{
  "draft": {
    "id": "DRAFT_ID",
    "designCode": "RS-A7B9X2",
    "productId": "PRODUCT_ID",
    "status": "DRAFT",
    "customizationConfig": "{\"engravedType\":null,\"engravingPositions\":{},\"selectedBiometrics\":[],\"memoryCard\":false}",
    "estimatedPrice": 13200000
  },
  "designCode": "RS-A7B9X2"
}
```

Ghi nhớ `id` (DRAFT_ID) và `designCode`.

---

## 3. Tra cứu design draft bằng code

```http
GET /api/v1/design/drafts/by-code/RS-A7B9X2
```

**Response:** detail của draft.

---

## 4. Lấy danh sách drafts của guest

```http
GET /api/v1/design/drafts
Cookie: guest_session_id=guest-001
```

**Response:** `{ "drafts": [...] }`

---

## 5. Cập nhật design draft (thêm tùy chỉnh)

```http
PUT /api/v1/design/drafts/DRAFT_ID
Cookie: guest_session_id=guest-001
Content-Type: application/json

{
  "ringSize": "8",
  "selectedMaterialId": "MATERIAL_ID_KHÁC",
  "customizationConfig": "{\"engravedType\":\"sw\",\"selectedBiometrics\":[\"SW\"],\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}}},\"memoryCard\":false}"
}
```

`DRAFT_ID` lấy từ response bước 2.

---

## 6. Claim design draft (mobile user — cần JWT)

> Yêu cầu: `Authorization: Bearer <JWT>` với permission `design.write`.

```http
POST /api/v1/design/drafts/claim
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "designCode": "RS-A7B9X2"
}
```

**Response mẫu:**
```json
{
  "qrCode": "a1b2c3d4e5f6",
  "draft": {
    "id": "DRAFT_ID",
    "userId": "USER_ID_TỪ_JWT",
    "status": "CONVERTED",
    ...
  },
  "engraving": {
    "id": "ENGRAVING_ID",
    "userId": "USER_ID_TỪ_JWT",
    "productId": "PRODUCT_ID",
    "status": "ACTIVE"
  },
  "engravingVersion": {
    "id": "VERSION_ID",
    "engravingId": "ENGRAVING_ID",
    "versionNumber": 1,
    "status": "PENDING"
  }
}
```

Ghi nhớ `engraving.id` (ENGRAVING_ID) và `engravingVersion.id` (VERSION_ID) — dùng cho MF02.

> **Note:** Draft response thực tế gồm `userId`, `designSource`, `ringStyle`, `ringShape`, `ringSize`, `selectedMaterialId`, `selectedGemstoneId`, `product` (nested), `selectedMaterial` (nested), `selectedGemstone` (nested), `createdAt`, `updatedAt`.

---

## Flow hoàn chỉnh

```
[Guest] GET products ──→ POST draft ──→ GET draft by code ──→ PUT draft (tuỳ chọn)
                                                                    │
                                                                    ▼
[Mobile] POST claim ──→ nhận engravingId + versionId ──→ qua MF02
```
