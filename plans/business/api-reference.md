# Bioring API Reference

> **Source:** API Gateway — `apps/api-gateway/src/modules/`
> **Auth:** Global JWT guard (`AuthGuard` + `PermissionRbacGuard`). `@Public()` bypasses JWT. `@Permissions()` kiểm tra thêm quyền.
> **Base URL:** `http://localhost:3000`

---

# 1. Identity Module

## 1.1 Auth

Controller: `apps/api-gateway/src/modules/identity/auth/auth.controller.ts`
Route prefix: `auth` (class-level @Public())

### 1. GET `/auth/google`
**Auth:** @Public(), @UseGuards(GoogleOauthGuard)
**Description:** Google OAuth login — redirects to Google consent screen

| Query | Type | Required | Description |
|-------|------|----------|-------------|
| platform | string | No | `mobile` for mobile app flow, defaults to `web` |
| app_redirect | string | No | Custom scheme URL (e.g. `bioringapp://auth/callback`) |

**Response:** `302 Redirect` to Google OAuth consent screen

---

### 2. GET `/auth/google/callback`
**Auth:** @Public(), @UseGuards(GoogleOauthGuard)
**Description:** Google OAuth callback — handles redirect from Google

| Query | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | No | Authorization code from Google |
| state | string | No | Base64url-encoded JSON with platform and appRedirect |

**Response:** `302 Redirect`
- Web: redirect to FRONTEND_URL with token param + httpOnly refresh_token cookie
- Mobile: redirect to app_redirect with token & refreshToken query params

---

### 3. POST `/auth/refresh`
**Auth:** @Public()
**Description:** Refresh access token

**Request:** Cookie `refresh_token` (httpOnly)

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 4. POST `/auth/logout`
**Auth:** @Public()
**Description:** Logout

**Request:** Cookie `refresh_token` (httpOnly)

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

### 5. GET `/auth/me`
**Auth:** Bearer token
**Description:** Get current authenticated user profile + permission slugs.

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@bioring.com",
    "fullName": "Admin",
    "phone": "0909123456",
    "avatarUrl": null,
    "status": "ACTIVE",
    "customerType": null,
    "isVip": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "roles": ["ADMIN"],
    "lastLogin": "2026-07-16T09:00:00.000Z"
  },
  "permissions": ["user.read", "user.write", "order.read", "order.write", "dashboard.view"]
}
```

---

## 1.2 Users

Controller: `apps/api-gateway/src/modules/identity/users/users.controller.ts`
Route prefix: `users` (@ApiBearerAuth class-level)

### 6. GET `/users`
**Auth:** `user.read`
**Description:** List users (paginated)

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 10 |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@gmail.com",
      "fullName": "John Doe",
      "phone": "0987654321",
      "status": "ACTIVE",
      "customerType": null,
      "isVip": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "roles": ["CUSTOMER"],
      "lastLogin": "2026-07-15T14:30:00.000Z"
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

---

### 7. GET `/users/:id`
**Auth:** `user.read`
**Description:** Get user by ID

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@gmail.com",
    "fullName": "John Doe",
    "phone": "0987654321",
    "avatarUrl": null,
    "status": "ACTIVE",
    "customerType": null,
    "isVip": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "roles": ["CUSTOMER"],
    "lastLogin": "2026-07-15T14:30:00.000Z"
  }
}
```

---

### 8. PATCH `/users/:id/ban`
**Auth:** `user.block`
**Description:** Ban user

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---

### 9. PATCH `/users/:id/unban`
**Auth:** `user.block`
**Description:** Unban user

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---

### 10. POST `/users/:id/assign-role`
**Auth:** `user.write`
**Description:** Assign role to user

**Param:** `id` (UUID v4)

| Query | Type | Required | Description |
|-------|------|----------|-------------|
| roleId | UUID v4 | Yes | Role UUID |

**Response:** `{ "success": true }`

---


### 11. POST `/users`
**Auth:** `user.write`
**Description:** Create a staff user. Optionally assign role in one call.

**Request:**
```json
{
  "email": "staff@bioring.com",
  "fullName": "Nguyen Van A",
  "phone": "0909123456",
  "roleId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response:** User object (`{ user: {...} }`)

---

### 12. PATCH `/users/:id`
**Auth:** `user.write`
**Description:** Update user email, fullName, phone, or status.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "fullName": "Nguyen Van B",
  "phone": "0909987654"
}
```

**Response:** User object (`{ user: {...} }`)

---
## 1.3 RBAC (Roles & Permissions)

Controller: `apps/api-gateway/src/modules/identity/rbac/rbac.controller.ts`
Route prefix: `rbac` (@ApiBearerAuth class-level)

### 13. GET `/rbac/roles`
**Auth:** `role.read`
**Description:** List all roles

**Response:**
```json
{
  "roles": [
    { "id": "660e8400-e29b-41d4-a716-446655440001", "name": "ADMIN", "description": "Administrator" },
    { "id": "660e8400-e29b-41d4-a716-446655440002", "name": "CUSTOMER", "description": "Customer" }
  ]
}
```

---

### 14. GET `/rbac/roles/:id`
**Auth:** `role.read`
**Description:** Get role with permissions

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "role": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "ADMIN",
    "description": "Administrator",
    "permissions": [
      { "id": "770e8400-e29b-41d4-a716-446655440001", "slug": "users.read", "description": "Read users" }
    ]
  }
}
```

---

### 15. POST `/rbac/roles`
**Auth:** `role.write`
**Description:** Create role

**Request:**
```json
{
  "name": "MANAGER",
  "description": "Manager role"
}
```

**Response:**
```json
{
  "role": {
    "id": "660e8400-e29b-41d4-a716-446655440003",
    "name": "MANAGER",
    "description": "Manager role"
  }
}
```

---

### 16. PATCH `/rbac/roles/:id`
**Auth:** `role.write`
**Description:** Update role

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "name": "SUPER_MANAGER",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "role": {
    "id": "660e8400-e29b-41d4-a716-446655440003",
    "name": "SUPER_MANAGER",
    "description": "Updated description"
  }
}
```

---

### 17. DELETE `/rbac/roles/:id`
**Auth:** `role.write`
**Description:** Delete role

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---

### 18. GET `/rbac/permissions`
**Auth:** `role.read`
**Description:** List all permissions

**Response:**
```json
{
  "permissions": [
    { "id": "770e8400-e29b-41d4-a716-446655440001", "slug": "users.read", "description": "Read users" },
    { "id": "770e8400-e29b-41d4-a716-446655440002", "slug": "users.write", "description": "Create/update users" }
  ]
}
```

---

### 19. POST `/rbac/permissions/assign`
**Auth:** `role.write`
**Description:** Assign permissions to role

**Request:**
```json
{
  "roleId": "660e8400-e29b-41d4-a716-446655440001",
  "permissionIds": [
    "770e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ]
}
```

**Response:** `{ "success": true }`

---

# 2. Biometric Module

Controller: `apps/api-gateway/src/modules/biometric/biometric.controller.ts`
Route prefix: `biometric`

### 20. GET `/biometric/health`
**Auth:** @Public()
**Description:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "API Gateway is healthy",
  "timestamp": "2026-06-24T10:00:00.000Z"
}
```

---

### 21. GET `/biometric/ping`
**Auth:** @Public()
**Description:** Ping biometric service through gRPC

**Response:**
```json
{
  "pong": true,
  "receivedAt": "2026-06-24T10:00:00.000Z",
  "data": "ping from api-gateway"
}
```

---

# 3. Ecommerce Module

## 3.1 Catalog

Controller: `apps/api-gateway/src/modules/ecommerce/catalog/catalog.controller.ts`
Route prefix: `api/v1` (class-level @Public())

### 22. GET `/api/v1/products`
**Auth:** @Public()
**Description:** Get paginated product catalog

| Query | Type | Required |
|-------|------|----------|
| page | number | No |
| limit | number | No |
| materialId | UUID | No |
| maxPrice | number | No |

**Response:**
```json
{
  "products": [
    {
      "id": "prod-classic-band",
      "name": "Classic Solitaire",
      "description": "A timeless solitaire engagement ring",
      "baseMaterialId": "mat-gold-18k",
      "basePrice": 1200,
      "thumbnailUrl": "https://cdn.bioring.com/placeholder/ring-default.png",
      "model3dUrl": "https://cdn.bioring.com/placeholder/ring-default.glb",
      "availableMaterials": [
        { "id": "mat-gold-18k", "name": "Vàng 18K", "purity": "75%", "color": "Vàng", "currentPricePerGram": 1200 }
      ],
      "availableGemstones": [
        { "id": "gmt-diamond-05", "type": "Kim cương", "carat": 0.5, "cut": "Brilliant", "color": "D", "clarity": "VS1", "certificationCode": "GIA-123456", "price": 3000, "isAvailable": true }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 23. GET `/api/v1/products/:id`
**Auth:** @Public()
**Description:** Get product by ID

**Param:** `id` (string)

**Response:**
```json
{
  "product": {
    "id": "prod-classic-band",
    "name": "Classic Solitaire",
    "description": "A timeless solitaire engagement ring",
    "baseMaterialId": "mat-gold-18k",
    "basePrice": 1200,
    "thumbnailUrl": "https://cdn.bioring.com/placeholder/ring-default.png",
    "model3dUrl": "https://cdn.bioring.com/placeholder/ring-default.glb",
    "availableMaterials": [],
    "availableGemstones": []
  }
}
```

---

### 24. GET `/api/v1/materials`
**Auth:** @Public()
**Description:** Get all available materials

**Response:**
```json
{
  "materials": [
    { "id": "mat-gold-18k", "name": "Vàng 18K", "purity": "75%", "color": "Vàng", "currentPricePerGram": 1200 }
  ]
}
```

---

### 25. GET `/api/v1/gemstones`
**Auth:** @Public()
**Description:** Get all available gemstones

**Response:**
```json
{
  "gemstones": [
    { "id": "gmt-diamond-05", "type": "Kim cương", "carat": 0.5, "cut": "Brilliant", "color": "D", "clarity": "VS1", "certificationCode": "GIA-123456", "price": 3000, "isAvailable": true }
  ]
}
```

---

### 26. POST `/api/v1/products`
**Auth:** `catalog.write`
**Description:** Create a new product

**Request:**
```json
{
  "name": "Classic Band",
  "description": "A timeless design",
  "base_price": 5000000,
  "base_material_id": "550e8400-...",
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "model_3d_url": "https://cdn.example.com/model.glb"
}
```

**Response:**
```json
{
  "success": true,
  "id": "550e8400-..."
}
```

---

### 27. PUT `/api/v1/products/:id`
**Auth:** `catalog.write`
**Description:** Update a product

**Param:** `id` (UUID v4)

**Request:** (partial)
```json
{
  "name": "Classic Band Updated",
  "base_price": 6000000
}
```

**Response:** `{ "success": true }`

---

### 28. DELETE `/api/v1/products/:id`
**Auth:** `catalog.write`
**Description:** Soft-delete a product (sets is_active = false)

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---

## 3.2 Design

Controller: `apps/api-gateway/src/modules/ecommerce/design/design.controller.ts`
Route prefix: `api/v1/design`

### 29. POST `/api/v1/design/drafts`
**Auth:** @Public() (requires `guest_session_id` cookie)
**Description:** Create a new design draft (guest)

**Cookie:** `guest_session_id`

**Request:**
```json
{
  "productId": "prod-classic-band",
  "ringStyle": "CLASSIC",
  "ringShape": "ROUND",
  "ringSize": "7",
  "selectedMaterialId": "mat-gold-18k",
  "selectedGemstoneId": "gmt-diamond-05",
  "customizationConfig": "{\"engravedType\":\"fp\",...}"
}
```

**Response:**
```json
{
  "draft": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "productId": "prod-classic-band",
    "designCode": "RS-A7B9X2",
    "designSource": "WEB",
    "ringStyle": "CLASSIC",
    "status": "DRAFT",
    "product": {},
    "selectedMaterial": {},
    "selectedGemstone": {},
    "createdAt": "2026-06-24T10:00:00.000Z"
  },
  "designCode": "RS-A7B9X2"
}
```

---

### 30. GET `/api/v1/design/drafts/by-code/:code`
**Auth:** @Public()
**Description:** Get design draft by design code

**Param:** `code` (string)

**Response:**
```json
{
  "draft": { "id": "...", "designCode": "RS-A7B9X2", "ringStyle": "CLASSIC", ... }
}
```

---

### 31. GET `/api/v1/design/drafts`
**Auth:** @Public() (requires `guest_session_id` cookie)
**Description:** Get my design drafts

**Cookie:** `guest_session_id`

| Query | Type | Required |
|-------|------|----------|
| page | number | No |
| limit | number | No |

**Response:**
```json
{
  "drafts": [{ "id": "...", "designCode": "RS-A7B9X2", ... }]
}
```

---

### 32. PUT `/api/v1/design/drafts/:id`
**Auth:** @Public() (requires `guest_session_id` cookie)
**Description:** Update a design draft

**Param:** `id` (UUID v4)
**Cookie:** `guest_session_id`

**Request:** (partial update — same fields as create, all optional)

**Response:**
```json
{
  "draft": { "id": "...", "ringStyle": "CLASSIC", ... }
}
```

---

### 33. POST `/api/v1/design/drafts/claim`
**Auth:** `design.write` (JWT required)
**Description:** Claim a design draft by code. Creates Engraving + EngravingVersion.

**Request:**
```json
{
  "designCode": "RS-A7B9X2"
}
```

**Response:**
```json
{
  "draft": { "id": "...", "designCode": "RS-A7B9X2" },
  "engraving": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "productId": "prod-classic-band",
    "status": "PENDING",
    "versions": [{ "id": "550e8400-...", "versionNumber": 1, "status": "PENDING" }],
    "biometrics": []
  },
  "engravingVersion": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "engravingId": "550e8400-...",
    "versionNumber": 1,
    "status": "PENDING"
  }
}
```

---

## 3.3 Engraving

Controller: `apps/api-gateway/src/modules/ecommerce/engraving/engraving.controller.ts`
Route prefix: `api/v1/engravings`

### 34. POST `/api/v1/engravings`
**Auth:** JWT (bearer)
**Description:** Create a new engraving (from mobile without design code). Tạo Engraving + EngravingVersion v1 rỗng + qr_memories default.

**Request:**
```json
{
  "productId": "prod-classic-band"
}
```

**Response:**
```json
{
  "engraving": { "id": "...", "status": "PENDING", "versions": [], "biometrics": [] },
  "engravingVersion": { "id": "...", "versionNumber": 1, "status": "PENDING" },
  "qrCode": "a1b2c3d4e5f6"
}
```

---

### 35. GET `/api/v1/engravings`
**Auth:** JWT (bearer)
**Description:** Get my engravings (paginated)

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 10 |
| status | string | No | PENDING |
| orderId | UUID | No | — |

**Response:**
```json
{
  "engravings": [
    {
      "id": "550e8400-...",
      "orderId": "550e8400-...",
      "status": "PENDING",
      "currentVersion": { "id": "...", "versionNumber": 1 }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 36. GET `/api/v1/engravings/:id`
**Auth:** JWT (bearer)
**Description:** Get engraving detail by ID (kèm versions, biometrics, qrMemory)

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "engraving": {
    "id": "550e8400-...",
    "status": "PENDING",
    "versions": [],
    "biometrics": [],
    "currentVersion": { "id": "...", "versionNumber": 1 }
  }
}
```

---

### 37. PATCH `/api/v1/engravings/versions/:versionId/config`
**Auth:** JWT (bearer)
**Description:** Update engraving version config (incremental save). Gửi kèm `selectedBiometrics` để chọn gói (VD: ["SW","FP"]).

**Param:** `versionId` (UUID v4)

**Request:**
```json
{
  "selectedMaterialId": "a1111111-1111-4111-8111-111111111111",
  "selectedGemstoneId": "b1111111-1111-4111-8111-111111111111",
  "ringSize": "7",
  "ringStyle": "CLASSIC",
  "ringShape": "ROUND",
  "selectedBiometrics": ["SW", "FP"],
  "customizationConfig": "{\"engravedType\":\"sw\",\"selectedBiometrics\":[\"SW\"],\"memoryCard\":{\"recipientEmail\":\"\"},\"ringPreviewUrl\":\"https://res.cloudinary.com/.../preview.png\"}",
  "previewImageUrl": "https://res.cloudinary.com/.../preview.png",
  "model3dUrl": "https://res.cloudinary.com/.../model.glb",
  "productionFileUrl": "https://res.cloudinary.com/.../production.svg"
}
```

**Response:**
```json
{
  "version": {
    "id": "550e8400-...",
    "versionNumber": 1,
    "selectedMaterialId": "a1111111-...",
    "ringSize": "7",
    "ringStyle": "CLASSIC",
    "selectedMaterial": { "id": "...", "name": "Vàng 18K", "purity": "75%", "color": "Vàng", "currentPricePerGram": 1600000 },
    "selectedGemstone": { "id": "...", "type": "Kim cương", "carat": 0.5, "price": 15000000 }
  },
  "orderId": "",
  "orderStatus": ""
}
```

---

### 38. POST `/api/v1/engravings/:id/biometrics`
**Auth:** `order.write`
**Description:** Attach biometric data (unified). SW → audio, FP/HB → fingerprint/hand biometric.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "biometricType": "FP",
  "rawFileUrl": "https://res.cloudinary.com/.../fingerprint.png",
  "extraData": "{\"startMs\":0,\"endMs\":1000}"
}
```

**Response:**
```json
{
  "biometric": {
    "id": "550e8400-...",
    "engravingId": "550e8400-...",
    "biometricType": "FP",
    "requiredChannel": "ENGRAVING",
    "rawFileUrl": "https://res.cloudinary.com/.../fingerprint.png",
    "processedSvgUrl": "https://res.cloudinary.com/.../fingerprint.svg",
    "extraData": "",
    "status": "CAPTURED"
  }
}
```

---

### 39. PATCH `/api/v1/engravings/:id/cancel`
**Auth:** JWT (bearer)
**Description:** Cancel engraving (set status CANCELLED). Rejects if already has order or already cancelled.

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "success": true
}
```

---

## 3.4 Order

Controller: `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts`
Route prefix: `api/v1/orders`

### 40. POST `/api/v1/orders`
**Auth:** JWT (bearer)
**Description:** Create order from engraving. Server derives packageType from selected_biometrics. SW → AWAITING_SUBMIT, có FP/HB → AWAITING_DEPOSIT_1.

**Request:**
```json
{
  "engravingId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**Response:**
```json
{
  "order": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "orderCode": "BIORING-A7B9X2",
    "status": "AWAITING_SUBMIT",
    "captureRoute": "ONLINE",
    "designSource": "MOBILE",
    "subtotal": 12000000,
    "serviceFee": 1200000,
    "totalPrice": 13200000,
    "paidAmount": 0,
    "remainingAmount": 13200000,
    "payments": [],
    "engraving": {
      "id": "550e8400-...",
      "productId": "prod-classic-band",
      "status": "ACTIVE",
      "versions": [{ "id": "550e8400-...", "versionNumber": 1, "ringStyle": "CLASSIC", ... }],
      "biometrics": []
    },
    "createdAt": "2026-06-24T10:00:00.000Z"
  }
}
```

---

### 41. PATCH `/api/v1/orders/:id/submit`
**Auth:** JWT (bearer)
**Description:** Submit order for review. Moves from AWAITING_SUBMIT or REVISION_REQUIRED → PENDING_REVIEW.

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "PENDING_REVIEW", ... }
}
```

---

### 42. GET `/api/v1/orders/production-tasks`
**Auth:** `order.write`
**Description:** Get production tasks (paginated, filterable)

| Query | Type | Required |
|-------|------|----------|
| page | number | No |
| limit | number | No |
| status | string | No |
| orderId | UUID | No |
| jewelerId | UUID | No |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "orderId": "550e8400-...",
      "engravingId": "550e8400-...",
      "assignedJewelerId": "550e8400-...",
      "assignedJewelerName": "Nguyễn Văn A",
      "taskName": "Ring production - BIORING-A7B9X2",
      "taskDescription": "",
      "status": "IN_PROGRESS",
      "note": "",
      "startedAt": "2026-06-24T10:00:00.000Z",
      "completedAt": "",
      "createdAt": "2026-06-24T10:00:00.000Z",
      "orderCode": "BIORING-A7B9X2",
      "customerName": "Nguyễn Văn A",
      "ringSize": "7"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "lastPage": 1
}
```

---

### 43. GET `/api/v1/orders/:id`
**Auth:** JWT (bearer)
**Description:** Get order by ID

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "AWAITING_SUBMIT", ... }
}
```

---

### 44. GET `/api/v1/orders`
**Auth:** JWT (bearer)
**Description:** Get my orders (paginated)

| Query | Type | Required |
|-------|------|----------|
| page | number | No |
| limit | number | No |

**Response:**
```json
{
  "orders": [{ "id": "...", "orderCode": "BIORING-A7B9X2", "status": "AWAITING_SUBMIT", ... }],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 45. PUT `/api/v1/orders/:id/review`
**Auth:** `order.write`
**Description:** Review order (manager). Approve → AWAITING_DEPOSIT. Reject → REVISION_REQUIRED.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "action": "approve",
  "note": "Design looks good. Proceed to deposit."
}
```

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "AWAITING_DEPOSIT", ... }
}
```

---

### 46. PUT `/api/v1/orders/bulk/review`
**Auth:** `order.write`
**Description:** Bulk review orders (manager). Mỗi item approve/reject độc lập. Trả về kết quả từng cái.

**Request:**
```json
{
  "items": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "action": "approve" },
    { "id": "550e8400-e29b-41d4-a716-446655440002", "action": "reject", "note": "Need revision" }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "id": "...", "success": true, "order": { "id": "...", "orderCode": "BIORING-A7B9X2", ... } },
    { "id": "...", "success": false, "error": "Order not in PENDING_REVIEW status" }
  ]
}
```

---

### 47. POST `/api/v1/orders/:id/payments`
**Auth:** JWT (bearer)
**Description:** Initiate PayOS payment. paymentPhase = DEPOSIT_1 (IoT fee), DEPOSIT_2 (30% min 3000), or REMAINING.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "paymentPhase": "DEPOSIT_2",
  "returnUrl": "https://bioring.com/payment/success",
  "cancelUrl": "https://bioring.com/payment/cancel"
}
```

**Response:**
```json
{
  "payment": {
    "id": "550e8400-...",
    "orderId": "550e8400-...",
    "paymentPhase": "DEPOSIT_2",
    "amount": 3960000,
    "method": "PAYOS",
    "status": "PENDING",
    "payosTransactionId": "txn_abc123",
    "paymentUrl": "https://pay.payos.vn/checkout/abc123",
    "paidAt": "",
    "createdAt": "2026-06-24T10:00:00.000Z"
  },
  "paymentUrl": "https://pay.payos.vn/checkout/abc123"
}
```

---

### 48. POST `/api/v1/orders/:id/payments/cancel`
**Auth:** JWT (bearer)
**Description:** Cancel payment

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "success": true,
  "orderCode": "BIORING-A7B9X2"
}
```

---

### 49. POST `/api/v1/orders/payments/webhook`
**Auth:** @Public()
**Description:** PayOS webhook callback

**Request:** Raw PayOS webhook payload (JSON)

**Response:** `{ "success": true }`

---

### 50. SSE `/api/v1/orders/:orderCode/payments/events`
**Auth:** @Public()
**Description:** SSE payment status stream. Server-Sent Events cho real-time payment status.

**Param:** `orderCode` (string)

**Response:** SSE stream (MessageEvent)
```
data: { "status": "PAID", "transactionId": "txn_abc123", "orderCode": "172000000042" }
```
(heartbeat every 15s: `{ "type": "ping", "status": "waiting_for_payment" }`)

---

### 51. POST `/api/v1/orders/:id/assign-jeweler`
**Auth:** `order.write`
**Description:** Assign jeweler to order (manager). Creates production task → IN_PRODUCTION.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "jewelerId": "550e8400-e29b-41d4-a716-446655440030"
}
```

**Response:**
```json
{
  "task": {
    "id": "550e8400-...",
    "orderId": "550e8400-...",
    "engravingId": "550e8400-...",
    "assignedJewelerId": "550e8400-...",
    "assignedJewelerName": "Nguyễn Văn A",
    "status": "IN_PROGRESS",
    "startedAt": "2026-06-24T10:00:00.000Z",
    "completedAt": "",
    "createdAt": "2026-06-24T10:00:00.000Z"
  }
}
```

---

### 52. PUT `/api/v1/orders/production-tasks/:taskId/status`
**Auth:** `order.write`
**Description:** Update production task status. COMPLETED → order moves to PENDING_QC.

**Param:** `taskId` (UUID v4)

**Request:**
```json
{
  "status": "COMPLETED",
  "note": "Ring production finished"
}
```

**Response:**
```json
{
  "task": {
    "id": "550e8400-...",
    "status": "COMPLETED",
    "note": "Ring production finished",
    "completedAt": "2026-06-24T11:30:00.000Z"
  }
}
```

---

### 53. PUT `/api/v1/orders/:id/qc-accept`
**Auth:** `order.write`
**Description:** QC accept order (manager). PASS → READY_FOR_DELIVERY (remaining=0) / AWAITING_REMAINING (remaining>0). FAIL → IN_PRODUCTION (reset task).

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "result": "PASS",
  "checklist": "{\"engraving\":true,\"material\":true,\"size\":true}",
  "proofImages": ["https://cloudinary.com/img1.jpg"],
  "note": "Sản phẩm đạt yêu cầu"
}
```

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "READY_FOR_DELIVERY", ... }
}
```

---

### 54. POST `/api/v1/orders/:id/delivery`
**Auth:** `order.write`
**Description:** Initiate delivery (manager). PICKUP → READY_FOR_PICKUP. DELIVERY → chờ staff start.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "deliveryMethod": "DELIVERY",
  "recipientName": "Nguyen Van A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 đường ABC, Quận 1, TP.HCM",
  "assignedDeliveryStaffId": "550e8400-..."
}
```

**Response:**
```json
{
  "id": "550e8400-...",
  "orderId": "550e8400-...",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyen Van A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 đường ABC",
  "createdAt": "2026-07-03T10:00:00.000Z"
}
```

---

### 55. PUT `/api/v1/orders/:id/shipment/status`
**Auth:** `order.write`
**Description:** Update shipment status (staff). SHIPPING → start delivery. DELIVERED → confirm nhận → auto warranty + unlock QR + COMPLETED.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "status": "DELIVERED",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0909123456",
  "identityNote": "CMND: 123456789",
  "proofImageUrl": "https://cloudinary.com/signature.jpg",
  "trackingCode": "GHN-123456"
}
```

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "COMPLETED", ... }
}
```

---

### 56. GET `/api/v1/orders/:id/delivery`
**Auth:** JWT (bearer)
**Description:** Get delivery info

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "id": "550e8400-...",
  "orderId": "550e8400-...",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyen Van A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 đường ABC",
  "createdAt": "2026-07-03T10:00:00.000Z"
}
```

---

### 57. GET `/api/v1/orders/:id/warranty`
**Auth:** JWT (bearer)
**Description:** Get warranty info

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "warranty": {
    "id": "550e8400-...",
    "engravingId": "550e8400-...",
    "orderId": "550e8400-...",
    "warrantyCode": "WAR-BIORING-A7B9X2",
    "warrantyType": "STANDARD",
    "issueDate": "2026-07-03T10:00:00.000Z",
    "expiryDate": "2027-07-03T10:00:00.000Z",
    "status": "ACTIVE",
    "warrantyScope": "{\"description\":\"1 năm bảo hành chính hãng\",\"coverage\":[\"manufacturing_defect\"]}"
  }
}
```

---

### 58. GET `/api/v1/orders/:id/production`
**Auth:** JWT (bearer)
**Description:** Get production & QC info

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "task": {
    "id": "550e8400-...",
    "orderId": "550e8400-...",
    "engravingId": "550e8400-...",
    "assignedJewelerName": "Nguyễn Văn A",
    "status": "COMPLETED",
    "startedAt": "2026-06-24T10:00:00.000Z",
    "completedAt": "2026-06-24T11:30:00.000Z"
  },
  "qaCheck": {
    "id": "550e8400-...",
    "orderId": "550e8400-...",
    "result": "PASS",
    "checklist": "{\"engraving\":true,\"material\":true,\"size\":true}",
    "proofImages": ["https://cloudinary.com/img1.jpg"],
    "note": "Sản phẩm đạt yêu cầu",
    "checkedAt": "2026-07-03T10:00:00.000Z",
    "checkedByManagerId": "550e8400-..."
  }
}
```

---

### 59. GET `/api/v1/orders/:id/payment-status`
**Auth:** `order.write`
**Description:** Get payment status — xem trạng thái từng payment phase

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response (array of payment phases with status)

---

### 60. POST `/api/v1/orders/:id/payments/manual`
**Auth:** `order.write`
**Description:** Manual payment (staff thu tiền mặt). method=MANUAL, status=PAID ngay lập tức (không qua PayOS).

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "paymentPhase": "DEPOSIT_2",
  "amount": 3960000
}
```

**Response:** Raw gRPC response

---

### 61. POST `/api/v1/orders/lookup`
**Auth:** @Public()
**Description:** Lookup order by code (public)

**Request:**
```json
{
  "orderCode": "BIORING-ABC123"
}
```

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-ABC123", "status": "AWAITING_SUBMIT", ... }
}
```

---

### 62. PATCH `/api/v1/orders/:id/cancel`
**Auth:** `order.write`
**Description:** Cancel order (chỉ cancel được ở các trạng thái trước SHIPPING/DELIVERED/COMPLETED)

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "reason": "Khách hàng yêu cầu hủy"
}
```

**Response:**
```json
{
  "order": { "id": "...", "orderCode": "BIORING-A7B9X2", "status": "CANCELLED", ... }
}
```


### 63. GET `/api/v1/orders/deliveries`
**Auth:** `order.read`
**Description:** List deliveries (paginated). Filter by status, date range, search (order_code/tracking_code/phone).

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 20 |
| status | string | No | in_transit |
| from_date | string | No | 2026-07-01 |
| to_date | string | No | 2026-07-14 |
| search | string | No | DH001 |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "order_code": "DH001",
      "tracking_code": "VNPOST123456",
      "customer": { "name": "Nguyen Van A", "phone": "0901234567", "address": "123 Nguyen Hue, Q1, HCM" },
      "payment_status": "paid",
      "delivery_staff": { "id": "550e8400-...", "name": "Tran Van C", "avatar": "", "status": "busy", "current_deliveries": 3 },
      "status": "in_transit",
      "proof_of_delivery": null,
      "created_at": "2026-07-14T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "last_page": 1,
  "stats": { "ready_for_delivery": 5, "in_transit": 3, "waiting_for_pickup": 2 }
}
```

---

### 64. GET `/api/v1/orders/pickups`
**Auth:** `order.read`
**Description:** List in-store pickups. Filter by status (waiting/completed) and search (order_code / customer_name).

| Query | Type | Required | Example |
|-------|------|----------|---------|
| limit | number | No | 200 |
| status | string | No | waiting |
| search | string | No | ORD |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "order_code": "ORD-005",
      "customer_name": "David Chen",
      "customer_phone": "0945678901",
      "payment_status": "final_pending",
      "status": "waiting",
      "handover_staff_name": null,
      "handover_note": null,
      "proof_image": null
    }
  ]
}
```

---

## 3.5 QR Memory

Controller: `apps/api-gateway/src/modules/ecommerce/memory-card/memory-card.controller.ts`
Route prefix: `api/v1/qr-memories`

### 84. PUT `/api/v1/qr-memories/:engravingId`
**Auth:** JWT (bearer)
**Description:** Update QR memory card (cardTitle, greetingMessage, recipientEmail)

**Param:** `engravingId` (UUID v4)

**Request:**
```json
{
  "cardTitle": "Our Special Ring",
  "greetingMessage": "Thank you for being with me!",
  "recipientEmail": "friend@example.com",
  "cardThemeId": "550e8400-...",
  "customImages": ["https://cloudinary.com/img1.jpg"],
  "biometricDisplaySettings": "{\"showWaveform\":true,\"showHeartbeat\":true}"
}
```

**Response:**
```json
{
  "qrMemory": {
    "id": "...",
    "engravingId": "550e8400-...",
    "qrCode": "a1b2c3d4e5f6",
    "cardTitle": "Our Special Ring",
    "greetingMessage": "Thank you for being with me!",
    "recipientEmail": "friend@example.com",
    "isLocked": false,
    "createdAt": "2026-07-07T10:00:00.000Z"
  }
}
```

---

### 84. GET `/api/v1/qr-memories/:engravingId`
**Auth:** JWT (bearer)
**Description:** Get QR memory by engraving ID

**Param:** `engravingId` (UUID v4)

**Response:**
```json
{
  "qrMemory": { "id": "...", "engravingId": "550e8400-...", "cardTitle": "...", ... }
}
```

---

### 84. POST `/api/v1/qr-memories/activate`
**Auth:** @Public()
**Description:** Activate QR memory (unlock bằng qrCode + accessPin)

**Request:**
```json
{
  "qrCode": "a1b2c3d4e5f6",
  "accessPin": "1234"
}
```

**Response:**
```json
{
  "qrMemory": { "id": "...", "qrCode": "a1b2c3d4e5f6", "isLocked": false, ... }
}
```

---

## 3.6 Card Theme

Controller: `apps/api-gateway/src/modules/ecommerce/card-theme/card-theme.controller.ts`
Route prefix: `api/v1/card-themes`

### 84. GET `/api/v1/card-themes`
**Auth:** JWT (bearer)
**Description:** Get all card themes (paginated)

| Query | Type | Required |
|-------|------|----------|
| page | number | No |
| limit | number | No |

**Response:**
```json
{
  "cardThemes": [
    {
      "id": "550e8400-...",
      "themeCode": "ROMANTIC",
      "name": "Lãng mạn",
      "defaultBgUrl": "https://cdn.bioring.com/themes/romantic-bg.png",
      "styleConfig": "{\"fontFamily\":\"serif\",\"primaryColor\":\"#FF69B4\"}",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 84. GET `/api/v1/card-themes/:id`
**Auth:** JWT (bearer)
**Description:** Get card theme by ID

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "cardTheme": { "id": "...", "themeCode": "ROMANTIC", "name": "Lãng mạn", ... }
}
```

---

### 84. POST `/api/v1/card-themes`
**Auth:** `design.write`
**Description:** Create card theme

**Request:**
```json
{
  "themeCode": "ROMANTIC",
  "name": "Lãng mạn",
  "defaultBgUrl": "https://cdn.bioring.com/themes/romantic-bg.png",
  "styleConfig": "{\"fontFamily\":\"serif\"}"
}
```

**Response:**
```json
{
  "cardTheme": { "id": "...", "themeCode": "ROMANTIC", "name": "Lãng mạn", ... }
}
```

---

### 84. PUT `/api/v1/card-themes/:id`
**Auth:** `design.write`
**Description:** Update card theme

**Param:** `id` (UUID v4)

**Request:** (partial — same fields as create, all optional)

**Response:**
```json
{
  "cardTheme": { "id": "...", "themeCode": "ROMANTIC", ... }
}
```

---

### 84. DELETE `/api/v1/card-themes/:id`
**Auth:** `design.write`
**Description:** Delete card theme

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---

## 3.7 Guest

Controller: `apps/api-gateway/src/modules/ecommerce/guest/guest.controller.ts`
Route prefix: `api/v1/guest`

### 84. POST `/api/v1/guest/sessions`
**Auth:** `order.write`
**Description:** Tạo guest session cho khách vãng lai. Staff nhập thông tin khách → sinh guest_code GUE-XXXXXX.

**Request:**
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0909123456",
  "email": "guest@example.com",
  "note": "Khách muốn nhẫn bạc"
}
```

**Response:**
```json
{
  "guest": {
    "id": "550e8400-...",
    "guestCode": "GUE-A7B9X2",
    "fullName": "Nguyễn Văn A",
    "phone": "0909123456",
    "email": "guest@example.com",
    "note": "Khách muốn nhẫn bạc",
    "createdAt": "2026-07-07T10:00:00.000Z"
  }
}
```

---

### 84. POST `/api/v1/guest/orders`
**Auth:** `order.write`
**Description:** Tạo order cho guest (gộp createEngraving + createOrder). Tự động tạo engraving + version v1 + qr_memories + order.

**Request:**
```json
{
  "guestCustomerId": "550e8400-...",
  "productId": "550e8400-..."
}
```

**Response:**
```json
{
  "order": {
    "id": "550e8400-...",
    "orderCode": "172000000042",
    "guestCustomerId": "550e8400-...",
    "designSource": "WALK_IN",
    "status": "AWAITING_SUBMIT",
    "totalPrice": 13200000,
    "paidAmount": 0
  },
  "engraving": { "id": "550e8400-...", "productId": "550e8400-...", "status": "PENDING" },
  "version": { "id": "550e8400-...", "versionNumber": 1, "status": "PENDING" }
}
```

---

## 3.8 Guest Tablet

Controller: `apps/api-gateway/src/modules/ecommerce/guest/guest-tablet.controller.ts`
Route prefix: `api/v1/guest-tablet` (class-level @Public())

### 84. GET `/api/v1/guest-tablet/sessions/:guestCode`
**Auth:** @Public()
**Description:** Guest xem session + order đang active (AWAITING_SUBMIT hoặc REVISION_REQUIRED)

**Param:** `guestCode` (string)

**Response:**
```json
{
  "guest": {
    "id": "550e8400-...",
    "guestCode": "GUE-A7B9X2",
    "fullName": "Nguyễn Văn A",
    "phone": "0909123456"
  },
  "order": {
    "id": "550e8400-...",
    "orderCode": "172000000042",
    "status": "AWAITING_SUBMIT",
    "totalPrice": 13200000,
    "engraving": {
      "id": "550e8400-...",
      "status": "PENDING",
      "versions": [{ "id": "550e8400-...", "versionNumber": 1, "status": "PENDING" }],
      "biometrics": [],
      "qrMemory": null
    }
  }
}
```

---

### 84. PATCH `/api/v1/guest-tablet/engravings/:versionId/config`
**Auth:** @Public()
**Description:** Guest cập nhật engraving config trên tablet

**Param:** `versionId` (UUID v4)

| Query | Type | Required |
|-------|------|----------|
| guestCode | string | Yes |

**Request:**
```json
{
  "selectedMaterialId": "550e8400-...",
  "ringSize": "7"
}
```

**Response:** Version update response

---

### 84. PATCH `/api/v1/guest-tablet/orders/:orderId/submit`
**Auth:** @Public()
**Description:** Guest submit / resubmit order. Lần đầu: AWAITING_SUBMIT → PENDING_REVIEW. Resubmit: REVISION_REQUIRED → PENDING_REVIEW.

**Param:** `orderId` (UUID v4)

**Request:**
```json
{
  "guestCode": "GUE-A7B9X2"
}
```

**Response:**
```json
{
  "order": { "id": "550e8400-...", "orderCode": "172000000042", "status": "PENDING_REVIEW" },
  "isResubmit": false
}
```

---

### 84. GET `/api/v1/guest-tablet/orders/:orderId`
**Auth:** @Public()
**Description:** Guest xem chi tiết order

**Param:** `orderId` (UUID v4)

| Query | Type | Required |
|-------|------|----------|
| guestCode | string | Yes |

**Response:** Raw order detail

---

### 84. POST `/api/v1/guest-tablet/orders/:orderId/payments`
**Auth:** @Public()
**Description:** Guest thanh toán FULL (100%) qua PayOS

**Param:** `orderId` (UUID v4)

**Request:**
```json
{
  "guestCode": "GUE-A7B9X2",
  "returnUrl": "bioring://payment/result",
  "cancelUrl": "bioring://payment/cancel"
}
```

**Response:**
```json
{
  "payment": {
    "id": "550e8400-...",
    "orderId": "550e8400-...",
    "paymentPhase": "FULL",
    "amount": 13200000,
    "method": "PAYOS",
    "status": "PENDING",
    "paymentUrl": "https://pay.payos.vn/..."
  },
  "paymentUrl": "https://pay.payos.vn/..."
}
```

---

### 84. PUT `/api/v1/guest-tablet/qr-memories/:engravingId`
**Auth:** @Public()
**Description:** Guest cập nhật QR memory card trên tablet

**Param:** `engravingId` (UUID v4)

**Request:**
```json
{
  "guestCode": "GUE-A7B9X2",
  "cardTitle": "Our Special Ring",
  "greetingMessage": "Thank you for being with me!",
  "recipientEmail": "friend@example.com"
}
```

**Response:** QR memory response

---

### 84. POST `/api/v1/guest-tablet/orders/:orderId/shipping-info`
**Auth:** @Public()
**Description:** Guest chọn hình thức nhận hàng (PICKUP/DELIVERY) + nhập địa chỉ

**Param:** `orderId` (UUID v4)

**Request:**
```json
{
  "guestCode": "GUE-A7B9X2",
  "deliveryMethod": "DELIVERY",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM"
}
```

**Response:**
```json
{
  "id": "550e8400-...",
  "orderId": "550e8400-...",
  "deliveryMethod": "DELIVERY",
  "status": "PENDING",
  "recipientName": "Nguyễn Văn A",
  "recipientPhone": "0909123456",
  "shippingAddressText": "123 Đường ABC, Quận 1, TP.HCM"
}
```

---

## 3.9 Capture Session

Controller: `apps/api-gateway/src/modules/ecommerce/capture-session/capture-session.controller.ts`
Route prefix: `api/v1/capture-sessions`

### 84. POST `/api/v1/capture-sessions`
**Auth:** `order.write`
**Description:** Create capture session (IoT capture tại store)

**Request:**
```json
{
  "orderId": "550e8400-...",
  "deviceId": "550e8400-..."
}
```

**Response:** Raw gRPC response

---

### 84. PATCH `/api/v1/capture-sessions/:id/complete`
**Auth:** `order.write`
**Description:** Complete capture session

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "qualityScore": 85,
  "staffNote": "Capture completed successfully"
}
```

**Response:** Raw gRPC response

---

### 84. GET `/api/v1/capture-sessions`
**Auth:** `order.write`
**Description:** Get capture sessions (filter by orderId)

| Query | Type | Required |
|-------|------|----------|
| orderId | UUID | No |

**Response:** Raw gRPC response

---

### 84. GET `/api/v1/capture-sessions/:id`
**Auth:** `order.write`
**Description:** Get capture session by ID

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response

---

## 3.10 Admin Dashboard

Controller: `apps/api-gateway/src/modules/ecommerce/admin/admin.controller.ts`
Route prefix: `api/v1/admin/dashboard`

### 84. GET `/api/v1/admin/dashboard/summary`
**Auth:** `dashboard.view` (cached Redis 300s)
**Description:** Dashboard summary — total orders, completed orders, revenue, active users

**Response:**
```json
{
  "totalOrders": 156,
  "completedOrders": 89,
  "totalRevenue": 1250000000,
  "activeUsers": 342
}
```

---

### 114. GET `/api/v1/admin/dashboard/orders-by-status`
**Auth:** `dashboard.view` (cached Redis 300s)
**Description:** Orders grouped by status

**Response:**
```json
{
  "data": [
    { "status": "COMPLETED", "count": 89 },
    { "status": "AWAITING_SUBMIT", "count": 12 },
    { "status": "PENDING_REVIEW", "count": 7 }
  ]
}
```

---

### 114. GET `/api/v1/admin/dashboard/revenue-timeline`
**Auth:** `dashboard.view` (cached Redis 300s)
**Description:** Daily revenue for the last N days

| Query | Type | Required | Example |
|-------|------|----------|---------|
| days | number | No | 7 |

**Response:**
```json
{
  "data": [
    { "date": "2026-07-01", "revenue": 45000000 },
    { "date": "2026-07-02", "revenue": 32000000 }
  ]
}
```

---

### 114. GET `/api/v1/admin/dashboard/monthly-growth`
**Auth:** `dashboard.view` (cached Redis 300s)
**Description:** Monthly revenue for the last N months

| Query | Type | Required | Example |
|-------|------|----------|---------|
| months | number | No | 12 |

**Response:**
```json
{
  "data": [
    { "month": "Jan", "revenue": 0 },
    { "month": "Feb", "revenue": 35000000 },
    { "month": "Mar", "revenue": 52000000 }
  ]
}
```

---

### 114. GET `/api/v1/admin/dashboard/top-products`
**Auth:** `dashboard.view` (cached Redis 300s)
**Description:** Top selling products

| Query | Type | Required | Example |
|-------|------|----------|---------|
| limit | number | No | 10 |

**Response:**
```json
{
  "data": [
    { "id": "prod-classic-band", "name": "Classic Band", "orderCount": 42 },
    { "id": "prod-diamond-halo", "name": "Diamond Halo", "orderCount": 28 }
  ]
}
```


### 90. GET `/api/v1/admin/dashboard/production-stats`
**Auth:** `dashboard.view`
**Description:** Production statistics — active jewelers, in-progress tasks, pending QA.

**Response:**
```json
{
  "total_jewelers": 6,
  "in_progress": 3,
  "pending_qa": 2
}
```

---

---

## 3.11 Transactions

Controller: `apps/api-gateway/src/modules/ecommerce/transaction/transaction.controller.ts`
Route prefix: `api/v1/transactions`

### 114. GET `/api/v1/transactions`
**Auth:** `order.read`
**Description:** List payments (paginated). JOIN users/orders, filter by status + method.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 20 |
| status | string | No | SUCCESS |
| method | string | No | PAYOS |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "transaction_id": "PAY-txn_abc123",
      "order_id": "550e8400-...",
      "order_number": "BIORING-A7B9X2",
      "customer": { "id": "550e8400-...", "name": "Nguyen Van A", "email": "a@example.com" },
      "method": "PAYOS",
      "amount": 3960000,
      "status": "SUCCESS",
      "created_at": "2026-07-10T08:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "last_page": 1
}
```

---

### 114. GET `/api/v1/transactions/overview`
**Auth:** `order.read`
**Description:** Transaction overview — gross/net/pending/refunded + % change vs last month

**Response:**
```json
{
  "gross_revenue": 125000000,
  "net_revenue": 120000000,
  "pending_cod": 5000000,
  "refunded": 2000000,
  "gross_change": 12.5,
  "net_change": 10.2,
  "pending_change": -5.0,
  "refunded_change": 0.0
}
```

---

### 115. POST `/api/v1/transactions/:id/force-paid`
**Auth:** `order.write`
**Description:** Force mark payment as PAID (admin override). Cập nhật status + paid_at, đồng bộ paid_amount/remaining_amount trên order.

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "payment": { "id": "...", "status": "PAID", "paidAt": "2026-07-15T10:00:00.000Z" }
}
```

---

### 116. POST `/api/v1/transactions/:id/sync`
**Auth:** `order.write`
**Description:** Sync payment status từ PayOS. Gọi PayOS API query transaction → update record.

**Param:** `id` (UUID v4)

**Response:**
```json
{
  "payment": { "id": "...", "status": "PAID" },
  "payosStatus": "PAID",
  "orderCode": "172000000042"
}
```

---

### 117. POST `/api/v1/transactions/:id/refund`
**Auth:** `order.write`
**Description:** Refund payment. Set status = REFUNDED, is_refund = true, adjust order amounts.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "reason": "Khách hàng yêu cầu hoàn tiền"
}
```

**Response:**
```json
{
  "payment": { "id": "...", "status": "REFUNDED" }
}
```

---

### 118. PATCH `/api/v1/transactions/:id/shipping-fee`
**Auth:** `order.write`
**Description:** Update shipping fee. Cập nhật extra_fee trên order liên kết với payment.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "amount": 50000
}
```

**Response:**
```json
{
  "success": true
}
```

---## 3.12 Customer

Controller: `apps/api-gateway/src/modules/ecommerce/customer/customer.controller.ts`
Route prefix: `api/v1/customers`

### 114. GET `/api/v1/customers`
**Auth:** `user.read`
**Description:** List customers (paginated). Registered users only, with order stats.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 20 |
| search | string | No | nguyen |
| status | string | No | active |
| sort_by | string | No | totalSpent |
| sort_order | asc/desc | No | desc |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "phone": "0901234567",
      "avatar": null,
      "status": "active",
      "total_orders": 5,
      "total_spent": 25000000,
      "last_order_date": "2026-07-10T08:00:00.000Z",
      "join_date": "2026-01-15T08:00:00.000Z",
      "location": "Hanoi"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "last_page": 1
}
```

---

### 114. GET `/api/v1/customers/lookup`
**Auth:** `order.write`
**Description:** Lookup customer by email (check Member/Walk-in/New + lịch sử)

| Query | Type | Required | Example |
|-------|------|----------|---------|
| email | string | Yes | customer@example.com |

**Response:** Raw gRPC response


### 95. GET `/api/v1/customers/guest`
**Auth:** `user.read`
**Description:** List guest (walk-in) customers (paginated). Search by name/email/phone. Includes order stats, digital assets, QR status, service tickets, warranty.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 20 |
| search | string | No | nguyen |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "name": "Nguyen Van A",
      "email": "guest@example.com",
      "phone": "0901234567",
      "status": "active",
      "total_orders": 3,
      "total_spent": 25000000,
      "last_order_date": "2026-07-10T08:00:00.000Z",
      "join_date": "2026-06-01T08:00:00.000Z",
      "digital_assets": { "has_voice": true, "has_fingerprint": false, "has_heartbeat": false },
      "qr_memory_status": "active",
      "service_tickets": [
        { "id": "tkt-1", "ticket_code": "ST-001", "service_type": "resize", "status": "resolved", "created_at": "2026-07-01T09:00:00Z" }
      ],
      "warranty": { "is_active": true, "expiry_date": "2027-06-01T00:00:00Z", "used_free_count": 1 }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "last_page": 1
}
```

---

---

## 3.13 Audit Logs

Controller: `apps/api-gateway/src/modules/ecommerce/admin/admin-audit.controller.ts`
Route prefix: `api/v1/admin/audit-logs`

### 114. GET `/api/v1/admin/audit-logs`
**Auth:** `audit.read`
**Description:** List audit log entries (paginated). Filter by resource + date range.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 50 |
| resource | string | No | order |
| from_date | string | No | 2026-06-01 |
| to_date | string | No | 2026-07-01 |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "timestamp": "2026-07-10T08:00:00.000Z",
      "actor": { "id": "550e8400-...", "name": "Admin User", "email": "admin@example.com" },
      "action": "SUBMIT",
      "resource": "order",
      "resource_id": "550e8400-...",
      "description": "SUBMIT on order 550e8400-...",
      "result": "success",
      "metadata": { "newValue": { "status": "SUBMITTED" }, "oldValue": { "status": "AWAITING_SUBMIT" } }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "last_page": 1
}
```

---

## 3.14 Devices

Controller: `apps/api-gateway/src/modules/ecommerce/device/device.controller.ts`
Route prefix: `api/v1/devices`

### 114. GET `/api/v1/devices`
**Auth:** `device.read`
**Description:** List IoT devices (paginated). Search by name/mac, filter by status.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| page | number | No | 1 |
| limit | number | No | 20 |
| status | string | No | online |
| search | string | No | ABC |

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "serial_number": "AA:BB:CC:DD:EE:FF",
      "model": "SCANNER",
      "status": "ONLINE",
      "firmware": "v2.1.0",
      "last_seen": "2026-07-10T08:00:00.000Z",
      "rssi": null,
      "uptime": null,
      "cpu": 45.5,
      "memory": 62.3
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "last_page": 1
}
```

---

### 114. GET `/api/v1/devices/:id`
**Auth:** `device.read`
**Description:** Get device by ID

**Param:** `id` (UUID v4)

**Response:** DeviceInfo object

---

### 114. POST `/api/v1/devices`
**Auth:** `device.write`
**Description:** Create new IoT device

**Request:**
```json
{
  "device_name": "Scanner-01",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "device_type": "SCANNER"
}
```

**Response:** DeviceInfo object

---

### 114. PATCH `/api/v1/devices/:id`
**Auth:** `device.write`
**Description:** Update IoT device

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "device_name": "Scanner-01",
  "status": "ONLINE"
}
```

**Response:** DeviceInfo object

---


### 114. DELETE `/api/v1/devices/:id`
**Auth:** `device.write`
**Description:** Delete IoT device (hard delete).

**Param:** `id` (UUID v4)

**Response:** `{ "success": true }`

---
## 3.15 Warranty (Service Claim)

Controller: `apps/api-gateway/src/modules/ecommerce/warranty/warranty.controller.ts`
Route prefix: `api/v1/warranty-claims`

### 114. POST `/api/v1/warranty-claims`
**Auth:** JWT (bearer)
**Description:** Create warranty claim (registered user)

**Request:**
```json
{
  "warrantyId": "550e8400-...",
  "orderId": "550e8400-...",
  "serviceType": "WARRANTY",
  "issueDescription": "Nhẫn bị trầy xước",
  "proofImages": ["https://cloudinary.com/img1.jpg"],
  "proofVideos": ["https://cloudinary.com/video1.mp4"]
}
```

**Response:** Raw gRPC response

---

### 114. POST `/api/v1/warranty-claims/lookup`
**Auth:** @Public()
**Description:** Create warranty claim by order lookup (guest — không cần login)

**Request:**
```json
{
  "orderCode": "BIORING-A7B9X2",
  "serviceType": "REPAIR",
  "issueDescription": "Nhẫn bị cong",
  "proofImages": ["https://cloudinary.com/img1.jpg"]
}
```

**Response:** Raw gRPC response

---

### 114. GET `/api/v1/warranty-claims`
**Auth:** JWT (bearer)
**Description:** Get warranty claims (paginated). Mặc định trả claims của user đang login. Admin/Manager dùng `?view=all` để xem tất cả.

| Query | Type | Required | Description |
|-------|------|----------|-------------|
| page | number | No | 1 |
| limit | number | No | 10 |
| view | string | No | `all` — admin/manager xem tất cả claims. Bỏ qua nếu user không có role ADMIN/MANAGER. |

**Response:**
```json
{
  "data": [{ "id": "...", "status": "PENDING_REVIEW", ... }],
  "meta": { "total": 1, "page": 1, "limit": 10, "lastPage": 1 }
}
```

---

### 114. GET `/api/v1/warranty-claims/:id`
**Auth:** JWT (bearer)
**Description:** Get warranty claim by ID

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response

---

### 114. PATCH `/api/v1/warranty-claims/:id/review`
**Auth:** `order.write`
**Description:** Review warranty claim (manager). `approve` → APPROVED. `quotation` → QUOTATION_SENT (yêu cầu extraFee). `reject` → REJECTED.

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "action": "approve",
  "extraFee": 500000,
  "managerNote": "Cần thay đá mới"
}
```

**Response:** Raw gRPC response

---

### 114. PATCH `/api/v1/warranty-claims/:id/confirm`
**Auth:** JWT (bearer)
**Description:** Confirm warranty claim (customer đồng ý với quotation)

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response

---

### 114. POST `/api/v1/warranty-claims/:id/payments`
**Auth:** JWT (bearer)
**Description:** Initiate claim payment (thanh toán extra fee qua PayOS)

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response

---

### 114. POST `/api/v1/warranty-claims/:id/receive`
**Auth:** `order.write`
**Description:** Receive service ticket (staff nhận sản phẩm từ khách + assign jeweler)

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "conditionNote": "Nhẫn có vết xước nhẹ",
  "receivedImages": ["https://cloudinary.com/received.jpg"],
  "jewelerId": "550e8400-..."
}
```

**Response:** Raw gRPC response

---

### 114. PATCH `/api/v1/warranty-claims/:id/complete`
**Auth:** `order.write`
**Description:** Complete service ticket (jeweler hoàn thành sửa chữa)

**Param:** `id` (UUID v4)

**Request:**
```json
{
  "resultNote": "Đã thay đá mới, đánh bóng lại",
  "costUpdate": 500000
}
```

**Response:** Raw gRPC response

---

### 114. PATCH `/api/v1/warranty-claims/:id/return`
**Auth:** `order.write`
**Description:** Return warranty claim (staff trả sản phẩm cho khách → COMPLETED)

**Param:** `id` (UUID v4)

**Response:** Raw gRPC response



## 3.16 Jeweler

Controller: `apps/api-gateway/src/modules/ecommerce/jeweler/jeweler.controller.ts`
Route prefix: `api/v1/jewelers`

### 112. GET `/api/v1/jewelers/me/performance`
**Auth:** `dashboard.view` (jeweler role)
**Description:** Get current jeweler's performance stats — completed today/shift, QA pass rate, avg hours, recent tasks.

| Query | Type | Required | Example |
|-------|------|----------|---------|
| from_date | string | No | 2026-07-01 |

**Response:**
```json
{
  "completed_today": 3,
  "completed_shift": 7,
  "qa_pass_rate": 92.0,
  "avg_hours": 6.4,
  "recent_tasks": [
    {
      "id": "550e8400-...",
      "order_code": "ORD-2026-X09",
      "completed_at": "2026-07-14T08:00:00.000Z",
      "qa_result": "passed",
      "duration_hours": 5.2
    }
  ]
}
```

---

---

# 4. Track Module

Controller: `apps/api-gateway/src/modules/track/track.controller.ts`
Route prefix: `api/v1/track`

### 113. GET `/api/v1/track/open`
**Auth:** @Public()
**Description:** Track email open (1×1 transparent GIF pixel). Ghi nhận `opened_at` + tăng `open_count` trong `email_trackings`.

| Query | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | No | Email tracking ID |

**Response:** 1×1 transparent GIF pixel (Content-Type: image/gif, Cache-Control: no-cache)

---

# 4. Business Validation Rules

## 4.1 Order State Machine

**Trạng thái:**
```
AWAITING_SUBMIT → PENDING_REVIEW → AWAITING_DEPOSIT → DEPOSIT_PAID
→ IN_PRODUCTION → PENDING_QC → AWAITING_REMAINING → READY_FOR_DELIVERY
→ SHIPPING / READY_FOR_PICKUP → DELIVERED → COMPLETED

REVISION_REQUIRED (từ PENDING_REVIEW reject)
CANCELLED (từ nhiều trạng thái)
```

**Quy tắc chuyển trạng thái:**

| Hành động | Yêu cầu | Chuyển đến |
|-----------|---------|-----------|
| submitOrder | AWAITING_SUBMIT / REVISION_REQUIRED | PENDING_REVIEW |
| reviewOrder (approve) | PENDING_REVIEW | AWAITING_DEPOSIT |
| reviewOrder (reject) | PENDING_REVIEW | REVISION_REQUIRED |
| assignJeweler | DEPOSIT_PAID | IN_PRODUCTION |
| updateProductionStatus (complete) | IN_PRODUCTION | PENDING_QC |
| qcAcceptOrder (PASS, remaining>0) | IN_PRODUCTION / PENDING_QC | AWAITING_REMAINING |
| qcAcceptOrder (PASS, remaining ≤0) | IN_PRODUCTION / PENDING_QC | READY_FOR_DELIVERY |
| qcAcceptOrder (FAIL) | IN_PRODUCTION / PENDING_QC | IN_PRODUCTION (reset task) |
| initiateDelivery (PICKUP) | READY_FOR_DELIVERY | READY_FOR_PICKUP |
| updateShipmentStatus → SHIPPING | READY_FOR_DELIVERY | SHIPPING |
| updateShipmentStatus → DELIVERED (PICKUP) | READY_FOR_PICKUP | DELIVERED |
| updateShipmentStatus → DELIVERED (DELIVERY) | SHIPPING | DELIVERED |
| cancelOrder | (9 trạng thái cho phép) | CANCELLED |

---

## 4.2 Warranty State Machine

```
PENDING_REVIEW → PENDING_RECEIVE       (review: approve)
PENDING_REVIEW → QUOTATION_SENT         (review: quotation)
PENDING_REVIEW → REJECTED               (review: reject)
QUOTATION_SENT → AWAITING_PAYMENT       (confirm: có fee)
QUOTATION_SENT → PENDING_RECEIVE        (confirm: không fee)
AWAITING_PAYMENT → ?                    (payment webhook)
PENDING_RECEIVE → IN_SERVICE            (receive)
IN_SERVICE → COMPLETED                  (return, sau khi ticket completed)
```

---

## 4.3 Order Validations

| Endpoint | Precondition | Error | Code |
|----------|-------------|-------|------|
| POST /orders | Engraving chưa có order | Engraving already has an order | 400 |
| POST /orders | Phải chọn biometrics | No biometrics selected | 400 |
| PATCH /orders/:id/submit | status ∈ [AWAITING_SUBMIT, REVISION_REQUIRED] | Order must be in AWAITING_SUBMIT or REVISION_REQUIRED to submit | 400 |
| PATCH /orders/:id/submit | Tất cả biometrics đã CAPTURED | Missing biometric data: {types} | 400 |
| PUT /orders/:id/review | status = PENDING_REVIEW | Order must be in PENDING_REVIEW status | 400 |
| PUT /orders/:id/review | Order có engraving | Order has no engraving | 400 |
| PUT /orders/:id/review | action ∈ [approve, reject] | Action must be "approve" or "reject" | 400 |
| POST /orders/:id/assign-jeweler | status = DEPOSIT_PAID | Order must be DEPOSIT_PAID to assign jeweler | 400 |
| POST /engravings/:id/biometrics | status = AWAITING_SUBMIT | Order must be in AWAITING_SUBMIT status to attach biometrics | 400 |
| POST /engravings/:id/biometrics | biometricType ∈ package | Biometric type {type} not in package | 400 |
| PUT /orders/production-tasks/:taskId/status | Task tồn tại | Production task not found | 404 |
| PUT /orders/:id/qc-accept | status ∈ [IN_PRODUCTION, PENDING_QC] | Order must be IN_PRODUCTION or PENDING_QC | 400 |
| PUT /orders/:id/qc-accept | Production task COMPLETED | Production task must be completed before QC | 400 |
| POST /orders/:id/delivery | status = READY_FOR_DELIVERY | Order must be READY_FOR_DELIVERY to initiate delivery | 400 |
| POST /orders/:id/delivery | remaining_amount = 0 | Order still has remaining payment | 400 |
| POST /orders/:id/delivery | Chưa có shipment in progress | Shipment already in progress | 400 |
| PUT /orders/:id/shipment/status | deliveryMethod = DELIVERY (nếu SHIPPING) | Only DELIVERY shipments can be set to SHIPPING | 400 |
| PUT /orders/:id/shipment/status | status = READY_FOR_DELIVERY (nếu SHIPPING) | Order must be READY_FOR_DELIVERY to start shipping | 400 |
| PUT /orders/:id/shipment/status | status = READY_FOR_PICKUP (nếu PICKUP → DELIVERED) | Order must be READY_FOR_PICKUP to confirm delivery | 400 |
| PUT /orders/:id/shipment/status | status = SHIPPING (nếu DELIVERY → DELIVERED) | Order must be SHIPPING to confirm delivery | 400 |
| PUT /orders/:id/shipment/status | status ∈ [SHIPPING, DELIVERED] | Status must be SHIPPING or DELIVERED | 400 |
| POST /orders/:id/payments/manual | paymentPhase ∈ [DEPOSIT_1, DEPOSIT_2, REMAINING, FULL] | Invalid paymentPhase | 400 |
| POST /orders/:id/payments | paymentPhase = FULL → chỉ guest | FULL payment is only available for walk-in guests | 400 |
| POST /orders/:id/payments | phase = DEPOSIT_2 → chưa paid hết | Deposit already paid | 400 |
| POST /orders/:id/payments | phase = REMAINING → còn nợ | No remaining amount to pay | 400 |
| POST /orders/:id/payments/cancel | Có PENDING payment | No pending payment found to cancel | 400 |
| POST /transactions/:id/refund | Chưa REFUNDED | Payment already refunded | 400 |
| PATCH /orders/:id/cancel | status ∈ cancellable list | Order cannot be cancelled in status X | 400 |

---

## 4.4 Warranty Validations

| Endpoint | Precondition | Error | Code |
|----------|-------------|-------|------|
| PATCH /warranty-claims/:id/review | status = PENDING_REVIEW | Claim must be PENDING_REVIEW | 400 |
| PATCH /warranty-claims/:id/review | action = quotation → extraFee > 0 | extraFee required for quotation | 400 |
| PATCH /warranty-claims/:id/review | action ∈ [approve, quotation, reject] | action must be approve, quotation, or reject | 400 |
| PATCH /warranty-claims/:id/confirm | status = QUOTATION_SENT | Claim must be QUOTATION_SENT | 400 |
| PATCH /warranty-claims/:id/confirm | Chủ claim | Not your claim | 403 |
| POST /warranty-claims/:id/payments | status = AWAITING_PAYMENT | Claim not awaiting payment | 400 |
| POST /warranty-claims/:id/payments | extraFee > 0 | No extra fee to pay | 400 |
| POST /warranty-claims/:id/receive | status ∈ [PENDING_RECEIVE, APPROVED] | Claim must be PENDING_RECEIVE or APPROVED | 400 |
| POST /warranty-claims/:id/receive | Jeweler tồn tại | Jeweler not found | 404 |
| PATCH /warranty-claims/:id/complete | status = IN_SERVICE | Claim must be IN_SERVICE | 400 |
| PATCH /warranty-claims/:id/complete | Có ticket RECEIVED | No active service ticket | 400 |
| PATCH /warranty-claims/:id/return | status = IN_SERVICE | Claim must be IN_SERVICE | 400 |
| PATCH /warranty-claims/:id/return | Ticket đã COMPLETED | Service ticket not completed yet | 400 |

---

## 4.5 Guest Validations

| Endpoint | Precondition | Error | Code |
|----------|-------------|-------|------|
| POST /guest/orders | Tất cả biometrics đã CAPTURED | Missing biometric data: {types} | 400 |
| PATCH /guest-tablet/orders/:orderId/submit | status ∈ [AWAITING_SUBMIT, REVISION_REQUIRED] | Order must be AWAITING_SUBMIT or REVISION_REQUIRED to submit | 400 |
| PATCH /guest-tablet/orders/:orderId/submit | Biometrics ready | Missing biometric data | 400 |
| PUT /guest-tablet/orders/:orderId/shipping-info | method ∈ [PICKUP, DELIVERY] | deliveryMethod must be PICKUP or DELIVERY | 400 |
| PUT /guest-tablet/orders/:orderId/shipping-info | Chưa có shipment | Shipping info already set | 400 |

---

## 4.6 Engraving Validations

| Endpoint | Precondition | Error | Code |
|----------|-------------|-------|------|
| PATCH /engravings/versions/:versionId/config | Chưa có order→cho phép đổi package | Cannot change package after order creation | 400 |
| PATCH /engravings/versions/:versionId/config | status ∈ editable list | Cannot edit after order has been submitted | 400 |
| POST /engravings/:id/cancel | Chưa có order | Cannot cancel — already has order | 400 |
| POST /engravings/:id/cancel | Chưa cancelled | Already cancelled | 400 |
| PUT /qr-memories/:engravingId | status = REVISION_REQUIRED (nếu có order) | Cannot edit memory card after order creation | 400 |

---

# Tổng kết

| Module | Controller | Endpoints |
|--------|-----------|-----------|
| Identity | Auth | 5 |
| Identity | Users | 7 |
| Identity | RBAC | 7 |
| Biometric | Biometric | 2 |
| Ecommerce | Catalog | 7 |
| Ecommerce | Design | 5 |
| Ecommerce | Engraving | 6 |
| Ecommerce | Order | 24 |
| Ecommerce | QR Memory | 3 |
| Ecommerce | Card Theme | 5 |
| Ecommerce | Guest | 2 |
| Ecommerce | Guest Tablet | 7 |
| Ecommerce | Capture Session | 4 |
| Ecommerce | Admin Dashboard | 5 |
| Ecommerce | Transactions | 6 |
| Ecommerce | Customer | 3 |
| Ecommerce | Audit Logs | 1 |
| Ecommerce | Devices | 5 |
| Ecommerce | Warranty | 10 |
| Ecommerce | Jeweler | 1 |
| Track | Track | 1 |
| **Total** | **21 controllers** | **118 endpoints** |
