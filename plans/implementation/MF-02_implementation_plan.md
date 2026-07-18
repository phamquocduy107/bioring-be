# MF-02: Online Custom Ring Order — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Cho phép Customer đã đăng nhập (Mobile App) hoàn thiện đơn hàng online (Package SW — Sound Wave) qua 3 màn hình:
1. **Simple Design + Position** — kế thừa từ Design Code (MF-01) hoặc thiết kế mới
2. **Package Selection** — chọn SW → capture route = ONLINE
3. **Advanced Design** — thu âm giọng nói (5-15s) → hiển thị waveform → chọn đoạn 3s → slider vị trí khắc

Sau đó:
- Design Memory Card (recipient email optional)
- Gửi Manager duyệt (Final Design Review)
- Thanh toán **Deposit** qua PayOS
- Jeweler sản xuất
- Thanh toán **Remaining Payment**

### Actors
- **Customer (Mobile)**: Login (Google OAuth), nhập Design Code hoặc thiết kế mới, chọn package, thu âm, chọn vị trí, tạo order, thanh toán
- **Manager (Web Dashboard)**: Review design, Approve/Reject, assign Jeweler
- **Jeweler (Web Dashboard)**: Nhận task, cập nhật tiến độ sản xuất
- **System**: Sinh order code, quản lý trạng thái, gọi PayOS API tạo link thanh toán
- **Audio Processing Service (Python)**: Nhận audio URL → xử lý bằng librosa → sinh waveform SVG → upload Cloudinary → trả về URL
- **PayOS**: Cổng thanh toán, xử lý deposit/remaining, gửi webhook callback

### Luồng chính
```
Mobile App:
  Login → Enter Design Code (ClaimDesignDraft → tạo Engraving + EngravingVersion)
  → Screen 1: Simple Design → PATCH config (engravingPositions)
  → Screen 2: SW Package → PATCH config (selectedBiometrics)
  → POST /orders { engravingId } → AWAITING_SUBMIT
  → Screen 3: Record Voice → Upload Audio → PATCH config (engravingPositions.sw)
       → Server gọi Python → waveform SVG → tạo engraving_biometrics row
  → Choose 3s → Adjust Position → PATCH config (chỉ position)
  → Design Memory Card → PUT /api/v1/qr-memories/:engravingId
  → Submit → PATCH /orders/:id/submit

  --- Bất kỳ lúc nào user cũng có thể out ra, data đã save ở step trước đó ---

Backend:
  Claim + Create Engraving (sync code) ← tạo Engraving, order_id = null
  → Incremental saves vào engraving_versions.customization_config
  → Create Order (PENDING_REVIEW) — chỉ nhận engravingIds, KHÔNG gửi config
  → Manager Review
  → Customer Pay Deposit (PayOS) → DEPOSIT_PAID
  → Assign Jeweler → IN_PRODUCTION
  → Jeweler Complete → AWAITING_REMAINING
  → Customer Pay Remaining → COMPLETED
```

### Request lifecycle
```
Mobile App ──HTTP──> API Gateway (:3000) ──gRPC──> Ecommerce Service (:50051) ──Prisma──> PostgreSQL
                                                              │
                                                     ┌─────────┴──────────┐
                                                     │  PayOS (REST API)  │
                                                     │  Webhook callback  │
                                                     └────────────────────┘

Audio Upload & Processing:
                      ┌──────────────────┐
  Mobile ──HTTP──>    │  Cloudinary       │  ← upload audio file trực tiếp từ mobile
                      │  (file storage)   │
                      └──────┬───────────┘
                             │ audioUrl
                             ▼
                      ┌──────────────────┐
                      │  Python Service   │  ← Ecommerce Service gọi HTTP
                      │  (:5051)          │     POST /process-audio
                      │  librosa + svg    │     { audioUrl, engravingVersionId }
                      └──────┬───────────┘
                             │ waveformUrl (SVG)
                             ▼
                      ┌──────────────────┐
                      │  Cloudinary       │  ← Python upload SVG lên Cloudinary
                      └──────────────────┘
```

### Auth pattern (kế thừa từ MF-01)
| Decorator | Behavior |
|-----------|----------|
| `@Public()` | Bỏ qua AuthGuard + PermissionRbacGuard — dùng cho PayOS webhook |
| Không decorator | AuthGuard verify JWT (Bearer), PermissionRbacGuard pass through — dùng cho customer endpoints |
| `@Permissions(Permission.Xxx)` | Auth + check permission — dùng cho manager endpoints |

---

## 2. File-by-file changes

### 2.1 New files

| # | File path | Mục đích |
|---|-----------|----------|
| 1 | `libs/common/src/enums/order-status.enum.ts` | Enum OrderStatus |
| 2 | `libs/common/src/enums/biometric-type.enum.ts` | Enum BiometricType — `SW`, `FP`, `HB` (giá trị trong `selectedBiometrics` array) |
| 3 | `libs/common/src/enums/capture-route.enum.ts` | Enum CaptureRoute |
| 4 | `libs/common/src/enums/payment-phase.enum.ts` | Enum PaymentPhase |
| 5 | `libs/common/src/enums/payment-status.enum.ts` | Enum PaymentStatus |
| 6 | `libs/common/src/dtos/order/create-order.dto.ts` | DTO tạo order |
| 7 | `libs/common/src/dtos/order/review-order.dto.ts` | DTO manager review |
| 8 | `libs/common/src/dtos/order/order-response.dto.ts` | DTO response order |
| 9 | `libs/common/src/dtos/order/index.ts` | Barrel export |
| 10 | `libs/common/src/dtos/payment/initiate-payment.dto.ts` | DTO khởi tạo payment |
| 11 | `libs/common/src/dtos/payment/payos-webhook.dto.ts` | DTO PayOS callback |
| 12 | `libs/common/src/dtos/payment/index.ts` | Barrel export |
| 13 | `libs/common/src/payment/payos.service.ts` | PayOS API integration |
| 14 | `apps/ecommerce-service/src/order/order.module.ts` | Module order |
| 15 | `apps/ecommerce-service/src/order/order.controller.ts` | gRPC controller order |
| 16 | `apps/ecommerce-service/src/order/order.service.ts` | Business logic order |
| 17 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | HTTP routes order |
| 18 | `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts` | Swagger docs order |
| 19 | `apps/audio-processing-service/main.py` | FastAPI app — audio→waveform endpoint |
| 20 | `apps/audio-processing-service/requirements.txt` | Python dependencies |
| 21 | `apps/audio-processing-service/Dockerfile` | Container build |
| 22 | `apps/audio-processing-service/audio_processor.py` | librosa processing + SVG renderer |
| 23 | `apps/audio-processing-service/cloudinary_uploader.py` | Upload SVG to Cloudinary |
| 24 | `libs/common/src/dtos/ecommerce/qr-memory/update-qr-memory.dto.ts` | DTO update QR memory |
| 25 | `libs/common/src/dtos/ecommerce/qr-memory/qr-memory-response.dto.ts` | DTO response QR memory |
| 26 | `apps/ecommerce-service/src/memory-card/memory-card.module.ts` | Module memory card |
| 27 | `apps/ecommerce-service/src/memory-card/memory-card.controller.ts` | gRPC controller memory card |
| 28 | `apps/ecommerce-service/src/memory-card/memory-card.service.ts` | Business logic QR memory |
| 29 | `apps/api-gateway/src/modules/ecommerce/memory-card/memory-card.controller.ts` | HTTP routes QR memory |
| 30 | `apps/api-gateway/src/modules/ecommerce/memory-card/memory-card.swagger.ts` | Swagger docs QR memory |

### 2.2 Modified files

| # | File path | Thay đổi |
|---|-----------|----------|
| 1 | `proto/ecommerce.proto` | Thêm Order + Payment + Production messages và RPCs; mở rộng ClaimDesignDraft response; thêm UpdateEngravingVersionConfig |
| 2 | `libs/common/src/enums/index.ts` | Export enums mới (OrderStatus, BiometricType, CaptureRoute, PaymentPhase, PaymentStatus, EngravingStatus) |
| 3 | `libs/common/src/dtos/index.ts` | Export order + payment DTOs |
| 4 | `libs/common/src/dtos/order/create-order.dto.ts` | **Sửa**: chỉ nhận `engravingIds: string[]` — không còn `designDraftId`, `memoryCardConfig`, `packageType` (tất cả đã lưu qua incremental PATCH) |
| 5 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import OrderModule, PayOS Provider, AudioProcessingClient |
| 7 | `apps/ecommerce-service/src/design/design.controller.ts` | **Mở rộng** ClaimDesignDraft: tạo thêm Engraving + EngravingVersion |
| 8 | `apps/ecommerce-service/src/design/design.service.ts` | **Mở rộng** claimDesignDraft: trả về thêm engraving + versions |
| 9 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | Register OrderController |
| 10 | `apps/api-gateway/src/modules/ecommerce/design/design.swagger.ts` | Cập nhật response wrapper cho claim endpoint |
| 11 | `libs/prisma/prisma/schema.prisma` | **Sửa**: `engravings.order_id` từ `String` → `String?`; thêm `user_id String? @db.Uuid` + relation |
| 12 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import MemoryCardModule |
| 13 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | Register MemoryCardController |
| 14 | `apps/ecommerce-service/src/design/design.service.ts` | **Mở rộng** claimDesignDraft: tạo thêm `qr_memories` default record |
| 15 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `submitOrder`: reset engraving.status = PENDING khi resubmit từ REVISION_REQUIRED |

### 2.3 Schema modification prerequisite

Trước khi implement MF-02, cần sửa Prisma schema — 2 field mới trên `engravings`:

```prisma
// BEFOFE
model engravings {
  id         String   @id @db.Uuid
  order_id   String   @db.Uuid          // required
  // Không có user_id
  // Không có design_draft_id
  ...
}

// AFTER
model engravings {
  id         String        @id @db.Uuid
  order_id   String?       @db.Uuid     // optional — tạo trước, gắn Order sau
  user_id    String?       @db.Uuid     // mới — check ownership khi createOrder
  ...
  users      users?        @relation(fields: [user_id], references: [id])
}
```

Sau khi sửa, chạy migration:
```bash
npx prisma migrate dev --name make_engraving_order_id_optional_add_user_id
```

Lý do:
- `order_id` nullable: Engraving được tạo ở ClaimDesignDraft trước khi có Order, chỉ gắn vào Order khi `POST /orders`.
- `user_id`: Cho phép `createOrder` kiểm tra engraving có thuộc user gọi API không. Được set lúc ClaimDesignDraft (từ `draft.user_id`).

---

## 3. Implementation Steps (chi tiết)

### Step 1: Enums

**File: `libs/common/src/enums/order-status.enum.ts`**
```typescript
export enum OrderStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED', // manager reject → customer sửa lại
  AWAITING_DEPOSIT = 'AWAITING_DEPOSIT',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  IN_PRODUCTION = 'IN_PRODUCTION',
  AWAITING_REMAINING = 'AWAITING_REMAINING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum EngravingStatus {
  PENDING = 'PENDING',
  CAPTURED = 'CAPTURED',     // audio waveform đã xử lý xong
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
```

**File: `libs/common/src/enums/biometric-type.enum.ts`**
```typescript
export enum BiometricType {
  SW = 'SW',
  FP = 'FP',
  HB = 'HB',
}
```

> `selectedBiometrics` trong `customization_config` là array chứa 1-3 giá trị từ enum này. `captureRoute` tự suy: nếu `["SW"]` → ONLINE, else OFFLINE.

**File: `libs/common/src/enums/capture-route.enum.ts`**
```typescript
export enum CaptureRoute {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}
```

**File: `libs/common/src/enums/payment-phase.enum.ts`**
```typescript
export enum PaymentPhase {
  DEPOSIT = 'DEPOSIT',
  REMAINING = 'REMAINING',
  FULL = 'FULL',
}
```

**File: `libs/common/src/enums/payment-status.enum.ts`**
```typescript
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}
```

**Update: `libs/common/src/enums/index.ts`** — thêm 6 exports.

---

### Step 2: Proto

**File: `proto/ecommerce.proto`**

Thêm messages sau vào file hiện tại:

```protobuf
// === Order ===
message Order {
  string id = 1;
  string orderCode = 2;
  string userId = 3;
  string designDraftId = 4;
  string captureRoute = 6;      // tự suy từ selectedBiometrics
  string designSource = 7;
  string status = 8;
  double subtotal = 9;
  double serviceFee = 10;
  double extraFee = 11;
  double discountAmount = 12;
  double totalPrice = 13;
  double paidAmount = 14;
  double remainingAmount = 15;
  string note = 16;
  string createdAt = 17;
  string updatedAt = 18;
  DesignDraft designDraft = 19;
  repeated Payment payments = 20;
  repeated Engraving engravings = 21;  // 1 order có N engravings
}

message CreateOrderRequest {
  repeated string engravingIds = 1;   // gắn engraving đã tạo trước đó vào order
  // KHÔNG gửi packageType — đọc từ engravingVersion.customization_config.selectedBiometrics
  // KHÔNG gửi customizationConfig / memoryCardConfig — tất cả đã lưu incremental qua PATCH
}

message CreateOrderResponse { Order order = 1; }

message GetOrderRequest { string id = 1; }
message GetOrderResponse { Order order = 1; }

message GetMyOrdersRequest { int32 page = 1; int32 limit = 2; }
message GetMyOrdersResponse {
  repeated Order orders = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
}

message ReviewOrderRequest {
  string id = 1;
  string action = 2;   // "approve" | "reject"
  string note = 3;
  string managerId = 4;
}

message ReviewOrderResponse { Order order = 1; }

// === Engraving — được tạo riêng, sau đó gắn vào Order ===

// Mở rộng ClaimDesignDraft response (sửa proto hiện tại)
// Thêm vào DesignDraft message cũ:
//   Engraving engraving = 19;
//   EngravingVersion engravingVersion = 20;

message UpdateEngravingVersionConfigRequest {
  string engravingVersionId = 1;
  string customizationConfig = 2;  // JSON — audio URL, waveform, segment, position
}

message UpdateEngravingVersionConfigResponse {
  EngravingVersion version = 1;
  string orderId = 2;
  string orderStatus = 3;
}

message ResubmitEngravingVersionRequest {
  string engravingVersionId = 1;
}

message ResubmitEngravingVersionResponse {
  EngravingVersion version = 1;
  string orderId = 2;
  string orderStatus = 3;
}

// === Payment ===
message Payment {
  string id = 1;
  string orderId = 2;
  string paymentPhase = 3;
  double amount = 4;
  string method = 5;
  string status = 6;
  string payosTransactionId = 7;
  string paymentUrl = 8;
  string paidAt = 9;
  string createdAt = 10;
}

message InitiatePaymentRequest {
  string orderId = 1;
  string paymentPhase = 2; // "DEPOSIT" | "REMAINING"
  string returnUrl = 3;
  string cancelUrl = 4;
}

message InitiatePaymentResponse {
  Payment payment = 1;
  string paymentUrl = 2;
}

message PayOSWebhookRequest {
  string orderCode = 1;
  string transactionId = 2;
  string paymentCode = 3;
  string status = 4;
  double amount = 5;
  string signature = 6;
}

message PayOSWebhookResponse { bool success = 1; }

// === Engraving ===
message Engraving {
  string id = 1;
  string orderId = 2;
  string userId = 3;
  string productId = 4;
  string uniqueProductId = 5;
  string approvedVersionId = 6;
  string status = 7;
  repeated EngravingVersion versions = 8;
  repeated EngravingBioMetric biometrics = 9;  // dữ liệu biometric thật (sau capture)
}

message EngravingBioMetric {
  string id = 1;
  string engravingId = 2;
  string biometricType = 3;       // "SW" | "FP" | "HB"
  string requiredChannel = 4;     // "ENGRAVING" | "MEMORY_CARD"
  string rawFileUrl = 5;          // audio MP3, fingerprint PNG,...
  string processedSvgUrl = 6;     // waveform SVG, fingerprint SVG,...
  string extraData = 7;           // JSON: selectedSegment, durationMs,...
  string status = 8;              // PENDING_CAPTURE | CAPTURED | PROCESSING
}

message EngravingVersion {
  string id = 1;
  string engravingId = 2;
  int32 versionNumber = 3;
  string selectedMaterialId = 4;
  string selectedGemstoneId = 5;
  string ringSize = 6;
  string ringStyle = 7;
  string ringShape = 8;
  string customizationConfig = 9;
  string status = 10;
  string managerId = 11;
  string managerNote = 12;
  string reviewedAt = 13;
  string createdAt = 14;
}

// === Production ===
message ProductionTask {
  string id = 1;
  string orderId = 2;
  string engravingId = 3;
  string assignedJewelerId = 4;
  string assignedJewelerName = 5;
  string status = 6;
  string note = 7;
  string startedAt = 8;
  string completedAt = 9;
  string createdAt = 10;
}

message AssignJewelerRequest {
  string orderId = 1;
  string jewelerId = 2;
}

message AssignJewelerResponse { ProductionTask task = 1; }

message UpdateProductionStatusRequest {
  string taskId = 1;
  string status = 2;
  string note = 3;
}

message UpdateProductionStatusResponse { ProductionTask task = 1; }

// === QR Memory ===
message QrMemory {
  string id = 1;
  string engravingId = 2;
  string qrCode = 3;
  string cardTitle = 4;
  string greetingMessage = 5;
  string recipientEmail = 6;
  string biometricDisplaySettings = 7;  // JSON — cập nhật sau Manager Approve
  string accessPinHash = 8;
  bool isLocked = 9;
  string createdAt = 10;
  string updatedAt = 11;
}

message UpdateQrMemoryRequest {
  string engravingId = 1;
  string cardTitle = 2;
  string greetingMessage = 3;
  string recipientEmail = 4;
}

message UpdateQrMemoryResponse { QrMemory qrMemory = 1; }

message GetQrMemoryRequest { string engravingId = 1; }
message GetQrMemoryResponse { QrMemory qrMemory = 1; }

message ActivateQrMemoryRequest {
  string qrCode = 1;
  string accessPin = 2;
}

message ActivateQrMemoryResponse { QrMemory qrMemory = 1; }
```

Thêm RPCs vào service:

```protobuf
service EcommerceService {
  // ... keep existing Ping, Catalog, Design Draft RPCs ...
  // Lưu ý: sửa ClaimDesignDraft response — thêm engraving + engravingVersion fields

  // Engraving — sống độc lập, tạo từ ClaimDesignDraft
  rpc UpdateEngravingVersionConfig(UpdateEngravingVersionConfigRequest) returns (UpdateEngravingVersionConfigResponse);
  rpc ResubmitEngravingVersion(ResubmitEngravingVersionRequest) returns (ResubmitEngravingVersionResponse);

  // Orders
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder(GetOrderRequest) returns (GetOrderResponse);
  rpc GetMyOrders(GetMyOrdersRequest) returns (GetMyOrdersResponse);
  rpc ReviewOrder(ReviewOrderRequest) returns (ReviewOrderResponse);

  // Payments
  rpc InitiatePayment(InitiatePaymentRequest) returns (InitiatePaymentResponse);
  rpc HandlePayOSWebhook(PayOSWebhookRequest) returns (PayOSWebhookResponse);

  // Production
  rpc AssignJeweler(AssignJewelerRequest) returns (AssignJewelerResponse);
  rpc UpdateProductionStatus(UpdateProductionStatusRequest) returns (UpdateProductionStatusResponse);

  // QR Memory
  rpc UpdateQrMemory(UpdateQrMemoryRequest) returns (UpdateQrMemoryResponse);
  rpc GetQrMemory(GetQrMemoryRequest) returns (GetQrMemoryResponse);
  rpc ActivateQrMemory(ActivateQrMemoryRequest) returns (ActivateQrMemoryResponse);
}
```

---

### Step 3: DTOs

#### `libs/common/src/dtos/order/create-order.dto.ts`
```typescript
import { IsUUID, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Engraving IDs — đã được tạo từ ClaimDesignDraft trước đó. Tất cả dữ liệu thiết kế (selectedBiometrics, engravingPositions, memoryCard) đã được save incremental trong customization_config của từng engravingVersion. Server tự đọc package type từ config, không cần gửi lên.',
    example: ['c0a80121-0000-4000-8000-000000000001'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  engravingIds!: string[];
}
```

#### `libs/common/src/dtos/order/review-order.dto.ts`
```typescript
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewOrderDto {
  @ApiProperty({ description: 'Action', example: 'approve', enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action!: string;

  @ApiPropertyOptional({ description: 'Manager note', example: 'Design looks good. Proceed to deposit.' })
  @IsOptional()
  @IsString()
  note?: string;
}
```

#### `libs/common/src/dtos/payment/initiate-payment.dto.ts`
```typescript
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Payment phase', example: 'DEPOSIT', enum: ['DEPOSIT', 'REMAINING'] })
  @IsIn(['DEPOSIT', 'REMAINING'])
  paymentPhase!: string;

  @ApiPropertyOptional({ description: 'Return URL after PayOS payment' })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ description: 'Cancel URL if user cancels payment' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
```

#### `libs/common/src/dtos/payment/payos-webhook.dto.ts`
```typescript
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayOSWebhookDto {
  @ApiProperty({ description: 'PayOS order code (maps to our payment_code)' })
  @IsString()
  orderCode!: string;

  @ApiProperty({ description: 'PayOS transaction ID' })
  @IsString()
  transactionId!: string;

  @ApiProperty({ description: 'Payment code (our internal payment code)' })
  @IsOptional()
  @IsString()
  paymentCode?: string;

  @ApiProperty({ description: 'Payment status from PayOS' })
  @IsString()
  status!: string;

  @ApiProperty({ description: 'Amount paid' })
  @IsNumber()
  amount!: number;

  @ApiProperty({ description: 'Webhook signature for verification' })
  @IsString()
  signature!: string;
}
```

#### Response DTOs

**`libs/common/src/dtos/order/order-response.dto.ts`** — response wrappers:
- `OrderResponse` — `{ order: Order }`
- `OrderListResponse` — `{ orders: Order[], meta: PaginationMeta }`
- `OrderCreateResponse` — `{ order: Order }`
- `ReviewResponse` — `{ order: Order }`

**`libs/common/src/dtos/payment/index.ts`**:
- `InitiatePaymentResponse` — `{ payment: Payment, paymentUrl: string }`
- `PayOSWebhookResponse` — `{ success: boolean }`

#### `libs/common/src/dtos/ecommerce/qr-memory/activate-qr-memory.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateQrMemoryDto {
  @ApiProperty({ description: 'QR code from physical card', example: 'a1b2c3d4e5f6' })
  @IsString()
  qrCode!: string;

  @ApiProperty({ description: 'Access PIN', example: '123456' })
  @IsString()
  @MinLength(4)
  accessPin!: string;
}
```

#### `libs/common/src/dtos/ecommerce/qr-memory/update-qr-memory.dto.ts`

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQrMemoryDto {
  @ApiPropertyOptional({ description: 'Card title', example: 'Our Special Ring' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cardTitle?: string;

  @ApiPropertyOptional({ description: 'Greeting message', example: 'Thank you for being with me!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  greetingMessage?: string;

  @ApiPropertyOptional({ description: 'Recipient email (optional, for shared ownership)', example: 'friend@example.com' })
  @IsOptional()
  @IsString()
  recipientEmail?: string;
}
```

---

### Step 4: Ecommerce Service — Order Module

Tạo thư mục `apps/ecommerce-service/src/order/`

#### `order.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrderController],
  providers: [OrderService, PayOSService],
  exports: [OrderService],
})
export class OrderModule {}
```

#### `order.controller.ts` — gRPC controller
```typescript
@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @GrpcMethod('EcommerceService', 'CreateOrder')
  async createOrder(data: CreateOrderRequest) { ... }

  @GrpcMethod('EcommerceService', 'GetOrder')
  async getOrder(data: { id: string }) { ... }

  @GrpcMethod('EcommerceService', 'GetMyOrders')
  async getMyOrders(data: { page?: number; limit?: number; userId?: string }) { ... }

  @GrpcMethod('EcommerceService', 'ReviewOrder')
  async reviewOrder(data: ReviewOrderRequest) { ... }

  @GrpcMethod('EcommerceService', 'InitiatePayment')
  async initiatePayment(data: InitiatePaymentRequest & { userId?: string }) { ... }

  @GrpcMethod('EcommerceService', 'HandlePayOSWebhook')
  async handlePayOSWebhook(data: PayOSWebhookRequest) { ... }

  @GrpcMethod('EcommerceService', 'AssignJeweler')
  async assignJeweler(data: AssignJewelerRequest) { ... }

  @GrpcMethod('EcommerceService', 'UpdateProductionStatus')
  async updateProductionStatus(data: UpdateProductionStatusRequest) { ... }
}
```

#### `design.service.ts` — mở rộng `claimDesignDraft`

Khi user nhập Design Code trên Mobile → claim draft + tạo Engraving + EngravingVersion v1:

```typescript
async claimDesignDraft(code: string, userId: string) {
  // ... existing logic: tìm draft, gán user_id, clear guest_session_id ...

  // Draft đã được claim → đánh dấu là CONVERTED (không thể claim lại)
  await this.prisma.design_drafts.update({
    where: { id: draft.id },
    data: { status: 'CONVERTED' },
  });

  // --- THÊM MỚI: tạo Engraving + EngravingVersion + qr_memories ---
  // Lưu ý: order_id + user_id là nullable — cần migration sửa schema trước
  // Xem phần 2.3 Schema modification prerequisite
  const engraving = await this.prisma.engravings.create({
    data: {
      id: randomUUID(),
      order_id: null,              // chưa có order — sẽ gắn sau
      user_id: userId,             // check ownership khi createOrder
      product_id: draft.product_id,
      status: 'PENDING',
    },
  });

  const engravingVersion = await this.prisma.engraving_versions.create({
    data: {
      id: randomUUID(),
      engraving_id: engraving.id,
      version_number: 1,
      selected_material_id: draft.selected_material_id,
      selected_gemstone_id: draft.selected_gemstone_id,
      ring_size: draft.ring_size,
      ring_style: draft.ring_style,
      ring_shape: draft.ring_shape,
      customization_config: draft.customization_config, // copy từ draft
      status: 'PENDING',
    },
  });

  // Tạo qr_memories mặc định
  const nanoid = (await import('nanoid')).nanoid;
  const crypto = await import('crypto');
  const qrCode = nanoid(12);
  const accessPin = '123456'; // default PIN — user có thể đổi sau
  const accessPinHash = crypto.createHash('sha256').update(accessPin).digest('hex');

  await this.prisma.qr_memories.create({
    data: {
      id: randomUUID(),
      engraving_id: engraving.id,
      qr_code: qrCode,
      access_pin_hash: accessPinHash,
      is_locked: true,
    },
  });

  return {
    draft: { ...updatedDraft, status: 'CONVERTED' },
    engraving: { ...engraving, versions: [engravingVersion] },
    engravingVersion,
    qrCode,
  };
}
```

#### `order.service.ts` — business logic

**`updateEngravingVersionConfig(engravingVersionId, customizationConfig)`:**
- Gọi khi advanced design hoàn tất (chọn biometrics, vị trí, memory card)
- Cập nhật `engraving_versions.customization_config` với dữ liệu mới (lưu tạm, không ảnh hưởng order status)
- Nếu `engravingPositions.sw` vừa có `audioUrl` mới → trigger Python audio processing
  - Sau khi Python trả về waveformUrl → tạo `engraving_biometrics` row:
    - `biometric_type = 'SW'`, `required_channel = 'ENGRAVING'`
    - `raw_file_url = audioUrl`, `processed_svg_url = waveformUrl`
    - `extra_data = { selectedSegment, durationMs }`, `status = 'CAPTURED'`

**`createOrder(engravingId, userId)`:**
1. Validate mỗi engraving trong engravingIds:
   - Engraving tồn tại, chưa gắn order nào (`order_id IS NULL`)
   - Engraving thuộc về user này (`engravings.user_id == userId`)
   - EngravingVersion mới nhất đã có `customization_config.selectedBiometrics` và đầy đủ data cần thiết
2. Đọc `customization_config.selectedBiometrics` từ engravingVersion để suy `captureRoute`:
   - `selectedBiometrics === ['SW']` → ONLINE, else OFFLINE
3. Generate order code: `ORD-${randomBytes(3).toString('hex').toUpperCase()}`
4. Use `$transaction`:
   a. Create `orders` record (status = PENDING_REVIEW, package_type = selectedBiometrics.join('+'), capture_route, user_id)
   b. Với mỗi engraving: update `engravings.order_id = newOrder.id`
      - Tính total_price = sum(engraving.versions[0].customization_config → estimated_price)
   c. **Không set design_drafts.status** — draft đã CONVERTED lúc ClaimDesignDraft
5. Return order với relations (engravings + versions + biometrics)
6. **Không nhận customizationConfig hay memoryCardConfig** — mọi dữ liệu thiết kế đã được save incremental qua `PATCH /api/v1/engravings/:versionId/config` từ trước khi gọi createOrder.

**`getOrder(id, userId?)`:**
1. Find `orders` với `id`
2. Include: `engravings.engraving_versions`, `payments`, `design_drafts`
3. Check ownership nếu caller là customer (không phải manager)

**`getMyOrders(userId, page, limit)`:**
1. Find `orders` where `user_id = userId`
2. Paginate, return `?? []` fallback

**`reviewOrder(id, action, note, managerId)`:**
1. Find order + engraving + latest version, verify status = `PENDING_REVIEW`
2. If `action === 'approve'`:
   - Update version → `APPROVED`, set `approved_version_id` trên engraving
   - **engravings.status** → `APPROVED`
   - Cập nhật `qr_memories.biometric_display_settings` từ `engraving_biometrics` data
   - Order → `AWAITING_DEPOSIT`
   - Set `approved_by_manager_id = managerId`
3. If `action === 'reject'`:
   - Version hiện tại → `REJECTED` (giữ lịch sử)
   - **engravings.status** → `REJECTED`
   - Tạo version mới (version_number + 1): copy customization_config, status = `PENDING`
   - Order → `REVISION_REQUIRED`
4. Return updated order

> **Lưu ý:** Không có granular review (1 order = 1 engraving). Khi customer resubmit, gọi **`PATCH /orders/:id/submit`** — `submitOrder` reset `engraving.status = PENDING` và set `order.status = PENDING_REVIEW`. `PATCH config` chỉ lưu tạm — khi nào design xong mới submit.

**`initiatePayment(orderId, paymentPhase, returnUrl, cancelUrl, userId?)`:**
1. Find order, verify ownership + status
2. Calculate amount:
   - DEPOSIT: `total_price * 0.5`
   - REMAINING: `remaining_amount`
3. Generate payment code: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`
4. Create `payments` record (status = PENDING, payment_phase, amount)
5. Call `PayOSService.createPaymentLink(orderCode, amount, description, returnUrl, cancelUrl)` → paymentUrl
6. Save `payos_transaction_id` to payment record
7. Return payment + paymentUrl

**`handlePayOSWebhook(data)`:**
1. Verify signature via `PayOSService.verifyWebhook(data)`
2. Find payment record by `payment_code`
3. Update `payments.status = PAID`, `paid_at = now()`, `payos_transaction_id`
4. Update order:
   - If DEPOSIT paid: status = DEPOSIT_PAID
   - If REMAINING paid: status = COMPLETED
5. Return `{ success: true }`

**`assignJeweler(orderId, jewelerId)`:**
1. Find order (status must be DEPOSIT_PAID)
2. Với mỗi engraving trong order: create `production_tasks` record
3. Update `orders.status = IN_PRODUCTION`
4. Return production tasks

**`updateProductionStatus(taskId, status, note)`:**
1. Find production task
2. Update status
3. If all tasks COMPLETED: update `orders.status = AWAITING_REMAINING`
4. Return updated task

**Price calculation:**
```
Tổng mỗi engraving:
  engraving_price = design_draft.estimated_price
                   + (mỗi engraving có thể có price riêng nếu khác material/gemstone)

Order:
  subtotal = sum(engraving_price)
  service_fee = 50000 (configurable)
  total_price = subtotal + service_fee
  deposit = total_price * 0.5
  remaining = total_price - deposit
```

---

### Step 5: API Gateway — Order Controller

Tạo thư mục `apps/api-gateway/src/modules/ecommerce/order/`

#### `order.controller.ts`

```typescript
@Controller('api/v1/orders')
export class OrderController {
  constructor(
    @Inject('ECOMMERCE_SERVICE') private client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.ecommerceService =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  // Customer endpoints (auth required, no specific permission)

  @Post()
  @ApiOperation({
    summary: 'Create order from existing engravings',
    description: 'Tất cả dữ liệu thiết kế (selectedBiometrics, engravingPositions, memoryCard) đã được save incremental qua PATCH /engravings/:versionId/config trước đó. Endpoint này chỉ gắn engravingIds vào order — server tự đọc package type từ config.',
  })
  @ApiCreatedResponse({ type: OrderCreateResponse })
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    const result = await lastValueFrom(
      this.ecommerceService.createOrder({
        engravingIds: dto.engravingIds,
        userId: user.sub,
      }),
    );
    return { order: result.order };
  }

  // Engraving — update config sau advanced design

  @Patch('engravings/:versionId/config')
  @ApiOperation({ summary: 'Update engraving version config after advanced design' })
  @ApiParam({ name: 'versionId', type: 'string', format: 'uuid' })
  async updateEngravingConfig(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Body() dto: { customizationConfig: string },
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.updateEngravingVersionConfig({
        engravingVersionId: versionId,
        customizationConfig: dto.customizationConfig,
      }),
    );
    return { version: result.version };
  }

  @Get()
  @ApiOperation({ summary: 'Get my orders' })
  @ApiOkResponse({ type: OrderListResponse })
  async getMyOrders(
    @Query() query: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.getMyOrders({ ...query, userId: user.sub }),
    );
    return {
      orders: result.orders ?? [],
      meta: result.meta ?? { total: 0, page: 1, limit: 10, lastPage: 0 },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponse })
  async getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.getOrder({ id }),
    );
    return { order: result.order };
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Initiate payment (deposit or remaining)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiCreatedResponse({ type: InitiatePaymentResponse })
  async initiatePayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.initiatePayment({
        orderId: id,
        paymentPhase: dto.paymentPhase,
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
        userId: user.sub,
      }),
    );
    return { payment: result.payment, paymentUrl: result.paymentUrl };
  }

  // Manager endpoints (auth + OrderWrite permission)

  @Patch(':id/review')
  @Permissions(Permission.OrderWrite)
  @ApiOperation({ summary: 'Manager review order (approve/reject)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ type: ReviewResponse })
  async review(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReviewOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.reviewOrder({
        id,
        action: dto.action,
        note: dto.note,
        managerId: user.sub,
      }),
    );
    return { order: result.order };
  }

  @Post(':id/assign-jeweler')
  @Permissions(Permission.OrderWrite)
  @ApiOperation({ summary: 'Assign jeweler to order' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiCreatedResponse({ type: AssignJewelerResponse })
  async assignJeweler(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: { jewelerId: string },
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.assignJeweler({
        orderId: id,
        jewelerId: dto.jewelerId,
      }),
    );
    return { task: result.task };
  }

  // Public endpoint (PayOS webhook)

  @Post('/payments/payos-callback')
  @Public()
  @ApiOperation({ summary: 'PayOS payment webhook callback' })
  @ApiCreatedResponse({ type: PayOSWebhookResponse })
  async payOSCallback(@Body() dto: PayOSWebhookDto) {
    const result = await lastValueFrom(
      this.ecommerceService.handlePayOSWebhook(dto),
    );
    return { success: result.success };
  }
}
```

> **Lưu ý:** Trên thực tế, PayOS callback endpoint nên nằm ở path khác để PayOS dễ cấu hình (VD: `/api/v1/payments/payos-callback`). Nếu để trong controller có prefix `orders`, path sẽ là `/api/v1/orders/payments/payos-callback` — OK miễn là không conflict với `:id`.

#### `order.swagger.ts` — full Swagger decorators cho request/response
Cross-check từng endpoint: controller handler → service call → response shape.

---

### Step 5.5: API Gateway — Memory Card Controller

#### `memory-card.controller.ts`

```typescript
@Controller('api/v1/qr-memories')
export class MemoryCardController {
  constructor(
    @Inject('ECOMMERCE_SERVICE') private client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.ecommerceService =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  // Customer endpoints

  @Put(':engravingId')
  @ApiOperation({ summary: 'Update QR memory card fields (cardTitle, greetingMessage, recipientEmail)' })
  @ApiParam({ name: 'engravingId', type: 'string', format: 'uuid' })
  async updateQrMemory(
    @Param('engravingId', new ParseUUIDPipe({ version: '4' })) engravingId: string,
    @Body() dto: UpdateQrMemoryDto,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.updateQrMemory({
        engravingId,
        ...dto,
      }),
    );
    return { qrMemory: result.qrMemory };
  }

  @Get(':engravingId')
  @ApiOperation({ summary: 'Get QR memory by engraving ID' })
  @ApiParam({ name: 'engravingId', type: 'string', format: 'uuid' })
  async getQrMemory(
    @Param('engravingId', new ParseUUIDPipe({ version: '4' })) engravingId: string,
  ) {
    const result = await lastValueFrom(
      this.ecommerceService.getQrMemory({ engravingId }),
    );
    return { qrMemory: result.qrMemory };
  }

  // Public endpoint (no auth) — quét QR code để xem memory card

  @Post('activate')
  @Public()
  @ApiOperation({ summary: 'Activate QR memory — nhập qrCode + accessPin để xem memory card' })
  async activate(@Body() dto: ActivateQrMemoryDto) {
    const result = await lastValueFrom(
      this.ecommerceService.activateQrMemory({
        qrCode: dto.qrCode,
        accessPin: dto.accessPin,
      }),
    );
    return { qrMemory: result.qrMemory };
  }
}
```

#### `memory-card.swagger.ts` — Swagger docs cho memory card endpoints.

---

### Step 6: PayOS Integration

**File: `libs/common/src/payment/payos.service.ts`**

```typescript
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayOSService {
  private readonly apiUrl = 'https://api-merchant.payos.vn';
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('PAYOS_CLIENT_ID');
    this.apiKey = this.configService.getOrThrow<string>('PAYOS_API_KEY');
    this.checksumKey = this.configService.getOrThrow<string>('PAYOS_CHECKSUM_KEY');
  }

  async createPaymentLink(params: {
    orderCode: string;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ paymentUrl: string; transactionId: string }> {
    // POST /v2/payment-requests với headers:
    //   x-client-id: clientId
    //   x-api-key: apiKey
    // Body: { orderCode, amount, description, returnUrl, cancelUrl, signature }
    // Trả về: { data: { checkoutUrl, id } }
  }

  verifyWebhook(payload: { signature: string; [key: string]: unknown }): boolean {
    // Compute HMAC-SHA256 từ payload data (sorted keys) + checksumKey
    // So sánh với payload.signature
  }

  async getTransactionStatus(transactionId: string): Promise<{ status: string }> {
    // GET /v2/payment-requests/{transactionId}
  }
}
```

**Config (.env):**
```
PAYOS_CLIENT_ID=xxx
PAYOS_API_KEY=xxx
PAYOS_CHECKSUM_KEY=xxx
PAYOS_RETURN_URL=bioring://payment/result
PAYOS_CANCEL_URL=bioring://payment/cancel
```

---

### Step 7: Cloudinary

MF-02 dùng Cloudinary cho 2 mục đích:
1. **Audio storage**: Mobile upload audio trực tiếp lên Cloudinary (signed upload preset), nhận `audioUrl`
2. **Waveform SVG storage**: Python service upload SVG waveform lên Cloudinary, nhận `waveformUrl`

Backend không cần upload endpoint — cả mobile và Python service đều dùng Cloudinary API trực tiếp.

---

### Step 8: Python Audio Processing Service

**Kiến trúc:**
```
Mobile: Record Voice → Upload MP3 to Cloudinary → audioUrl
  → PATCH /api/v1/engravings/versions/:versionId/config { customizationConfig: { ... }, audioUrl }  // audioUrl là field RIÊNG, không nằm trong customizationConfig
  → Ecommerce Service gửi audioUrl đến Python Service (HTTP)
  → Python Service: download audio → librosa → SVG → Cloudinary
  → Python Service trả về waveformUrl + durationMs
  → Ecommerce Service tạo engraving_biometrics row:
      biometric_type = 'SW', required_channel = 'ENGRAVING'
      raw_file_url = audioUrl, processed_svg_url = waveformUrl
      extra_data = { durationMs }, status = 'CAPTURED'
  → Cập nhật engravingPositions.sw.status = 'captured' trong customization_config
```

#### Service details

**Location:** `apps/audio-processing-service/`

**File: `requirements.txt`**
```
fastapi==0.111.0
uvicorn==0.30.1
librosa==0.10.2
numpy==1.26.4
svgwrite==1.4.3
cloudinary==1.40.0
requests==2.32.3
pydantic==2.7.4
```

**File: `main.py`**
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from audio_processor import process_audio
from cloudinary_uploader import upload_svg

app = FastAPI(title="Bioring Audio Processing Service")

class ProcessRequest(BaseModel):
    audioUrl: str
    engravingVersionId: str

class ProcessResponse(BaseModel):
    status: str
    waveformUrl: str
    durationMs: int

@app.post("/process-audio", response_model=ProcessResponse)
async def process_audio_endpoint(req: ProcessRequest):
    try:
        svg_url, duration_ms = process_audio(req.audioUrl)
        return ProcessResponse(
            status="completed",
            waveformUrl=svg_url,
            durationMs=duration_ms,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**File: `audio_processor.py`**
```python
import io
import tempfile
import requests
import librosa
import numpy as np
import svgwrite

def process_audio(audio_url: str) -> tuple[str, int]:
    response = requests.get(audio_url, stream=True)
    response.raise_for_status()
    audio_data = io.BytesIO(response.content)

    y, sr = librosa.load(audio_data, sr=None, mono=True)
    duration_ms = int(len(y) / sr * 1000)

    target_width = 800
    block_size = max(1, len(y) // target_width)
    envelope = np.array([
        np.max(np.abs(y[i:i + block_size]))
        for i in range(0, len(y), block_size)
    ])

    max_val = np.max(envelope)
    if max_val > 0:
        envelope = envelope / max_val

    dwg = svgwrite.Drawing(size=(target_width, 200))
    dwg.add(dwg.rect(insert=(0, 0), size=(target_width, 200), fill='transparent'))

    for x, amp in enumerate(envelope[:target_width]):
        y_center = 100
        bar_height = amp * 80
        if bar_height > 0.5:
            dwg.add(dwg.line(
                start=(x, y_center - bar_height),
                end=(x, y_center + bar_height),
                stroke='black', stroke_width=1.5,
            ))

    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as tmp:
        dwg.saveas(tmp.name)
        tmp_path = tmp.name

    svg_url = upload_svg(tmp_path, f"waveform/{audio_url.split('/')[-1].split('.')[0]}.svg")
    return svg_url, duration_ms
```

**File: `cloudinary_uploader.py`**
```python
import cloudinary
import cloudinary.uploader
import os

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'],
)

def upload_svg(file_path: str, public_id: str) -> str:
    result = cloudinary.uploader.upload(
        file_path,
        public_id=public_id,
        resource_type='image',
        format='svg',
        overwrite=True,
    )
    return result['secure_url']
```

**File: `Dockerfile`**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5051
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5051"]
```

#### Ecommerce Service integration

Thêm `AudioProcessingClient` trong ecommerce-service:

```typescript
// apps/ecommerce-service/src/order/audio-processing.client.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AudioProcessingClient {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('AUDIO_PROCESSING_URL', 'http://localhost:5051');
  }

  async processAudio(audioUrl: string, engravingVersionId: string): Promise<{ waveformUrl: string; durationMs: number }> {
    // POST /process-audio { audioUrl, engravingVersionId } → Python service
    // Trả về waveformUrl
  }
}
```

Gọi từ `engraving.service.ts` khi `updateEngravingVersionConfig` có field `audioUrl` (riêng, không nằm trong customizationConfig):
1. Kiểm tra `audioUrl` (tham số riêng) vừa được gửi
2. Gọi `audioProcessingClient.processAudio(audioUrl, engravingVersionId)`
3. Tạo `engraving_biometrics` row:
   ```typescript
   await this.prisma.engraving_biometrics.create({
     data: {
       id: randomUUID(),
       engraving_id, // từ engravingVersion
       biometric_type: 'SW',
       required_channel: 'ENGRAVING',
       raw_file_url: audioUrl,
       processed_svg_url: waveformUrl,
       extra_data: { durationMs },
       status: 'CAPTURED',
     },
   });
   ```
4. Cập nhật `customizationConfig.engravingPositions.sw.status = 'captured'`
5. Lưu lại vào DB

---

### Step 8.5: Ecommerce Service — Memory Card Module

Tạo thư mục `apps/ecommerce-service/src/memory-card/`

#### `memory-card.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [MemoryCardController],
  providers: [MemoryCardService],
  exports: [MemoryCardService],
})
export class MemoryCardModule {}
```

#### `memory-card.service.ts`

```typescript
@Injectable()
export class MemoryCardService {
  constructor(private readonly prisma: PrismaService) {}

  async updateQrMemory(engravingId: string, data: { cardTitle?: string; greetingMessage?: string; recipientEmail?: string }) {
    const qrMemory = await this.prisma.qr_memories.findUniqueOrThrow({
      where: { engraving_id: engravingId },
    });

    return this.prisma.qr_memories.update({
      where: { engraving_id: engravingId },
      data: {
        ...(data.cardTitle !== undefined && { card_title: data.cardTitle }),
        ...(data.greetingMessage !== undefined && { greeting_message: data.greetingMessage }),
        ...(data.recipientEmail !== undefined && { recipient_email: data.recipientEmail }),
      },
    });
  }

  async getQrMemory(engravingId: string) {
    return this.prisma.qr_memories.findUniqueOrThrow({
      where: { engraving_id: engravingId },
    });
  }

  async activateQrMemory(qrCode: string, accessPin: string) {
    const qrMemory = await this.prisma.qr_memories.findUniqueOrThrow({
      where: { qr_code: qrCode },
    });

    const hash = require('crypto').createHash('sha256').update(accessPin).digest('hex');
    if (qrMemory.access_pin_hash !== hash) {
      throw new GrpcException('Invalid access PIN', 6 /* PERMISSION_DENIED */);
    }

    return this.prisma.qr_memories.update({
      where: { qr_code: qrCode },
      data: { is_locked: false },
    });
  }
}
```

> **Lưu ý:** `qr_memories.engraving_id` có unique constraint — mỗi engraving chỉ có 1 QR memory record.

#### `memory-card.controller.ts` — gRPC controller

```typescript
@Controller()
export class MemoryCardController {
  constructor(private readonly memoryCardService: MemoryCardService) {}

  @GrpcMethod('EcommerceService', 'UpdateQrMemory')
  async updateQrMemory(data: UpdateQrMemoryRequest) {
    const qrMemory = await this.memoryCardService.updateQrMemory(data.engravingId, {
      cardTitle: data.cardTitle,
      greetingMessage: data.greetingMessage,
      recipientEmail: data.recipientEmail,
    });
    return { qrMemory };
  }

  @GrpcMethod('EcommerceService', 'GetQrMemory')
  async getQrMemory(data: { engravingId: string }) {
    const qrMemory = await this.memoryCardService.getQrMemory(data.engravingId);
    return { qrMemory };
  }

  @GrpcMethod('EcommerceService', 'ActivateQrMemory')
  async activateQrMemory(data: { qrCode: string; accessPin: string }) {
    const qrMemory = await this.memoryCardService.activateQrMemory(data.qrCode, data.accessPin);
    return { qrMemory };
  }
}
```

---

### Step 9: Swagger documentation

Tuân thủ `plans/rule.md`:
- Mỗi endpoint có `@ApiOperation()`, `@ApiOkResponse()` / `@ApiCreatedResponse()`
- `@ApiParam()` cho `:id`
- `@ApiBody()` cho request DTOs
- Response example đúng wrapper (`{ order: {...} }`, `{ payment: {...}, paymentUrl: '...' }`, `{ qrMemory: {...} }`)
- Status code khớp: không thêm 403 cho `@Public()`, không thiếu 400/404/409
- Cross-check từng endpoint: controller → service → swagger file

**Memory card endpoints:**
- `PUT /api/v1/qr-memories/:engravingId` — update cardTitle/greetingMessage/recipientEmail
- `GET /api/v1/qr-memories/:engravingId` — get QR memory details
- `POST /api/v1/qr-memories/activate` — public, unlock memory card with qrCode + accessPin

---

## 4. Data model mapping

### Order status lifecycle

```
PENDING_REVIEW
  │
  ├── (manager approve) → AWAITING_DEPOSIT
  │     │
  │     ├── (deposit webhook) → DEPOSIT_PAID
  │     │     │
  │     │     ├── (assign jeweler) → IN_PRODUCTION
  │     │     │     │
  │     │     │     ├── (jeweler completes) → AWAITING_REMAINING
  │     │     │     │     │
  │     │     │     │     ├── (remaining webhook) → COMPLETED
  │     │     │     │     └── ...
  │     │     │     └── ...
  │     │     └── ...
  │     └── ...
  │
  ├── (manager reject) → REVISION_REQUIRED
  │     └── (customer resubmit) → PENDING_REVIEW (review lại)
  │
  └── CANCELLED

Any state → CANCELLED
```

### Engraving lifecycle (tạo trước, gắn vào Order sau)

```
design_drafts (1) — web design (MF-01)
  │
  ├── ClaimDesignDraft (sync code lên mobile)
  │     ├── Engraving (1) — order_id = null, user_id = userId, status = PENDING
  │     ├── EngravingVersion v1 (1) — copy customization_config từ draft, status = PENDING
  │     └── qr_memories (1) — qr_code (nanoid), access_pin_hash (SHA256), is_locked = true
  │
  ├── Advanced Design (mobile)
  │     ├── UpdateEngravingVersionConfig × N → customization_config cộng dồn
  │     │     selectedBiometrics, engravedType, engravingPositions
  │     ├── UpdateQrMemory × N → gọi PUT /api/v1/qr-memories/:engravingId
  │     │     cardTitle, greetingMessage, recipientEmail
  │     └── Sau audio capture → tạo engraving_biometrics row (SW, ENGRAVING, file URLs)
  │
  ├── CreateOrder
  │     └── orders (1) — gắn engravingIds vào Order
  │           engraving[0].order_id = order.id
  │           engraving[1].order_id = order.id  (1 order có N engravings)
  │           captureRoute suy từ selectedBiometrics
  │
  ├── Manager Review (granular — approve/reject subset via engravingIds[])
  │     ├── Approve: EngravingVersion v(N).status = APPROVED
  │     │            engraving.approved_version_id = v(N).id
  │     │            engravings.status = APPROVED
  │     │            qr_memories.biometric_display_settings ← từ engraving_biometrics
  │     │            (Order chỉ AWAITING_DEPOSIT khi ALL engravings APPROVED)
  │     │
  │     └── Reject: EngravingVersion v(N).status = REJECTED (giữ lịch sử)
  │                  engravings.status = REJECTED
  │                  → Tạo EngravingVersion v(N+1) = copy(v(N)), status = PENDING
  │                  → Customer sửa trên v(N+1) → gọi PATCH config (save tạm)
  │                  → Khi sửa xong, gọi PATCH /orders/:id/submit → engraving.status = PENDING, order = PENDING_REVIEW
  │                  → Manager review lại
  │
  ├── engraving_biometrics (N rows) — mỗi biometric_type trong selectedBiometrics 1 row
  │     DEPOSIT:  raw_file_url → processed_svg_url (sau capture)
  │     Các row khác (FP/HB) → tạo sau khi IoT capture (MF-03/04)
  │
  ├── payments (N)
  │     DEPOSIT:  PENDING → PAID
  │     REMAINING: PENDING → PAID
  │
  ├── production_tasks (N) — mỗi engraving 1 task
  │     ASSIGNED → IN_PROGRESS → COMPLETED
  │
  ├── qr_memories (1) — cập nhật biometric_display_settings sau Manager Approve
  │     QR view (MF-05): quét → nhập PIN → unlock → xem memory card
  │
  └── design_drafts → status = CONVERTED (khi ClaimDesignDraft)

---

## 5. Acceptance criteria

| # | Tiêu chí | Verify bằng |
|---|----------|-------------|
| 1 | ClaimDesignDraft (sync code) → tạo Engraving + EngravingVersion v1 + qr_memories từ draft data | curl, check DB engraving_versions + qr_memories |
| 2 | PATCH `/api/v1/engravings/:versionId/config` cập nhật customization_config thành công (ko có memoryCard) | curl, check DB |
| 3 | POST `/orders` với `engravingIds: [...]` tạo order, gắn engraving vào order | curl, check DB orders.engravings |
| 4 | Order code format `ORD-XXXXXX` | code review |
| 5 | GET `/orders` trả về danh sách order của user (paged, `?? []` fallback) | curl |
| 6 | GET `/orders/:id` trả về detail kèm engravings + versions + payments | curl |
| 7 | Manager PATCH `/orders/:id/review` (approve, all engravings) → engraving APPROVED, engraving.status APPROVED, order AWAITING_DEPOSIT | curl, check DB |
| 8 | Manager PATCH `/orders/:id/review` (reject, all engravings) → version REJECTED, engraving.status REJECTED, version mới PENDING, order REVISION_REQUIRED | curl, check DB |
| 9 | Manager PATCH `/orders/:id/review` (approve với engravingIds[] subset) → chỉ engravingIds đó APPROVED, order vẫn PENDING_REVIEW (nếu còn engraving chưa duyệt) | curl, check DB |
| 10 | Manager PATCH `/orders/:id/review` (reject với engravingIds[] subset) → chỉ engravingIds đó REJECTED, order vẫn PENDING_REVIEW | curl, check DB |
| 11 | POST `/orders/:id/payments` (DEPOSIT) → trả về payment + paymentUrl | curl, check PayOS sandbox |
| 12 | POST `/payments/payos-callback` (webhook mock) → Payment PAID, Order DEPOSIT_PAID | curl mock |
| 13 | POST `/orders/:id/assign-jeweler` → tạo production_task + Order.IN_PRODUCTION | curl, check DB |
| 14 | Update production status → Order chuyển AWAITING_REMAINING / COMPLETED | curl |
| 15 | Python service POST `/process-audio` → nhận audioUrl → trả về waveformUrl | curl gọi Python service |
| 16 | Khi updateEngravingConfig có engravingPositions.sw.audioUrl → tự động gọi Python → tạo engraving_biometrics row (SW, file URLs) | curl + check DB engraving_biometrics |
| 17 | engraving_biometrics row có đúng biometric_type, required_channel, extra_data, status | code review + DB check |
| 18 | PUT `/api/v1/qr-memories/:engravingId` (cardTitle, greetingMessage, recipientEmail) → cập nhật qr_memories table | curl, check DB qr_memories |
| 19 | GET `/api/v1/qr-memories/:engravingId` → trả về qr_memories record | curl |
| 20 | POST `/api/v1/qr-memories/activate` (qrCode + accessPin) → unlock memory card (is_locked = false) | curl |
| 21 | PATCH /orders/:id/submit từ REVISION_REQUIRED → engraving.status = PENDING, order = PENDING_REVIEW | curl + DB check |
| 22 | PATCH config trên version PENDING bình thường → không ảnh hưởng order status | curl + DB check |
| 23 | Unauthorized (no JWT) gọi customer endpoints → 401 | curl |
| 24 | Customer không phải manager gọi review/assign → 401/403 | curl |
| 25 | Swagger docs đúng cho từng endpoint — response wrapper, params | check /docs |
| 26 | List API dùng `?? []` fallback | code review |
| 27 | UUID validation: `ParseUUIDPipe({ version: '4' })` + `@IsUUID('4')` | code review |
| 28 | Build NestJS + Python service không lỗi | `npm run build` + `uvicorn` |

---

## 6. Testing strategy

### Unit tests
- **DesignService** (mở rộng): test `claimDesignDraft` tạo engraving + engravingVersion
- **OrderService** (mock Prisma + AudioProcessingClient):
  - `createOrder` — validates engravingIds, links engravings to order, reads selectedBiometrics
  - `updateEngravingVersionConfig` — updates config, triggers audio processing, creates engraving_biometrics
  - `reviewOrder` — approve/reject status transitions
  - `initiatePayment` — creates payment, calls PayOS
  - `handlePayOSWebhook` — verifies signature, updates payment+order
  - `assignJeweler` — creates production_tasks for each engraving
  - Edge cases: engraving not found, already linked, unauthorized, invalid status
- **PayOSService**: mock HTTP calls, test:
  - `createPaymentLink` — calls correct endpoint, returns paymentUrl
  - `verifyWebhook` — valid/invalid signatures
- **AudioProcessingClient**: mock HTTP, test:
  - `processAudio` — calls Python service, returns waveformUrl
  - Error handling when Python service is down

### Python service tests
- **audio_processor.py**: test with sample audio file → verify SVG output
  - Kiểm tra SVG có chứa `<line>` elements (waveform bars)
  - Kiểm tra durationMs trả về chính xác
- **cloudinary_uploader.py**: mock Cloudinary API
- **main.py**: FastAPI TestClient — test /process-audio + /health endpoints

### E2E tests (sau — dùng Postman collection)
- Full flow: tạo draft (web) → claim → engraving → advanced design → create order → review → payment → assign → complete

---

## 7. Out of scope (phase này)

| Item | Lý do |
|------|-------|
| ❌ QR physical card printing & packaging | Thuộc MF-05 (Delivery & QR Memory) |
| ❌ Shipment management | Thuộc MF-05 |
| ❌ Warranty activation | Thuộc MF-05 |
| ❌ MF-03/04 specific flows (multiple deposits, walk-in) | Phase sau |
| ❌ FP capture processing (fingerprint → SVG) | Phase sau (MF-03) |
| ❌ HB data collection & display | Phase sau (MF-03), HB chỉ memory card, không khắc |
| ❌ Admin dashboard UI | Web FE concern |
| ❌ Rate limiting | Sẽ thêm sau nếu cần |
| ❌ Payment refund flow | Không thuộc MF-02 |
| ❌ `CANCELLED` status handling | Implement sau (cần cancel order flow) |

---

## 8. Post-MF-03 update: 1 Order = 1 Engraving (Option B)

**⚠️ Sau khi implement MF-03, áp dụng Option B: tạo Order tại Package Selection + 1:1.**

### Thời điểm tạo Order

| Flow | CŨ | MỚI (Option B) |
|------|----|----------------|
| MF-02 (SW) | POST /orders sau Advanced Design + Memory Card | **POST /orders ngay sau Package Selection** |
| MF-03 (offline) | POST /orders sau Package Selection | Giữ nguyên |

⇒ **Advanced Design + Memory Card** diễn ra khi order đang `AWAITING_SUBMIT`.

### Schema — chuyển FK

```diff
 model engravings {
-  order_id  String?   @db.Uuid          // nullable, không unique → N:1
+  // XOÁ: order_id, relation orders
+  order     orders?   // virtual field từ FK bên orders
 }

 model orders {
+  engraving_id  String    @unique @db.Uuid
+  engraving     engravings @relation(fields: [engraving_id], references: [id])
-  engravings    engravings[]
 }
```

### Code

| Thành phần | CŨ | MỚI |
|-----------|-----|------|
| Proto `CreateOrderRequest` | `repeated string engravingIds = 1` | `string engravingId = 1` |
| Proto `Order` | `repeated Engraving engravings = 20` | `Engraving engraving = 20` |
| Proto `ReviewOrderRequest` | `repeated string engravingIds = 5` | **XOÁ** |
| `create-order.dto.ts` | `engravingIds: string[]` | `engravingId: string` |
| `review-order.dto.ts` | `engravingIds?: string[]` | **XOÁ** |
| `order.service.ts createOrder` | findMany, loop, updateMany | findUnique, 1 validate, create với engraving_id |
| `order.service.ts reviewOrder` | targetEngravings, allApproved/allRejected | 1 engraving — approve/reject trực tiếp |
| `order.service.ts mapOrderFull` | `order.engravings.map(...)` | `order.engraving ? { ... } : null` |
| `order.service.ts assignJeweler` | findFirst engraving | `order.engraving` |
| Gateway interface | `createOrder({ engravingIds: string[] })` | `createOrder({ engravingId: string })` |
| Swagger `orderExample()` | `engravings: [...]` | `engraving: {...}` |

**Chi tiết: xem `plans/extra/MF-02-MF-03-01_engraving_per_order.md`**
