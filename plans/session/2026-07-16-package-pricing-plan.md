# Package Pricing — Kế hoạch

## Vấn đề

Package type (SW, FP, HB, SW_FP...) hiện tại **không ảnh hưởng đến giá**.
Công thức hiện tại: `totalPrice = product.base_price × 1.1` (base + 10% service fee).

## Giải pháp

Thêm model `packages` làm nguồn truth duy nhất cho cả `biometric_types` và `price`.

### 1. Database Model

```prisma
model packages {
  id              String   @id @default(uuid()) @db.Uuid
  slug            String   @unique @db.VarChar(50)
  name            String   @db.VarChar(255)
  description     String?
  price           Decimal  @db.Decimal(18, 2)
  biometric_types String[]
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
}
```

`biometric_types` là mảng string xác định gói gồm những biometric nào (vd: `["SW","FP"]`).

### 2. Proto — ecommerce.proto

```protobuf
message Package {
  string id = 1;
  string slug = 2;
  string name = 3;
  string description = 4;
  double price = 5;
  repeated string biometricTypes = 6;
}

message ListPackagesResponse {
  repeated Package packages = 1;
}

message AssignPackageRequest {
  string engravingId = 1;
  string packageSlug = 2;
}

rpc ListPackages (Empty) returns (ListPackagesResponse);
rpc AssignPackage (AssignPackageRequest) returns (EngravingResponse);
```

### 3. Pricing Logic — Thay đổi

Công thức mới:

```
totalPrice = base_price + package_price + (base_price + package_price) × 10%
```

#### 3a. `order.service.ts:calculatePrice()`

```
Before: nhận engraving.product_id
After:  nhận engraving.product_id + package_price (mới)
        subtotal = base_price
        packagePrice = package_price (tham số mới)
        serviceFee = (subtotal + packagePrice) × 0.1
        totalPrice = subtotal + packagePrice + serviceFee
```

#### 3b. `order.service.ts:createOrder()`

```
Before: nhận selectedBiometrics → derive package_type
After:  nhận packageSlug → lookup packages table
        → set package_type = package.slug
        → selected_biometrics = package.biometric_types (nguồn truth)
        → package_price = package.price → truyền vào calculatePrice()
```

#### 3c. `guest.service.ts:createGuestOrder()`

Tương tự createOrder: lookup package → set biometric_types + price.

#### 3d. `design.service.ts:createDesignDraft()`

```
Before: nhận selectedBiometrics[] → tính estimatedPrice
After:  nhận packageSlug → lookup package
        → biometric_types = package.biometric_types
        → estimatedPrice = product.base_price + package.price + gemstone_price
```

### 4. New Files

| File | Nội dung |
|------|----------|
| `libs/prisma/prisma/migrations/...` | Migration tạo table packages |
| `apps/ecommerce-service/src/package/package.module.ts` | Module |
| `apps/ecommerce-service/src/package/package.service.ts` | `list()`, `assignToEngraving()` |
| `apps/ecommerce-service/src/package/package.controller.ts` | `@GrpcMethod` handlers |
| `apps/api-gateway/src/modules/ecommerce/package/package.controller.ts` | `GET /api/v1/packages`, `POST /api/v1/packages/:slug/assign` |
| `apps/api-gateway/src/modules/ecommerce/package/package.swagger.ts` | Swagger |
| `libs/common/src/dtos/package/package.dto.ts` | DTOs |
| `scripts/seed-packages.ts` | Seed 7 packages + giá |

### 5. Seed Data

| Slug | Name | Biometric Types | Price (VD) |
|------|------|----------------|------------|
| SW | Signature Waveform | `["SW"]` | 0 |
| FP | Fingerprint | `["FP"]` | ? |
| HB | Heartbeat | `["HB"]` | ? |
| SW_FP | SW + Fingerprint | `["SW","FP"]` | ? |
| SW_HB | SW + Heartbeat | `["SW","HB"]` | ? |
| FP_HB | Fingerprint + Heartbeat | `["FP","HB"]` | ? |
| ALL | Full Package | `["SW","FP","HB"]` | ? |

### 6. Validation Rules

| Rule | Ở đâu |
|------|-------|
| Package phải tồn tại + active | Service layer |
| `biometric_types` không được empty | Seed data |
| Đã có order → không đổi package | Business logic |
| Guest/Walk-in → package cố định lúc tạo order | Guest flow |
| Design draft → có thể đổi package trước khi tạo đơn | Design flow |

### 7. 5 Điểm Chạm

| # | Điểm chạm | File | Thay đổi |
|---|-----------|------|----------|
| 1 | Model `packages` | schema.prisma | New + migration |
| 2 | Package service + controller | 6 files mới | CRUD + assign |
| 3 | Design draft | `design.service.ts` | Nhận `packageSlug`, lookup price + biometric |
| 4 | Order pricing | `order.service.ts` + `guest.service.ts` | `calculatePrice()` nhận thêm `packagePrice` |
| 5 | Order create | `order.service.ts` + `guest.service.ts` | Lookup package → set `selected_biometrics` |

### 8. Effort

~11 files BE, ~2h.
