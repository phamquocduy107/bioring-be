# MF-01: Omnichannel Design Exploration — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Cho phép khách hàng truy cập Web (không cần đăng nhập), duyệt catalog mẫu nhẫn, thực hiện **Simple Design** (chọn đá, vật liệu, size) + **chọn vị trí khắc FP/SW** (dùng placeholder image), lưu và nhận **Design Code** để tiếp tục trên Mobile App. Mỗi guest được định danh bằng `guest_session_id` trong cookie.

### Actors
- **Guest (Web)**: Không auth, được gán `guest_session_id` (cookie), duyệt, thiết kế, chọn vị trí khắc, nhận Design Code
- **System**: Sinh Design Code + `guest_session_id`, quản lý catalog, cung cấp placeholder images
- **AI**: *(để sau, không implement trong phase này)*

### Luồng chính
```
Web:
  [Tạo guest_session_id cookie] → Browse Catalog → Select Product
  → Simple Design → Chọn vị trí khắc FP/SW (placeholder) → Save → Design Code

Mobile (sau này):
  Enter Design Code → System set user_id, clear guest_session_id → Load Design (cả pos + customization_config)
  → Package Selection (MF-02/03/04) → tạo engraving_versions từ design_drafts (copy nguyên customization_config)

### Lưu ý về HB và Engraving Type
- **Heart Beat (HB)** KHÔNG được khắc lên nhẫn.
- HB chỉ được hiển thị trên memory card (QR code).
- Trong MF-01 không có bước chọn vị trí cho HB.
- **Quan trọng:** Dù người dùng chọn nhiều loại có thể khắc (VD: SW+FP, ALL), họ **chỉ được chọn 1 loại duy nhất (FP hoặc SW) để khắc lên nhẫn**. Loại còn lại vẫn được thu thập và hiển thị trong memory card nhưng không khắc vật lý lên nhẫn.
- Trường `engravedType` trong `customization_config` xác định loại nào được khắc (giá trị: `"fp"` | `"sw"` | `null`).

### Request lifecycle
```
Browser ──HTTP──> API Gateway (:3000) ──gRPC──> Ecommerce Service (:50051) ──Prisma──> PostgreSQL
```

---

## 2. File-by-file changes

### 2.1 New files

| # | File path | Mục đích |
|---|-----------|----------|
| 1 | `libs/common/src/enums/design-source.enum.ts` | Enum DesignSource |
| 2 | `libs/common/src/enums/design-status.enum.ts` | Enum DesignDraftStatus |
| 3 | `apps/ecommerce-service/src/modules/catalog/catalog.module.ts` | Module catalog |
| 4 | `apps/ecommerce-service/src/modules/catalog/catalog.controller.ts` | gRPC controller catalog |
| 5 | `apps/ecommerce-service/src/modules/catalog/catalog.service.ts` | Business logic catalog |
| 6 | `apps/ecommerce-service/src/modules/design/design.module.ts` | Module design |
| 7 | `apps/ecommerce-service/src/modules/design/design.controller.ts` | gRPC controller design |
| 8 | `apps/ecommerce-service/src/modules/design/design.service.ts` | Business logic design |
| 9 | `apps/ecommerce-service/src/modules/design/dto/` | DTOs cho design |
| 10 | `apps/ecommerce-service/src/modules/design/design-code.util.ts` | Utility sinh Design Code |
| 11 | `prisma/seed.ts` | Seed data catalog |
| 12 | `libs/common/src/dtos/catalog/` | DTOs cho catalog response |
| 13 | `libs/common/src/dtos/design/` | DTOs cho design request/response |

### 2.2 Modified files

| # | File path | Thay đổi |
|---|-----------|----------|
| 1 | `libs/common/src/enums/index.ts` | Export enums mới |
| 2 | `libs/common/src/dtos/index.ts` | Export DTOs mới |
| 3 | `libs/common/src/index.ts` | (nếu cần) |
| 4 | `proto/ecommerce.proto` | Thêm messages + RPCs |
| 5 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import CatalogModule, DesignModule, PrismaModule |
| 6 | `apps/ecommerce-service/src/main.ts` | (không đổi, giữ nguyên) |
| 7 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | (không đổi ở phase này) |
| 8 | `apps/api-gateway/src/modules/ecommerce/ecommerce.controller.ts` | Thêm HTTP routes mới |
| 9 | `apps/api-gateway/src/modules/ecommerce/ecommerce.service.ts` | Thêm methods proxy gRPC |

---

## 3. Implementation Steps (chi tiết)

### Step 1: Enums

**File: `libs/common/src/enums/design-source.enum.ts`**

```typescript
export enum DesignSource {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  STAFF_TABLET = 'STAFF_TABLET',
}
```

**File: `libs/common/src/enums/design-status.enum.ts`**

```typescript
export enum DesignDraftStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED', // đã được tạo order từ draft này
}
```

**Update: `libs/common/src/enums/index.ts`** — thêm 2 exports.

---

### Step 2: Proto

**File: `proto/ecommerce.proto`**

Thêm vào file hiện tại:

```protobuf
// === Catalog ===
service EcommerceService {
  // ... keep existing Ping ...

  // Catalog
  rpc GetProducts (GetProductsRequest) returns (GetProductsResponse);
  rpc GetProductById (GetProductByIdRequest) returns (GetProductByIdResponse);
  rpc GetMaterials (Empty) returns (GetMaterialsResponse);
  rpc GetGemstones (Empty) returns (GetGemstonesResponse);

  // Design Drafts
  rpc CreateDesignDraft (CreateDesignDraftRequest) returns (CreateDesignDraftResponse);
  rpc GetDesignDraftByCode (GetDesignDraftByCodeRequest) returns (GetDesignDraftByCodeResponse);
  rpc GetMyDrafts (GetMyDraftsRequest) returns (GetMyDraftsResponse);
  rpc UpdateDesignDraft (UpdateDesignDraftRequest) returns (UpdateDesignDraftResponse);
}

// ===== Messages =====

// --- Generic ---
message Empty {}

// --- Product ---
message Product {
  string id = 1;
  string name = 2;
  string description = 3;
  string baseMaterialId = 4;
  double basePrice = 5;
  string thumbnailUrl = 6;
  string model3dUrl = 7;
  repeated Material availableMaterials = 8;
  repeated Gemstone availableGemstones = 9;
}

message GetProductsRequest {
  int32 page = 1;
  int32 limit = 2;
  string style = 3;         // optional filter
  string materialId = 4;    // optional filter
  double maxPrice = 5;      // optional filter
}

message GetProductsResponse {
  repeated Product products = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
}

message GetProductByIdRequest {
  string id = 1;
}

message GetProductByIdResponse {
  Product product = 1;
}

// --- Material ---
message Material {
  string id = 1;
  string name = 2;
  string purity = 3;
  string color = 4;
  double currentPricePerGram = 5;
}

message GetMaterialsResponse {
  repeated Material materials = 1;
}

// --- Gemstone ---
message Gemstone {
  string id = 1;
  string type = 2;
  double carat = 3;
  string cut = 4;
  string color = 5;
  string clarity = 6;
  string certificationCode = 7;
  double price = 8;
  bool isAvailable = 9;
}

message GetGemstonesResponse {
  repeated Gemstone gemstones = 1;
}

// --- Design Draft ---
message DesignDraft {
  string id = 1;
  string userId = 2;
  string productId = 3;
  string designCode = 4;
  string designSource = 5;
  string ringStyle = 6;
  string ringShape = 7;
  string ringSize = 8;
  string selectedMaterialId = 9;
  string selectedGemstoneId = 10;
  string customizationConfig = 11; // JSON string — chứa engraving positions (xem cấu trúc bên dưới)
  double estimatedPrice = 12;
  string status = 13;
  string createdAt = 14;
  string updatedAt = 15;
  // Expanded relations
  Product product = 16;
  Material selectedMaterial = 17;
  Gemstone selectedGemstone = 18;
}

message GetMyDraftsRequest {
  string guestSessionId = 1;  // lấy từ cookie, gateway tự gắn vào
}

message GetMyDraftsResponse {
  repeated DesignDraft drafts = 1;
}

message CreateDesignDraftRequest {
  // Không cần auth, web cho phép tạo draft ẩn danh
  string productId = 1;
  string ringStyle = 2;
  string ringShape = 3;
  string ringSize = 4;
  string selectedMaterialId = 5;
  string selectedGemstoneId = 6;
  string customizationConfig = 7; // JSON string — engraving positions (xem cấu trúc chuẩn bên dưới)
  string guestSessionId = 8;      // từ cookie, gateway tự gắn vào
}

message CreateDesignDraftResponse {
  DesignDraft draft = 1;
  string designCode = 2; // tách riêng cho tiện
}

message GetDesignDraftByCodeRequest {
  string designCode = 1;
}

message GetDesignDraftByCodeResponse {
  DesignDraft draft = 1;
}

message UpdateDesignDraftRequest {
  string id = 1;
  string ringStyle = 2;
  string ringShape = 3;
  string ringSize = 4;
  string selectedMaterialId = 5;
  string selectedGemstoneId = 6;
  string customizationConfig = 7; // JSON string — engraving positions
}

message UpdateDesignDraftResponse {
  DesignDraft draft = 1;
}
```

---

### Step 3: Ecommerce Service — Catalog Module

Tạo thư mục `apps/ecommerce-service/src/modules/catalog/`

#### `catalog.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
```

#### `catalog.controller.ts`
```typescript
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @GrpcMethod('EcommerceService', 'GetProducts')
  async getProducts(data: GetProductsRequest) {
    return this.catalogService.getProducts(data);
  }

  @GrpcMethod('EcommerceService', 'GetProductById')
  async getProductById(data: { id: string }) {
    return this.catalogService.getProductById(data.id);
  }

  @GrpcMethod('EcommerceService', 'GetMaterials')
  async getMaterials() {
    return this.catalogService.getMaterials();
  }

  @GrpcMethod('EcommerceService', 'GetGemstones')
  async getGemstones() {
    return this.catalogService.getGemstones();
  }
}
```

#### `catalog.service.ts`
Business logic:
- `getProducts(page, limit, filters)` — query `products` với `is_active = true`, include `materials` + `product_gemstones.gemstones`, paginate
- `getProductById(id)` — query product + include materials + gemstones
- `getMaterials()` — query `materials`
- `getGemstones()` — query `gemstones` with `is_available = true`

---

### Step 4: Ecommerce Service — Design Module

Tạo thư mục `apps/ecommerce-service/src/modules/design/`

#### `design-code.util.ts`
```typescript
import { randomBytes } from 'node:crypto';

export function generateDesignCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tránh nhầm 0/O, 1/I
  const random = randomBytes(6);
  let code = 'RS-';
  for (let i = 0; i < 6; i++) {
    code += chars[random[i] % chars.length];
  }
  return code; // VD: RS-A7B9X2
}
```

#### `design.service.ts`
Business logic:
- `createDesignDraft(data, guestSessionId?)` — generate design_code, tính estimated_price, lưu guest_session_id (nếu có), create DB, trả về draft + code
- `getDesignDraftByCode(code)` — tìm theo design_code, include product + material + gemstone
- `getMyDrafts(guestSessionId)` — liệt kê drafts theo guest_session_id
- `updateDesignDraft(id, data, guestSessionId?)` — kiểm tra ownership (guest_session_id), update + recalculate price
- `claimDesignDraft(code, userId)` — khi user nhập code trên mobile: set user_id, clear guest_session_id

**Price calculation logic (tạm thời):**
```
estimated_price = product.base_price
                + (material.current_price_per_gram * 5g)  // 5g mặc định
                + (gemstone?.price ?? 0)
```

---

### Step 5: Gateway — HTTP routes

#### `ecommerce.service.ts` (gateway)
Thêm methods proxy:
- `getProducts(filters)` → gRPC `GetProducts`
- `getProductById(id)` → gRPC `GetProductById`
- `getMaterials()` → gRPC `GetMaterials`
- `getGemstones()` → gRPC `GetGemstones`
- `createDesignDraft(data)` → gRPC `CreateDesignDraft`
- `getDesignDraftByCode(code)` → gRPC `GetDesignDraftByCode`
- `updateDesignDraft(id, data)` → gRPC `UpdateDesignDraft`

#### `ecommerce.controller.ts` (gateway)
Thêm routes:

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `GET` | `/api/v1/products` | Public | `getProducts` |
| `GET` | `/api/v1/products/:id` | Public | `getProductById` |
| `GET` | `/api/v1/materials` | Public | `getMaterials` |
| `GET` | `/api/v1/gemstones` | Public | `getGemstones` |
| `POST` | `/api/v1/design/drafts` | Public | `createDesignDraft` |
| `GET` | `/api/v1/design/drafts/by-code/:code` | Public | `getDesignDraftByCode` |
| `PUT` | `/api/v1/design/drafts/:id` | Public | `updateDesignDraft` |

Tất cả đều public (không auth), nhưng cần dùng `@Public()` decorator + rate-limiting nếu cần.

**Bắt buộc:** Mỗi route phải có Swagger decorators đầy đủ:
- `@ApiOperation()` — mô tả ngắn gọn
- `@ApiOkResponse()` / `@ApiCreatedResponse()` — kiểu response
- `@ApiParam()` cho `:id`, `:code` params
- `@ApiQuery()` nếu có query params (page, limit, filter)
- `@ApiCookieAuth()` nếu cần guest_session_id cookie

---



### Step 6: Seed data

**File: `prisma/seed.ts`**

Seed:
- 5-10 mẫu products (tên, mô tả, base_price, thumbnail_url, model_3d_url)
- 3-5 materials (Vàng 14K, Vàng 18K, Vàng trắng, Bạc, Platinum)
- 5-8 gemstones (Kim cương, Sapphire, Ruby, Emerald, Moissanite...)

> **⚠️ Lưu ý UUID:** Toàn bộ ID trong seed data (products, materials, gemstones) PHẢI là UUID RFC 4122 compliant — version nibble = 4, variant nibble ∈ {8,9,a,b}. Nếu dùng UUID không chuẩn (vd version != 4), `@IsUUID('4')` ở DTO và `ParseUUIDPipe({ version: '4' })` ở route params sẽ reject.

---

## 4. Data model mapping

### `design_drafts` — field mapping khi tạo từ Web

| Field | Giá trị | Ghi chú |
|-------|---------|---------|
| `id` | Auto UUID | |
| `user_id` | `null` | Sẽ set khi user nhập code trên Mobile |
| `guest_session_id` | Từ cookie | Gateway tự extract từ `req.cookies.guest_session_id`, gắn vào gRPC request |
| `product_id` | Từ request | |
| `design_code` | `RS-XXXXXX` | Sinh tự động, unique |
| `design_source` | `"WEB"` | Enum DesignSource.WEB |
| `ring_style`, `ring_shape`, `ring_size` | Từ request | |
| `selected_material_id` | Từ request | |
| `selected_gemstone_id` | Từ request | |
| `customization_config` | JSON | Vị trí khắc FP/SW (xem cấu trúc bên dưới) |
| `estimated_price` | Tính tự động | base + material + gemstone |
| `expires_at` | `now + 30 days` | |
| `status` | `"DRAFT"` | Enum DesignDraftStatus.DRAFT |

### `customization_config` — Cấu trúc JSON chuẩn (dùng chung cho `design_drafts` và `engraving_versions`)

Cấu trúc này được **copy nguyên vẹn** từ `design_drafts` → `engraving_versions` khi sync Design Code xuống mobile. Các field `imageUrl`, `audioUrl`, `selectedSegment` sẽ được cập nhật dần khi user thu thập dữ liệu thật (thu âm / IoT). Không có tiền tố "mock/placeholder" — tên field là chính thức.

```jsonc
{
  "engravedType": "fp",          // "fp" | "sw" | null — loại DUY NHẤT được khắc lên nhẫn
  "engravingPositions": {
    "fp": {
      "enabled": false,          // true nếu FP có trong package
      "status": "pending",       // pending | captured | processed
      "imageUrl": "https://cdn.bioring.com/placeholder/fingerprint-default.svg",
      "position": {
        "x": 0.5,                // toạ độ X (0-1, % chiều rộng nhẫn)
        "y": 0.3,                // toạ độ Y (0-1, % chiều cao nhẫn)
        "rotation": 45,          // góc xoay (độ)
        "scale": 1.0             // tỷ lệ (0.5-2.0)
      }
    },
    "sw": {
      "enabled": false,          // true nếu SW có trong package
      "status": "pending",       // pending | captured | processed
      "imageUrl": "https://cdn.bioring.com/placeholder/waveform-default.svg",
      "audioUrl": null,          // URL file gốc sau khi thu âm (MF-02)
      "selectedSegment": {       // đoạn 3s chọn để khắc
        "startMs": 2000,
        "endMs": 5000
      },
      "position": {
        "startAngle": 90,        // góc bắt đầu trên vòng nhẫn (độ)
        "width": 180,            // độ rộng dải sóng (độ)
        "height": 3              // chiều cao dải sóng (mm)
      }
    }
  },
  "hb": {                        // HB chỉ cho memory card, không có position
    "enabled": false,
    "status": "pending",
    "imageUrl": null
  },
  "ringPreviewUrl": "https://cdn.bioring.com/placeholder/ring-default.png"
}
```

**Quy ước:**
| Field | Ý nghĩa | Ghi chú |
|-------|---------|---------|
| `engravedType` | Loại duy nhất khắc lên nhẫn | Nếu FP+SW, user chọn 1; loại kia vẫn `enabled=true` nhưng không phải `engravedType` |
| `*.enabled` | Có trong package hay không | Có thể nhiều hơn 1 |
| `*.status` | Trạng thái dữ liệu | `pending` (chưa thu) → `captured` (đã thu IoT/thu âm) → `processed` (đã xử lý) |
| `*.imageUrl` | URL hình ảnh | Ban đầu trỏ placeholder, sau replace bằng URL thật (cùng field, không tạo field mới) |
| `hb` | HB chỉ trong memory card | Không có `position` vì không khắc lên nhẫn |

**Sync mechanism:**
```
design_drafts.customization_config  ──(copy nguyên)──>  engraving_versions.customization_config
                                                              │
                                        ┌─────────────────────┼─────────────────────┐
                                        │ (MF-02 thu âm)      │ (MF-03 IoT store)   │ (MF-05 memory card)
                                        ▼                     ▼                     ▼
                                   sw.imageUrl = real     fp.imageUrl = real      hb.imageUrl = real
                                   sw.audioUrl = file     fp.status = captured    hb.status = captured
                                   sw.status = captured
```

---

## 5. Placeholder images

Hệ thống cần cung cấp sẵn các URL placeholder cho preview trên web:

| Placeholder | Mục đích |
|-------------|----------|
| `https://cdn.bioring.com/placeholder/ring-default.png` | Ảnh nhẫn mặc định để kéo thả vị trí |
| `https://cdn.bioring.com/placeholder/fingerprint-default.svg` | Hình vân tay mẫu |
| `https://cdn.bioring.com/placeholder/waveform-default.svg` | Dải sóng âm mẫu |

Các URL này sẽ được replace bằng URL thật (cùng field `imageUrl`) khi dữ liệu biometric được thu thập. Có thể dùng static files hoặc Cloudinary assets.

---

## 6. Acceptance criteria

| # | Tiêu chí | Verify bằng |
|---|----------|-------------|
| 1 | Guest vào web, GET `/products` trả về danh sách nhẫn | curl / Postman |
| 2 | GET `/products/:id` trả về chi tiết kèm materials + gemstones | curl / Postman |
| 3 | GET `/materials`, `/gemstones` trả về dữ liệu | curl / Postman |
| 4 | POST `/design/drafts` (không auth) tạo thành công, trả về Design Code | curl, check DB |
| 5 | Design Code format `RS-XXXXXX` (6 ký tự, không có 0/O/1/I) | code review |
| 6 | GET `/design/drafts/by-code/RS-A7B9X2` trả về draft đúng | curl |
| 7 | PUT `/design/drafts/:id` cập nhật thành công | curl, check DB |
| 8 | `estimated_price` được tính đúng khi tạo và cập nhật | curl |
| 9 | POST `/design/drafts` với `customization_config` chứa engraving positions → lưu đúng JSON | curl, check DB |
| 10 | PUT `/design/drafts/:id` cập nhật position → DB thay đổi | curl, check DB |
| 11 | `customization_config` trả về qua GET có đúng cấu trúc (fp.position.x/y/rotation/scale, sw.position.startAngle/width/height) | curl |
| 12 | Chạy `npm run test` (jest) không fail | CLI |
| 13 | Chạy `npm run lint` không lỗi | CLI |

---

## 8. Testing strategy

### Unit tests
- **CatalogService**: mock Prisma, test getProducts pagination + filtering
- **DesignService**: mock Prisma, test create + getByCode + update
- **DesignCodeUtil**: test format + uniqueness (mock randomBytes)

### E2E tests (sau)
- Tạo design draft → GET by code → verify response

---

## 7. Out of scope (phase này)

- ❌ AI Chat suggest designs
- ❌ User auth trên Web
- ✅ Guest session tracking — **đã implement** (guest_session_id cookie)
- ❌ Package Selection (MF-02)
- ❌ Advanced Design (thu âm, waveform thật, fingerprint thật, chọn engraving type)
- ❌ Memory card design (HB config, recipient email) — thuộc MF-02+
- ❌ IoT capture sessions
- ❌ File upload / Cloudinary thật (dùng mock URLs tạm)
- ❌ HB configuration (chỉ trong memory card, MF-02+)
- ❌ Rate limiting (sẽ thêm sau nếu cần)
