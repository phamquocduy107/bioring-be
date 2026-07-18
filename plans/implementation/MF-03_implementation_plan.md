# MF-03: Store Biometric Capture Order — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Cho phép Customer có tài khoản đặt hàng với package có biometric cần capture offline (FP, HB, hoặc tổ hợp SW+FP, SW+HB, FP+HB, ALL). Flow khác MF-02 ở chỗ:

- **POST /orders** sớm hơn — sau Package Selection, trước Advanced Design
- **Deposit 1** (IoT fee) để confirm order + chi phí capture
- **Store staff upload biometric data** thật sau capture IoT
- **Continue design** với data thật → **Submit** → Manager Review → **Deposit 2**

### Actors
- **Customer (Mobile)**: Chọn package offline, pay Deposit 1, continue design sau IoT, submit review
- **Store Staff (Dashboard/iPad)**: Upload biometric data (FP, SW audio, HB) sau khi capture
- **Manager**: Final Design Review (giống MF-02)
- **Jeweler**: Sản xuất (giống MF-02)

### Luồng chính (thống nhất với MF-02)
```
Mobile Design → Package Selection (offline)
  → POST /orders { engravingIds, packageType } → AWAITING_DEPOSIT_1
  → Pay DEPOSIT_1 (IoT fee cố định) → AWAITING_CAPTURE
  → Store IoT capture → Staff upload biometrics
  → Customer PATCH config với data thật → AWAITING_SUBMIT
  → PATCH /orders/:id/submit → PENDING_REVIEW
  → Manager Review → Approve → AWAITING_DEPOSIT
  → Pay DEPOSIT_2 → DEPOSIT_PAID
  → Assign Jeweler → IN_PRODUCTION
  → Complete → AWAITING_REMAINING
  → Pay REMAINING → COMPLETED
```

### Điểm khác MF-02
| Khía cạnh | MF-02 (SW-only) | MF-03 (offline) |
|-----------|----------------|-----------------|
| POST /orders status | `AWAITING_SUBMIT` | `AWAITING_DEPOSIT_1` |
| Deposit trước submit | ❌ | ✅ Deposit 1 (IoT fee) |
| IoT capture | ❌ | ✅ Staff upload biometrics |
| Submit endpoint | ✅ `PATCH /orders/:id/submit` | ✅ `PATCH /orders/:id/submit` |
| Từ PENDING_REVIEW → về sau | Giống hệt | Giống hệt |

### Request lifecycle
```
Customer App ──HTTP──> API Gateway (:3000) ──gRPC──> Ecommerce Service (:50051) ──Prisma──> PostgreSQL
                                                                  │
                                                      ┌────────────┴────────────┐
                                                      │  PayOS (REST API)       │
                                                      │  Webhook callback       │
                                                      └─────────────────────────┘

Staff Dashboard ──HTTP──> API Gateway ──gRPC──> Ecommerce Service
  POST /api/v1/engravings/:id/biometrics
    → Trigger Python process (SW→waveform, FP→fingerprint SVG)
    → Tạo engraving_biometrics rows
```

### Auth pattern
| Decorator | Behavior |
|-----------|----------|
| `@Public()` | Skip auth — webhook |
| Không decorator | JWT required — customer |
| `@Permissions(Permission.OrderWrite)` | JWT + permission — manager + staff |

---

## 2. File-by-file changes

### 2.1 Sửa enum — thêm status mới

#### `libs/common/src/enums/order-status.enum.ts`
```typescript
export enum OrderStatus {
  AWAITING_SUBMIT = 'AWAITING_SUBMIT',        // MF-02: sau POST /orders, chờ submit
  AWAITING_DEPOSIT_1 = 'AWAITING_DEPOSIT_1',  // MF-03: chờ Deposit 1 (IoT fee)
  AWAITING_CAPTURE = 'AWAITING_CAPTURE',       // MF-03: chờ IoT capture tại store
  AWAITING_SUBMIT = 'AWAITING_SUBMIT',         // MF-03: đã capture, chờ submit review
  PENDING_REVIEW = 'PENDING_REVIEW',           // chung
  REVISION_REQUIRED = 'REVISION_REQUIRED',     // chung
  AWAITING_DEPOSIT = 'AWAITING_DEPOSIT',       // chung (Deposit 2)
  DEPOSIT_PAID = 'DEPOSIT_PAID',              // chung
  IN_PRODUCTION = 'IN_PRODUCTION',
  AWAITING_REMAINING = 'AWAITING_REMAINING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
```

#### `libs/common/src/enums/payment-phase.enum.ts`
```typescript
export enum PaymentPhase {
  DEPOSIT_1 = 'DEPOSIT_1',  // IoT fee — MF-03
  DEPOSIT_2 = 'DEPOSIT_2',  // Deposit sau approve — MF-02 + MF-03
  REMAINING = 'REMAINING',
  FULL = 'FULL',             // Walk-in (MF-04)
}
```

### 2.2 Sửa DTO

| DTO | Thay đổi |
|-----|----------|
| `create-order.dto.ts` | Thêm field `packageType: string` (`@IsString()`) |
| `initiate-payment.dto.ts` | `@IsIn(['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'])` |
| **New** `engraving-biometrics.dto.ts` | `{ engravingId, biometricType, rawFileUrl }` |

### 2.3 Sửa Proto

**`proto/ecommerce.proto`** — thêm:

```protobuf
message CreateOrderRequest {
  repeated string engravingIds = 1;
  string packageType = 2;         // mới — "SW" | "SW+FP" | "FP+HB" | ...
}

message SubmitOrderRequest {
  string id = 1;
}

message SubmitOrderResponse {
  Order order = 1;
}

message AttachBiometricRequest {
  string engravingId = 1;
  string biometricType = 2;    // "SW" | "FP" | "HB"
  string rawFileUrl = 3;       // Cloudinary URL
}

message AttachBiometricResponse {
  EngravingBioMetric biometric = 1;
}
```

RPCs mới:
```protobuf
rpc SubmitOrder(SubmitOrderRequest) returns (SubmitOrderResponse);
rpc AttachBiometric(AttachBiometricRequest) returns (AttachBiometricResponse);
```

### 2.4 Files cần sửa

| # | File | Thay đổi |
|---|------|----------|
| 1 | `libs/common/src/enums/order-status.enum.ts` | Thêm 3 status: `AWAITING_DEPOSIT_1`, `AWAITING_CAPTURE`, `AWAITING_SUBMIT` |
| 2 | `libs/common/src/enums/payment-phase.enum.ts` | `DEPOSIT` → `DEPOSIT_1` + `DEPOSIT_2` |
| 3 | `libs/common/src/enums/index.ts` | (nếu cần export mới) |
| 4 | `libs/common/src/dtos/ecommerce/order/create-order.dto.ts` | Thêm `packageType` |
| 5 | `libs/common/src/dtos/ecommerce/payment/initiate-payment.dto.ts` | Cập nhật `@IsIn` |
| 6 | **New** `libs/common/src/dtos/ecommerce/engraving/attach-biometric.dto.ts` | DTO cho upload biometric |
| 7 | **New** `libs/common/src/dtos/ecommerce/engraving/submit-order.dto.ts` | DTO cho submit |
| 8 | `libs/common/src/dtos/ecommerce/engraving/index.ts` | Export mới |
| 9 | `proto/ecommerce.proto` | Thêm `packageType` vào `CreateOrderRequest`, thêm `SubmitOrder` + `AttachBiometric` RPCs |
| 10 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | Thêm route `POST /orders/:id/submit`, sửa `createOrder` gửi `packageType`, thêm route `POST /engravings/:id/biometrics` |
| 11 | `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts` | Docs cho endpoint mới |
| 12 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm gRPC handlers `submitOrder`, `attachBiometric` |
| 13 | `apps/ecommerce-service/src/order/order.service.ts` | Sửa `createOrder` (nhận `packageType`, chọn status theo package), thêm `submitOrder`, thêm `attachBiometric` |
| 14 | `libs/common/src/payment/constants.ts` hoặc `.env` | Thêm constant `IOT_FEE_AMOUNT` |

---

## 3. Implementation Steps (chi tiết)

### Step 0: Constant IoT fee

**File: `libs/common/src/constants/payment.constants.ts`** (new)
```typescript
export const IOT_FEE_AMOUNT = 100000; // 100,000 VND — IoT capture fee
```

Hoặc đặt trong `.env`: `IOT_FEE_AMOUNT=100000`, đọc từ `ConfigService`.

→ Dùng cho `initiatePayment` khi `paymentPhase === 'DEPOSIT_1'`.

### Step 1: Enums

Sửa `order-status.enum.ts` — thêm 3 giá trị:
- `AWAITING_DEPOSIT_1`
- `AWAITING_CAPTURE`  
- `AWAITING_SUBMIT`

Sửa `payment-phase.enum.ts` — đổi `DEPOSIT` → `DEPOSIT_1`, `DEPOSIT_2`:
```typescript
export enum PaymentPhase {
  DEPOSIT_1 = 'DEPOSIT_1',
  DEPOSIT_2 = 'DEPOSIT_2',
  REMAINING = 'REMAINING',
  FULL = 'FULL',
}
```

### Step 2: DTOs

#### `create-order.dto.ts` — thêm `packageType`
```typescript
import { IsUUID, IsArray, ArrayNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ ... })
  @IsUUID('4')
  engravingId!: string;

  @ApiProperty({
    description: 'Package type — xác định route và biometrics cần capture',
    example: 'SW+FP',
  })
  @IsString()
  packageType!: string;
}
```

#### `initiate-payment.dto.ts` — cập nhật phase list
```typescript
@IsIn(['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'])
paymentPhase!: string;
```

#### **New:** `attach-biometric.dto.ts`
```typescript
import { IsIn, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachBiometricDto {
  @ApiProperty({ enum: ['SW', 'FP', 'HB'] })
  @IsIn(['SW', 'FP', 'HB'])
  biometricType!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/.../audio.mp3' })
  @IsString()
  rawFileUrl!: string;
}
```

#### **New:** `submit-order.dto.ts` — không cần body, chỉ cần orderId param
```typescript
// Empty body — chỉ cần orderId từ route param
// Có thể thêm note sau
```

### Step 3: Proto

Mở rộng `CreateOrderRequest`:
```protobuf
message CreateOrderRequest {
  string engravingId = 1;     // 1 order = 1 engraving
  // packageType được derive từ selected_biometrics của engravingVersion
}
```

Thêm messages + RPCs:
```protobuf
message SubmitOrderRequest { string id = 1; }
message SubmitOrderResponse { Order order = 1; }

message AttachBiometricRequest {
  string engravingId = 1;
  string biometricType = 2;
  string rawFileUrl = 3;
}
message AttachBiometricResponse { EngravingBioMetric biometric = 1; }

service EcommerceService {
  // ... existing RPCs ...
  rpc SubmitOrder(SubmitOrderRequest) returns (SubmitOrderResponse);
  rpc AttachBiometric(AttachBiometricRequest) returns (AttachBiometricResponse);
}
```

### Step 4: Ecommerce Service — sửa `createOrder`

**File: `apps/ecommerce-service/src/order/order.service.ts`**

Thay đổi:
1. Nhận thêm `packageType: string`
2. Bỏ đọc `selectedBiometrics` từ `customization_config` — dùng `packageType` từ client
3. Suy `captureRoute`:
   - `packageType === 'SW'` → `ONLINE`
   - else → `OFFLINE`
4. Set `orders.package_type = packageType`
5. Chọn initial status:
   - `captureRoute === 'ONLINE'` → `AWAITING_SUBMIT`
   - `captureRoute === 'OFFLINE'` → `AWAITING_DEPOSIT_1`

```typescript
async createOrder(engravingId: string, userId: string) {
  // Find engraving + latest version
  const engraving = await this.prisma.engravings.findUnique({
    where: { id: engravingId },
    include: {
      engraving_versions_engraving_versions_engraving_idToengravings: {
        orderBy: { version_number: 'desc' }, take: 1,
      },
      order: true,
    },
  });
  if (!engraving) throw new NotFoundException('Engraving not found');
  if (engraving.user_id !== userId) throw new ForbiddenException('...');
  if (engraving.order) throw new BadRequestException('Engraving already has an order');

  // Derive packageType từ selected_biometrics
  const version = engraving.engraving_versions_engraving_versions_engraving_idToengravings[0];
  const selected = version?.selected_biometrics?.split(',').filter(Boolean) ?? [];
  if (selected.length === 0) throw new BadRequestException('No biometrics selected');

  const packageType = selected.join('_');
  const captureRoute = packageType === 'SW' ? 'ONLINE' : 'OFFLINE';
  const initialStatus = captureRoute === 'ONLINE' ? 'AWAITING_SUBMIT' : 'AWAITING_DEPOSIT_1';

  // Calculate price, create order...
  const order = await this.prisma.orders.create({
    data: {
      engraving_id: engravingId,
      package_type: packageType,
      capture_route: captureRoute,
      status: initialStatus,
      // ...
    },
  });

  return { order };
}
```

### Step 5: Ecommerce Service — thêm `submitOrder`

**File: `apps/ecommerce-service/src/order/order.service.ts`**

```typescript
async submitOrder(id: string) {
  const order = await this.prisma.orders.findUnique({ where: { id } });
  if (!order) throw new NotFoundException('Order not found');

  if (!['AWAITING_SUBMIT', 'AWAITING_CAPTURE'].includes(order.status ?? '')) {
    throw new BadRequestException(
      'Order must be in AWAITING_SUBMIT or AWAITING_CAPTURE to submit'
    );
  }

  // TODO: (future) validate engraving_biometrics đủ so với package_type

  const updated = await this.prisma.orders.update({
    where: { id },
    data: { status: 'PENDING_REVIEW' },
  });

  return { order: await this.mapOrder(updated) };
}
```

### Step 6: Ecommerce Service — thêm `attachBiometric`

**File: `apps/ecommerce-service/src/order/order.service.ts`**

```typescript
async attachBiometric(
  engravingId: string,
  biometricType: string,
  rawFileUrl: string,
) {
  // 1. Tìm engraving + order
  const engraving = await this.prisma.engravings.findUnique({
    where: { id: engravingId },
    include: { orders: true },
  });
  if (!engraving) throw new NotFoundException('Engraving not found');
  if (!engraving.order_id) throw new BadRequestException('Engraving not linked to an order');

  // 2. Verify order status == AWAITING_CAPTURE
  if (engraving.orders?.status !== 'AWAITING_CAPTURE') {
    throw new BadRequestException(
      'Order must be in AWAITING_CAPTURE status to attach biometrics'
    );
  }

  // 3. Verify biometricType có trong package_type
  const packageTypes = (engraving.orders.package_type ?? '').split('+');
  if (!packageTypes.includes(biometricType)) {
    throw new BadRequestException(
      `Biometric type ${biometricType} not in package ${engraving.orders.package_type}`
    );
  }

  // 4. Nếu SW — trigger Python audio processing
  //    Nếu FP — trigger Python fingerprint processing
  //    Nếu HB — chỉ lưu raw, không process
  const processedSvgUrl = await this.processBiometric(biometricType, rawFileUrl, engravingId);

  // 5. Xác định requiredChannel
  const requiredChannel = biometricType === 'HB' ? 'MEMORY_CARD' : 'ENGRAVING';

  // 6. Tạo engraving_biometrics row
  const biometric = await this.prisma.engraving_biometrics.create({
    data: {
      id: randomUUID(),
      engraving_id: engravingId,
      biometric_type: biometricType,
      required_channel: requiredChannel,
      raw_file_url: rawFileUrl,
      processed_svg_url: processedSvgUrl,
      extra_data: {},
      status: 'CAPTURED',
    },
  });

  return { biometric };
}

private async processBiometric(
  biometricType: string,
  rawFileUrl: string,
  engravingVersionId: string,
): Promise<string> {
  if (biometricType === 'SW') {
    const res = await fetch(`${baseUrl}/process-audio`, { ... });
    const data = await res.json() as { waveformUrl: string };
    return data.waveformUrl;
  }
  if (biometricType === 'FP') {
    const res = await fetch(`${baseUrl}/process-fingerprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: rawFileUrl, engravingVersionId }),
    });
    if (!res.ok) throw new Error(`Fingerprint processing failed: ${await res.text()}`);
    const data = await res.json() as { processedSvgUrl: string };
    return data.processedSvgUrl;
  }
  // HB — no processing needed
  return rawFileUrl;
}
```

### Step 7: Gateway — HTTP routes

**File: `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts`**

| Method | Path | Auth | Handler | Mô tả |
|--------|------|------|---------|-------|
| `POST` | `/api/v1/orders` | JWT | `createOrder` | Sửa: gửi thêm `packageType` |
| `PATCH` | `/api/v1/orders/:id/submit` | JWT | `submitOrder` | Mới: submit để review |
| `POST` | `/api/v1/engravings/:id/biometrics` | `OrderWrite` | `attachBiometric` | Mới: staff upload biometric |

Sửa `createOrder` handler:
```typescript
createOrder(@Body() body: CreateOrderDto, @CurrentUser() user: JwtPayload) {
  return this.call(() =>
    this.grpc!.createOrder({
      engravingId: body.engravingId,
      userId: user.sub,
    }),
  );
}
```

Thêm `submitOrder`:
```typescript
@Patch(':id/submit')
submitOrder(@Param('id', ParseUUIDPipe) id: string) {
  return this.call(() => this.grpc!.submitOrder({ id }));
}
```

Thêm `attachBiometric`:
```typescript
@Post('/engravings/:id/biometrics')
@Permissions(Permission.OrderWrite)
attachBiometric(
  @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  @Body() body: AttachBiometricDto,
) {
  return this.call(() =>
    this.grpc!.attachBiometric({
      engravingId: id,
      biometricType: body.biometricType,
      rawFileUrl: body.rawFileUrl,
    }),
  );
}
```

### Step 8: Gateway — Swagger docs

**File: `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts`**

- `ApiCreateOrderDocs` — update body example bao gồm `packageType`
- **New** `ApiSubmitOrderDocs` — PATCH submit, response OrderResponse
- **New** `ApiAttachBiometricDocs` — POST biometrics, response { biometric }

### Step 9: Payment — sửa `initiatePayment`

**File: `apps/ecommerce-service/src/order/order.service.ts` — `initiatePayment`**

```typescript
const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'];
if (!allowedPhases.includes(paymentPhase)) {
  throw new BadRequestException('Invalid payment phase');
}

let amount = 0;
if (paymentPhase === 'DEPOSIT_1') {
  amount = IOT_FEE_AMOUNT; // IoT fee cố định
} else if (paymentPhase === 'DEPOSIT_2') {
  amount = Math.max(Math.round(Number(order.total_price ?? 0) * 0.3), 3000);
  if (Number(order.paid_amount ?? 0) >= amount) {
    throw new BadRequestException('Deposit already paid');
  }
} else if (paymentPhase === 'REMAINING') {
  amount = Number(order.remaining_amount ?? 0);
  if (amount <= 0) {
    throw new BadRequestException('No remaining amount to pay');
  }
}
```

Sửa order status transition trong webhook handler:

```typescript
if (payment.payment_phase === 'DEPOSIT_1') {
  newStatus = 'AWAITING_CAPTURE';
} else if (payment.payment_phase === 'DEPOSIT_2') {
  newStatus = 'DEPOSIT_PAID';
} else if (payment.payment_phase === 'REMAINING') {
  newStatus = 'COMPLETED';
}
```

### Step 10: MF-02 compatibility — sửa đồng bộ

Các thay đổi ảnh hưởng MF-02:

| Thay đổi | Tác động MF-02 | Fix |
|----------|---------------|-----|
| Payment phase `DEPOSIT` → `DEPOSIT_2` | MF-02 gọi phase `DEPOSIT` → sai | Mobile MF-02 gửi `DEPOSIT_2` thay vì `DEPOSIT` |
| `CreateOrderRequest` thêm `packageType` | MF-02 gửi `packageType: 'SW'` | Mobile MF-02 thêm field này |
| `POST /orders` → `AWAITING_SUBMIT` (không còn `PENDING_REVIEW`) | MF-02 sau POST /orders phải gọi `PATCH /orders/:id/submit` | Mobile MF-02 thêm 1 step submit |

---

## 4. Status machine (cuối cùng)

```
                              POST /orders
                              { engravingId }
                              (packageType derive từ selectedBiometrics)
                                    │
                    ┌───────────────┴───────────────┐
                    │ SW-only                        │ có FP/HB
                    ▼                                ▼
            AWAITING_SUBMIT                  AWAITING_DEPOSIT_1
                    │                                │
                    │                          Pay DEPOSIT_1
                    │                          (IoT fee)
                    │                                │
                    │                                ▼
                    │                         AWAITING_SUBMIT
                    │                          (có thể upload biometrics)
                    │                                │
                    └───────────┬────────────────────┘
                                │
                          PATCH /orders/:id/submit
                          (resubmit: eng + order PENDING_REVIEW)
                                │
                          PENDING_REVIEW
                                │
                          Manager Review
                            ├── Approve → AWAITING_DEPOSIT
                            │     └── Pay DEPOSIT_2 → DEPOSIT_PAID
                            │           └── Assign → IN_PRODUCTION
                            │                 └── Complete → PENDING_QC → READY_FOR_DELIVERY
                            │                       └── (MF-05)
                            └── Reject → REVISION_REQUIRED
                                  └── PATCH submit → PENDING_REVIEW
```

---

## 5. MF-02 vs MF-03 — so sánh chi tiết

| Giai đoạn | MF-02 (SW-only) | MF-03 (offline) |
|-----------|----------------|-----------------|
| POST /orders | selectedBiometrics = "SW" → `AWAITING_SUBMIT` | selectedBiometrics có FP/HB → `AWAITING_DEPOSIT_1` |
| Payment 1 | — | `DEPOSIT_1` (IoT fee) → `AWAITING_SUBMIT` |
| IoT capture | — | Staff `POST .../biometrics` |
| Continue design | PATCH config (bình thường) | PATCH config với data thật |
| Submit | `PATCH /orders/:id/submit` | `PATCH /orders/:id/submit` |
| Review | Manager approve/reject | Manager approve/reject |
| Payment 2 | `DEPOSIT_2` | `DEPOSIT_2` |
| Production | Giống | Giống |

---

## 6. Acceptance criteria

| # | Tiêu chí | Verify |
|---|----------|--------|
| 1 | POST /orders với engraving có selected_biometrics = "SW,FP" → order status `AWAITING_DEPOSIT_1`, package_type lưu "SW_FP" | curl + check DB |
| 2 | POST /orders với engraving có selected_biometrics = "SW" → order status `AWAITING_SUBMIT` | curl + check DB |
| 3 | POST /orders/:id/payments `{ paymentPhase: "DEPOSIT_1" }` → số tiền = IoT fee | curl |
| 4 | PayOS webhook: DEPOSIT_1 paid → order status `AWAITING_SUBMIT` | curl mock |
| 5 | POST /engravings/:id/biometrics `{ biometricType: "FP", rawFileUrl }` → gọi Python /process-fingerprint, tạo engraving_biometrics row | curl + check DB |
| 6 | POST /engravings/:id/biometrics với type không có trong package → reject 400 | curl |
| 7 | POST /engravings/:id/biometrics với order không ở AWAITING_SUBMIT → reject 400 | curl |
| 8 | PATCH /orders/:id/submit (từ AWAITING_SUBMIT) → `PENDING_REVIEW` | curl + check DB |
| 9 | PATCH /orders/:id/submit (từ REVISION_REQUIRED) → `PENDING_REVIEW` + engraving.status = PENDING | curl + check DB |
| 10 | Manager approve → AWAITING_DEPOSIT, pay DEPOSIT_2 → DEPOSIT_PAID (giống MF-02) | curl |
| 11 | MF-02 flow vẫn chạy đúng với selected_biometrics = "SW" → AWAITING_SUBMIT | E2E test |
| 12 | Build NestJS + Python không lỗi | `npm run build` |

---

## 7. Tác động MF-02 (cần sửa)

| Việc | Lý do |
|------|-------|
| Mobile MF-02: gọi POST /orders chỉ gửi `engravingId` (string, không array) | Đồng bộ 1:1 |
| Mobile MF-02: sửa `DEPOSIT` → `DEPOSIT_2` khi gọi initiatePayment | Đồng bộ enum |
| Mobile MF-02: thêm 1 step submit (`PATCH /orders/:id/submit`) sau POST /orders | Thay đổi flow |
| Backend: `createOrder` không nhận `packageType` từ client — tự derive từ `selected_biometrics` | Code đã làm đúng |

---

## 8. Out of scope (phase này)

| Item | Lý do |
|------|-------|
| ❌ Hardware IoT integration | Tạm thời upload file thủ công |
| ❌ Validate đủ biometrics trước submit | Để TODO comment |
| ❌ MF-04 (Walk-in full payment) | Phase sau |
| ❌ Biometric capture session management | Phase sau khi có IoT |

---

## 9. Post-implementation update: 1 Order = 1 Engraving (Option B)

**⚠️ Sau khi implement MF-03, áp dụng Option B: tạo Order tại Package Selection + 1:1.**

### Thời điểm tạo Order

| Flow | MF-03 plan cũ | Option B |
|------|--------------|----------|
| MF-02 (SW) | POST /orders sau Advanced Design + Memory Card | **POST /orders sau Package Selection** (thống nhất) |
| MF-03 (offline) | POST /orders sau Package Selection | Giữ nguyên |

⇒ MF-02 Advanced Design + Memory Card diễn ra khi order `AWAITING_SUBMIT`.

### Schema — chuyển FK

```diff
 model orders {
+  engraving_id  String    @unique @db.Uuid
+  engraving     engravings @relation(fields: [engraving_id], references: [id])
-  engravings    engravings[]
 }

 model engravings {
-  order_id  String?   @db.Uuid
+  // XOÁ: order_id, relation orders
+  order     orders?   // virtual
 }
```

### Review — bỏ granular

| CŨ | MỚI |
|----|-----|
| approve/reject subset engravings via `engravingIds[]` | Approve → `AWAITING_DEPOSIT`, Reject → `REVISION_REQUIRED` (trực tiếp) |
| `allApproved` check trước khi sang `AWAITING_DEPOSIT` | **XOÁ** — chỉ 1 engraving |
| `allRejected` check trước khi sang `REVISION_REQUIRED` | **XOÁ** — chỉ 1 engraving |

### Code changes (tóm tắt)

| File | CŨ | MỚI |
|------|-----|-----|
| `proto/ecommerce.proto` | `repeated string engravingIds`, `repeated Engraving engravings` | `string engravingId`, `Engraving engraving` |
| `create-order.dto.ts` | `engravingIds: string[]` | `engravingId: string` (`@IsUUID('4')`) |
| `review-order.dto.ts` | `engravingIds?: string[]` | **XOÁ** |
| `order.service.ts createOrder` | findMany + loop validate + updateMany | findUnique + 1 validate + create with engraving_id |
| `order.service.ts reviewOrder` | targetEngravings loop, allApproved/Rejected | Xoá loop, approve/reject trực tiếp |
| `order.service.ts mapOrderFull` | `.engravings.map(...)` | `.engraving ? { ... } : null` |
| `order.service.ts attachBiometric` | `engraving.orders?.status` | `engraving.order?.status` |
| `order.service.ts assignJeweler` | `findFirst engraving` | `order.engraving` |
| Gateway controller | `{ engravingIds: body.engravingIds }` | `{ engravingId: body.engravingId }` |
| Swagger `orderExample()` | `engravings: [...]` | `engraving: {...}` |

### Memory Card

- `GET /api/v1/qr-memories/:engravingId` đã có sẵn
- 1 engraving = 1 qr_memories (unique constraint)
- Cả MF-02 và MF-03 đều có Memory Card step trước Submit

**Chi tiết: xem `plans/extra/MF-02-MF-03-01_engraving_per_order.md`**
