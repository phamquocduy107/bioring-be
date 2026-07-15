# MF-04: Walk-in Guest In-store Order — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Cho phép khách vãng lai (không tài khoản) đến cửa hàng, được Staff hỗ trợ tạo order ngay sau Package Selection, upload biometrics. Sau đó guest tự thiết kế trên tablet. Manager duyệt xong, guest thanh toán FULL 100%.

### Actors
- **Store Staff (iPad/Web Dashboard)**: Nhập thông tin khách, tạo order, chọn package, thu thập biometric
- **Guest (Tablet)**: Thiết kế (Simple + Advanced Design + Memory Card), submit, thanh toán
- **Manager**: Review design, approve
- **Jeweler**: Sản xuất (giống MF-02/03)
- **System**: Sinh guest_code + order_code

### Auth pattern
| Actor | Auth |
|-------|------|
| Staff | JWT + `@Permissions(Permission.OrderWrite)` |
| Guest | `@Public()` + guest_code trong query/body |
| Manager | JWT + `@Permissions(Permission.OrderWrite)` |

### Luồng chính
```
[STAFF tại quầy — JWT auth]
  1. Nhập thông tin khách (tên, SĐT, email)
     → POST /api/v1/guest/sessions → guest_customers + guest_code
  2. Tạo order cho guest (gồm: engraving + order cùng lúc)
     → POST /api/v1/guest/orders { guestCustomerId, productId? }
     → Gộp createEngraving + createOrder, status = AWAITING_SUBMIT
  3. Chọn package → PATCH engraving version config (selectedBiometrics)
  4. Thu thập biometric (SW/FP/HB) → upload
     → POST /api/v1/engravings/:id/biometrics

  In QR code chứa guest_code → đưa cho khách

[GUEST trên Tablet — @Public() + guest_code]
  5. Quét QR → nhập guest_code → GET session → thấy order + engraving
  6. Simple Design → PATCH config qua version từ order.engraving
  7. Advanced Design → PATCH config (vị trí, engravedType...)
  8. Memory Card → PUT qr-memories
  9. Submit → PATCH /api/v1/guest-tablet/orders/:id/submit
       → order: AWAITING_SUBMIT → PENDING_REVIEW

[MANAGER — JWT auth]
  10. Review → PATCH /api/v1/orders/:id/review
      → Approve → AWAITING_DEPOSIT
      → Reject → REVISION_REQUIRED → guest sửa → resubmit → PENDING_REVIEW

[GUEST thanh toán — @Public() + guest_code]
  11. Pay FULL 100%
      → POST /api/v1/guest-tablet/orders/:id/payments
      → Webhook: FULL paid → DEPOSIT_PAID

[SYSTEM — giống MF-02/03]
  12. Assign Jeweler → IN_PRODUCTION → ... → COMPLETED (MF-05)
  13. Guest dùng order_code tra cứu đơn (POST /orders/lookup — đã có MF-05)
```

### So sánh với MF-02/03

| | MF-02/03 | MF-04 |
|---|---|---|
| Ai tạo engraving + order | Customer (app) sau design | Staff (iPad) ngay từ đầu |
| Order tạo lúc nào | Sau Package Selection (MF-02), hoặc sau IoT (MF-03) | Ngay sau khi tạo guest session |
| engraving.user_id | userId của customer | staffId (người tạo) |
| order.user_id | userId | null |
| order.guest_customer_id | null | guestId |
| order.created_by_staff_id | null | staffId |
| order.design_source | "MOBILE" | "WALK_IN" |
| Thứ tự flow | Design trước, biometrics sau | Biometrics trước, design sau |
| Auth trên thiết bị guest | JWT Customer | @Public() + guest_code |
| Thanh toán | DEPOSIT_1/2 + REMAINING | FULL (100%) |
| Tra cứu đơn | GET /orders (JWT) | POST /orders/lookup (Public) |

---

## 2. Schema — KHÔNG CẦN THAY ĐỔI

```prisma
// orders đã có sẵn:
model orders {
  guest_customer_id  String?            @db.Uuid     // link guest
  created_by_staff_id String?           @db.Uuid     // staff tạo order
  engraving_id       String             @unique @db.Uuid  // 1:1
  user_id            String?            @db.Uuid     // null cho guest
  design_source      String?            @db.VarChar(100)  // "WALK_IN"
  ...
}

// guest_customers đã có sẵn:
model guest_customers {
  id         String   @id @db.Uuid
  guest_code String?  @unique @db.VarChar(50)
  full_name  String?  @db.VarChar(255)
  phone      String?  @db.VarChar(50)
  email      String?  @db.VarChar(255)
  note       String?
  orders     orders[]
  ...
}
```

**Không cần migration.** Mọi FK đã tồn tại.

---

## 3. New files

| # | File path | Mục đích |
|---|-----------|----------|
| 1 | `libs/common/src/dtos/ecommerce/guest/create-guest-session.dto.ts` | DTO tạo guest |
| 2 | `libs/common/src/dtos/ecommerce/guest/create-guest-order.dto.ts` | DTO tạo order cho guest |
| 3 | `apps/ecommerce-service/src/guest/guest.module.ts` | Module guest |
| 4 | `apps/ecommerce-service/src/guest/guest.controller.ts` | gRPC controller guest |
| 5 | `apps/ecommerce-service/src/guest/guest.service.ts` | Business logic guest |
| 6 | `apps/api-gateway/src/modules/ecommerce/guest/guest.controller.ts` | HTTP routes cho staff |
| 7 | `apps/api-gateway/src/modules/ecommerce/guest/guest.swagger.ts` | Swagger docs staff |
| 8 | `apps/api-gateway/src/modules/ecommerce/guest/guest-tablet.controller.ts` | HTTP routes cho tablet guest |
| 9 | `apps/api-gateway/src/modules/ecommerce/guest/guest-tablet.swagger.ts` | Swagger docs tablet |

---

## 4. Modified files

| # | File path | Thay đổi |
|---|-----------|----------|
| 1 | `proto/ecommerce.proto` | Thêm Guest RPCs + messages |
| 2 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import GuestModule |
| 3 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm FULL phase trong `initiatePayment` + `handlePayOSWebhook`; sửa ownership check cho guest |
| 4 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | Register GuestController, GuestTabletController |
| 5 | `libs/common/src/dtos/index.ts` | Export guest DTOs |

---

## 5. Implementation Steps

### Step 1: Proto

**File: `proto/ecommerce.proto`**

```protobuf
// === Guest ===

message GuestCustomer {
  string id = 1;
  string guestCode = 2;
  string fullName = 3;
  string phone = 4;
  string email = 5;
  string note = 6;
  string createdAt = 7;
}

message CreateGuestSessionRequest {
  string fullName = 1;
  string phone = 2;
  string email = 3;
  string note = 4;
  string staffId = 5;
}

message CreateGuestSessionResponse {
  GuestCustomer guest = 1;
}

message CreateGuestOrderRequest {
  string guestCustomerId = 1;
  string productId = 2;
  string staffId = 3;
}

message CreateGuestOrderResponse {
  Order order = 1;
  Engraving engraving = 2;
  EngravingVersion version = 3;
}

message GetGuestSessionRequest {
  string guestCode = 1;
}

message GetGuestSessionResponse {
  GuestCustomer guest = 1;
  Order order = 2;          // order đang AWAITING_SUBMIT hoặc REVISION_REQUIRED
}

message GuestSubmitOrderRequest {
  string orderId = 1;
  string guestCode = 2;
}

message GuestSubmitOrderResponse {
  Order order = 1;
  bool isResubmit = 2;
}

message GuestUpdateEngravingConfigRequest {
  string engravingVersionId = 1;
  string guestCode = 2;
  string selectedMaterialId = 3;
  string selectedGemstoneId = 4;
  string ringSize = 5;
  string ringStyle = 6;
  string ringShape = 7;
  string customizationConfig = 8;
  string selectedBiometrics = 9;
}

message GuestUpdateEngravingConfigResponse {
  EngravingVersion version = 1;
}

message GuestUpdateQrMemoryRequest {
  string engravingId = 1;
  string guestCode = 2;
  string cardTitle = 3;
  string greetingMessage = 4;
  string recipientEmail = 5;
}

message GuestUpdateQrMemoryResponse {
  QrMemory qrMemory = 1;
}

message GuestGetOrderRequest {
  string orderId = 1;
  string guestCode = 2;
}

message GuestInitiatePaymentRequest {
  string orderId = 1;
  string guestCode = 2;
  string paymentPhase = 3;  // "FULL"
  string returnUrl = 4;
  string cancelUrl = 5;
}

message GuestInitiatePaymentResponse {
  Payment payment = 1;
  string paymentUrl = 2;
}

service EcommerceService {
  // ... existing RPCs ...

  // Guest
  rpc CreateGuestSession(CreateGuestSessionRequest) returns (CreateGuestSessionResponse);
  rpc CreateGuestOrder(CreateGuestOrderRequest) returns (CreateGuestOrderResponse);
  rpc GetGuestSession(GetGuestSessionRequest) returns (GetGuestSessionResponse);
  rpc GuestSubmitOrder(GuestSubmitOrderRequest) returns (GuestSubmitOrderResponse);
  rpc GuestUpdateEngravingConfig(GuestUpdateEngravingConfigRequest) returns (GuestUpdateEngravingConfigResponse);
  rpc GuestUpdateQrMemory(GuestUpdateQrMemoryRequest) returns (GuestUpdateQrMemoryResponse);
  rpc GuestGetOrder(GuestGetOrderRequest) returns (GetOrderResponse);
  rpc GuestInitiatePayment(GuestInitiatePaymentRequest) returns (GuestInitiatePaymentResponse);
}
```

---

### Step 2: DTOs

#### `libs/common/src/dtos/ecommerce/guest/create-guest-session.dto.ts`
```typescript
import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestSessionDto {
  @ApiProperty({ description: 'Họ tên khách', example: 'Nguyễn Văn A' })
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0909123456' })
  @IsString()
  @MaxLength(50)
  phone!: string;

  @ApiPropertyOptional({ description: 'Email', example: 'guest@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
```

#### `libs/common/src/dtos/ecommerce/guest/create-guest-order.dto.ts`
```typescript
import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestOrderDto {
  @ApiProperty({ description: 'Guest Customer ID', format: 'uuid' })
  @IsUUID('4')
  guestCustomerId!: string;

  @ApiPropertyOptional({ description: 'Product ID (nếu chọn mẫu ngay)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;
}
```

---

### Step 3: Guest Service (ecommerce-service)

**File: `apps/ecommerce-service/src/guest/guest.service.ts`**

```typescript
@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly memoryCardService: MemoryCardService,
  ) {}

  // =========== STAFF ===========

  // 1. Tạo guest session
  async createGuestSession(data: {
    fullName: string; phone: string; email?: string;
    note?: string; staffId: string;
  }) {
    const guestCode = await this.generateGuestCode();
    const guest = await this.prisma.guest_customers.create({
      data: {
        id: randomUUID(),
        guest_code: guestCode,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        note: data.note,
      },
    });
    return { guest: this.mapGuest(guest) };
  }

  // 2. Tạo order cho guest (gộp createEngraving + createOrder)
  async createGuestOrder(data: {
    guestCustomerId: string; productId?: string; staffId: string;
  }) {
    const guest = await this.prisma.guest_customers.findUniqueOrThrow({
      where: { id: data.guestCustomerId },
    });

    // Tạo engraving
    const engraving = await this.prisma.engravings.create({
      data: {
        id: randomUUID(),
        user_id: data.staffId,       // staff là người tạo
        product_id: data.productId,
        status: 'PENDING',
      },
    });

    // Tạo engraving_version v1
    const version = await this.prisma.engraving_versions.create({
      data: {
        id: randomUUID(),
        engraving_id: engraving.id,
        version_number: 1,
        status: 'PENDING',
      },
    });

    // Tạo qr_memories mặc định
    await this.prisma.qr_memories.create({
      data: {
        id: randomUUID(),
        engraving_id: engraving.id,
        qr_code: nanoid(12),
        access_pin_hash: crypto.createHash('sha256').update('123456').digest('hex'),
        is_locked: true,
      },
    });

    // Tính giá tạm (sẽ cập nhật sau khi guest chọn material/gemstone)
    const subtotal = await this.calculateSubtotal(engraving);
    const serviceFee = Math.round(subtotal * 0.1);
    const totalPrice = subtotal + serviceFee;

    // Tạo order
    const order = await this.prisma.orders.create({
      data: {
        id: randomUUID(),
        order_code: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        engraving_id: engraving.id,
        user_id: null,
        guest_customer_id: data.guestCustomerId,
        created_by_staff_id: data.staffId,
        design_source: 'WALK_IN',
        status: 'AWAITING_SUBMIT',
        subtotal,
        service_fee: serviceFee,
        total_price: totalPrice,
        paid_amount: 0,
        remaining_amount: totalPrice,
      },
    });

    return {
      order: this.mapOrderSummary(order),
      engraving: this.mapEngraving(engraving),
      version,
    };
  }

  // =========== GUEST TABLET ===========

  // 3. Lấy session guest (trả về order đang active)
  async getGuestSession(guestCode: string) {
    const guest = await this.prisma.guest_customers.findUniqueOrThrow({
      where: { guest_code: guestCode },
    });

    // Tìm order active: AWAITING_SUBMIT hoặc REVISION_REQUIRED
    const order = await this.prisma.orders.findFirst({
      where: {
        guest_customer_id: guest.id,
        status: { in: ['AWAITING_SUBMIT', 'REVISION_REQUIRED'] },
      },
      include: {
        engraving: {
          include: {
            engraving_versions_engraving_versions_engraving_idToengravings: {
              orderBy: { version_number: 'desc' }, take: 1,
            },
            engraving_biometrics: true,
            qr_memories: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      guest: this.mapGuest(guest),
      order: order ? this.mapOrderFull(order) : null,
    };
  }

  // 4. Guest submit order
  async guestSubmitOrder(orderId: string, guestCode: string) {
    const { guestId } = await this.validateGuestOwnership(guestCode, { orderId });

    const order = await this.prisma.orders.findUniqueOrThrow({
      where: { id: orderId },
      include: { engraving: true },
    });

    if (order.status === 'AWAITING_SUBMIT') {
      // Submit lần đầu
      await this.prisma.orders.update({
        where: { id: orderId },
        data: { status: 'PENDING_REVIEW' },
      });
      return { order: this.mapOrderSummary(order), isResubmit: false };
    }

    if (order.status === 'REVISION_REQUIRED') {
      // Resubmit sau reject
      await this.prisma.$transaction([
        this.prisma.engravings.update({
          where: { id: order.engraving_id },
          data: { status: 'PENDING' },
        }),
        this.prisma.orders.update({
          where: { id: orderId },
          data: { status: 'PENDING_REVIEW' },
        }),
      ]);
      return { order: this.mapOrderSummary(order), isResubmit: true };
    }

    throw new BadRequestException(
      'Order must be AWAITING_SUBMIT or REVISION_REQUIRED to submit',
    );
  }

  // 5. Guest cập nhật engraving config
  async guestUpdateEngravingConfig(
    engravingVersionId: string, guestCode: string, data: any,
  ) {
    const { guestId } = await this.validateGuestOwnership(guestCode, {
      engravingVersionId,
    });

    const updateData: any = {};
    if (data.selectedMaterialId !== undefined) updateData.selected_material_id = data.selectedMaterialId;
    if (data.selectedGemstoneId !== undefined) updateData.selected_gemstone_id = data.selectedGemstoneId;
    if (data.ringSize !== undefined) updateData.ring_size = data.ringSize;
    if (data.ringStyle !== undefined) updateData.ring_style = data.ringStyle;
    if (data.ringShape !== undefined) updateData.ring_shape = data.ringShape;
    if (data.customizationConfig !== undefined) updateData.customization_config = JSON.parse(data.customizationConfig);
    if (data.selectedBiometrics !== undefined) updateData.selected_biometrics = data.selectedBiometrics;

    const updated = await this.prisma.engraving_versions.update({
      where: { id: engravingVersionId },
      data: updateData,
    });

    return { version: updated };
  }

  // 6. Guest cập nhật QR memory
  async guestUpdateQrMemory(engravingId: string, guestCode: string, data: any) {
    await this.validateGuestOwnership(guestCode, { engravingId });
    return this.memoryCardService.updateQrMemory(engravingId, data);
  }

  // 7. Guest xem order
  async guestGetOrder(orderId: string, guestCode: string) {
    await this.validateGuestOwnership(guestCode, { orderId });
    return this.orderService.getOrder(orderId);
  }

  // 8. Guest initiate payment (FULL)
  async guestInitiatePayment(orderId: string, guestCode: string, data: {
    returnUrl?: string; cancelUrl?: string;
  }) {
    await this.validateGuestOwnership(guestCode, { orderId });
    return this.orderService.initiatePayment(orderId, 'FULL', null, data.returnUrl, data.cancelUrl);
  }

  // =========== HELPERS ===========

  async validateGuestOwnership(guestCode: string, target: {
    engravingVersionId?: string; engravingId?: string; orderId?: string;
  }) {
    const guest = await this.prisma.guest_customers.findUniqueOrThrow({
      where: { guest_code: guestCode },
    });

    if (target.engravingVersionId) {
      const version = await this.prisma.engraving_versions.findUniqueOrThrow({
        where: { id: target.engravingVersionId },
        include: {
          engraving: { include: { order: true } },
        },
      });
      const order = version.engraving.order;
      if (!order || order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this engraving');
      }
    }

    if (target.engravingId) {
      const engraving = await this.prisma.engravings.findUniqueOrThrow({
        where: { id: target.engravingId },
        include: { order: true },
      });
      if (!engraving.order || engraving.order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this engraving');
      }
    }

    if (target.orderId) {
      const order = await this.prisma.orders.findUniqueOrThrow({
        where: { id: target.orderId },
      });
      if (order.guest_customer_id !== guest.id) {
        throw new ForbiddenException('Guest does not own this order');
      }
    }

    return { guestId: guest.id, guest };
  }

  private async generateGuestCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = 'GUE-';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (await this.prisma.guest_customers.findUnique({ where: { guest_code: code } }));
    return code;
  }

  private async calculateSubtotal(engraving: any): Promise<number> {
    if (!engraving.product_id) return 0;
    const product = await this.prisma.products.findUnique({
      where: { id: engraving.product_id },
    });
    return Number(product?.base_price ?? 0);
  }

  // --- Mappers ---
  private mapGuest(guest: any) {
    return {
      id: guest.id,
      guestCode: guest.guest_code,
      fullName: guest.full_name,
      phone: guest.phone,
      email: guest.email,
      note: guest.note,
      createdAt: guest.created_at?.toISOString(),
    };
  }

  private mapOrderSummary(order: any) {
    return {
      id: order.id,
      orderCode: order.order_code,
      userId: order.user_id ?? '',
      guestCustomerId: order.guest_customer_id ?? '',
      designSource: order.design_source,
      status: order.status,
      totalPrice: Number(order.total_price ?? 0),
      paidAmount: Number(order.paid_amount ?? 0),
      remainingAmount: Number(order.remaining_amount ?? 0),
      createdAt: order.created_at?.toISOString(),
    };
  }

  private mapEngraving(engraving: any) {
    return {
      id: engraving.id,
      userId: engraving.user_id ?? '',
      productId: engraving.product_id ?? '',
      status: engraving.status,
      versions: engraving.engraving_versions_engraving_versions_engraving_idToengravings ?? [],
      biometrics: engraving.engraving_biometrics ?? [],
    };
  }

  private mapOrderFull(order: any) {
    return {
      id: order.id,
      orderCode: order.order_code,
      userId: order.user_id ?? '',
      guestCustomerId: order.guest_customer_id ?? '',
      captureRoute: order.capture_route,
      designSource: order.design_source,
      status: order.status,
      packageType: order.package_type,
      subtotal: Number(order.subtotal ?? 0),
      serviceFee: Number(order.service_fee ?? 0),
      totalPrice: Number(order.total_price ?? 0),
      paidAmount: Number(order.paid_amount ?? 0),
      remainingAmount: Number(order.remaining_amount ?? 0),
      engraving: order.engraving ? {
        id: order.engraving.id,
        status: order.engraving.status,
        versions: order.engraving.engraving_versions_engraving_versions_engraving_idToengravings ?? [],
        biometrics: order.engraving.engraving_biometrics ?? [],
        qrMemory: order.engraving.qr_memories ?? null,
      } : null,
      createdAt: order.created_at?.toISOString(),
    };
  }
}
```

---

### Step 4: Sửa `order.service.ts` — FULL payment

**File: `apps/ecommerce-service/src/order/order.service.ts`**

#### 4.1 `initiatePayment` — thêm FULL phase

```typescript
// Mở rộng allowedPhases
const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'];

// Thêm case FULL:
if (paymentPhase === 'FULL') {
  if (!order.guest_customer_id) {
    throw new BadRequestException('FULL payment is only available for walk-in guests');
  }
  amount = Number(order.total_price ?? 0);
  if (amount <= 0) throw new BadRequestException('Invalid total price');
}
```

#### 4.2 `handlePayOSWebhook` — thêm FULL status transition

```typescript
if (payment.payment_phase === 'FULL') {
  newStatus = 'DEPOSIT_PAID';
}
```

#### 4.3 Ownership check cho guest

```typescript
// Trong initiatePayment, sửa phần check ownership:
if (order.user_id) {
  if (order.user_id !== userId) throw new ForbiddenException('...');
} else if (!order.guest_customer_id) {
  throw new ForbiddenException('Order has no identifiable owner');
}
// Nếu order.guest_customer_id != null → guest service đã validate trước khi gọi
```

---

### Step 5: Guest gRPC controller (ecommerce-service)

**File: `apps/ecommerce-service/src/guest/guest.controller.ts`**

```typescript
@Controller()
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @GrpcMethod('EcommerceService', 'CreateGuestSession')
  async createGuestSession(data: CreateGuestSessionRequest) {
    return this.guestService.createGuestSession(data);
  }

  @GrpcMethod('EcommerceService', 'CreateGuestOrder')
  async createGuestOrder(data: CreateGuestOrderRequest) {
    return this.guestService.createGuestOrder(data);
  }

  @GrpcMethod('EcommerceService', 'GetGuestSession')
  async getGuestSession(data: { guestCode: string }) {
    return this.guestService.getGuestSession(data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestSubmitOrder')
  async guestSubmitOrder(data: GuestSubmitOrderRequest) {
    return this.guestService.guestSubmitOrder(data.orderId, data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestUpdateEngravingConfig')
  async guestUpdateConfig(data: GuestUpdateEngravingConfigRequest) {
    return this.guestService.guestUpdateEngravingConfig(
      data.engravingVersionId, data.guestCode, data,
    );
  }

  @GrpcMethod('EcommerceService', 'GuestUpdateQrMemory')
  async guestUpdateQrMemory(data: GuestUpdateQrMemoryRequest) {
    return this.guestService.guestUpdateQrMemory(data.engravingId, data.guestCode, data);
  }

  @GrpcMethod('EcommerceService', 'GuestGetOrder')
  async guestGetOrder(data: GuestGetOrderRequest) {
    return this.guestService.guestGetOrder(data.orderId, data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestInitiatePayment')
  async guestInitiatePayment(data: GuestInitiatePaymentRequest) {
    return this.guestService.guestInitiatePayment(data.orderId, data.guestCode, {
      returnUrl: data.returnUrl,
      cancelUrl: data.cancelUrl,
    });
  }
}
```

---

### Step 6: Gateway — Staff endpoints (JWT)

**File: `apps/api-gateway/src/modules/ecommerce/guest/guest.controller.ts`**

```typescript
@Controller('api/v1/guest')
export class GuestController {
  constructor(@Inject('ECOMMERCE_SERVICE') private client?: ClientGrpc) {}

  onModuleInit() {
    this.grpc = this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  @Post('sessions')
  @Permissions(Permission.OrderWrite)
  async createSession(@Body() dto: CreateGuestSessionDto, @CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.createGuestSession({ ...dto, staffId: user.sub }),
    );
  }

  @Post('orders')
  @Permissions(Permission.OrderWrite)
  async createOrder(@Body() dto: CreateGuestOrderDto, @CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.createGuestOrder({
        guestCustomerId: dto.guestCustomerId,
        productId: dto.productId,
        staffId: user.sub,
      }),
    );
  }
}
```

---

### Step 7: Gateway — Tablet endpoints (@Public() + guest_code)

**File: `apps/api-gateway/src/modules/ecommerce/guest/guest-tablet.controller.ts`**

```typescript
@Controller('api/v1/guest-tablet')
export class GuestTabletController {
  constructor(@Inject('ECOMMERCE_SERVICE') private client?: ClientGrpc) {}

  onModuleInit() {
    this.grpc = this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  @Get('sessions/:guestCode')
  @Public()
  async getSession(@Param('guestCode') guestCode: string) {
    return this.call(() => this.grpc!.getGuestSession({ guestCode }));
  }

  @Patch('engravings/:versionId/config')
  @Public()
  async updateConfig(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query('guestCode') guestCode: string,
    @Body() body: any,
  ) {
    return this.call(() =>
      this.grpc!.guestUpdateEngravingConfig({
        engravingVersionId: versionId,
        guestCode,
        ...body,
      }),
    );
  }

  @Patch('orders/:orderId/submit')
  @Public()
  async submitOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body('guestCode') guestCode: string,
  ) {
    return this.call(() =>
      this.grpc!.guestSubmitOrder({ orderId, guestCode }),
    );
  }

  @Get('orders/:orderId')
  @Public()
  async getOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('guestCode') guestCode: string,
  ) {
    return this.call(() =>
      this.grpc!.guestGetOrder({ orderId, guestCode }),
    );
  }

  @Post('orders/:orderId/payments')
  @Public()
  async initiatePayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: { guestCode: string; returnUrl?: string; cancelUrl?: string },
  ) {
    return this.call(() =>
      this.grpc!.guestInitiatePayment({
        orderId,
        guestCode: body.guestCode,
        paymentPhase: 'FULL',
        returnUrl: body.returnUrl ?? '',
        cancelUrl: body.cancelUrl ?? '',
      }),
    );
  }

  @Put('qr-memories/:engravingId')
  @Public()
  async updateQrMemory(
    @Param('engravingId', ParseUUIDPipe) engravingId: string,
    @Body() body: {
      guestCode: string;
      cardTitle?: string;
      greetingMessage?: string;
      recipientEmail?: string;
    },
  ) {
    return this.call(() =>
      this.grpc!.guestUpdateQrMemory({
        engravingId,
        guestCode: body.guestCode,
        cardTitle: body.cardTitle,
        greetingMessage: body.greetingMessage,
        recipientEmail: body.recipientEmail,
      }),
    );
  }
}
```

---

## 6. Status machine — Guest order

### 6.1 Tạo order (Staff)
```
[STAFF]
  1. POST /api/v1/guest/sessions → guest_code
  2. POST /api/v1/guest/orders { guestCustomerId, productId? }
     → Tạo engraving (user_id = staffId) + version v1 + qr_memories + order
     → order.status = AWAITING_SUBMIT
     → order.guest_customer_id = guestId
  3. PATCH engraving version config → selectedBiometrics
  4. POST /api/v1/engravings/:id/biometrics → upload FP/SW/HB
```

### 6.2 Guest submit (lần đầu)
```
[GUEST trên Tablet]
  → Thiết kế (PATCH config, PUT qr-memories...)
  → PATCH /api/v1/guest-tablet/orders/:id/submit
    → AWAITING_SUBMIT → PENDING_REVIEW
```

### 6.3 Manager Review
```
[MANAGER — PATCH /api/v1/orders/:id/review] (dùng chung endpoint hiện có)
  → Approve:
      - Version → APPROVED, engraving → APPROVED
      - Order → AWAITING_DEPOSIT
  → Reject:
      - Version → REJECTED, engraving → REJECTED
      - Tự động tạo version mới (vN+1, copy config, status PENDING)
      - Order → REVISION_REQUIRED
```

### 6.4 Guest resubmit (sau reject)
```
[Staff thông báo cho guest]
  → Guest quay lại tablet, nhập guest_code

[GUEST]
  → GET /api/v1/guest-tablet/sessions/:guestCode
    → Thấy order REVISION_REQUIRED + version mới (PENDING)
  → PATCH config để sửa
  → PATCH /api/v1/guest-tablet/orders/:id/submit
    → REVISION_REQUIRED → PENDING_REVIEW (reset engraving.status = PENDING)
    → isResubmit = true
```

### 6.5 Thanh toán + Sản xuất
```
[GUEST pay FULL]
  → POST /api/v1/guest-tablet/orders/:id/payments
  → Webhook: FULL paid → DEPOSIT_PAID

[SYSTEM]
  → Assign Jeweler → IN_PRODUCTION → PENDING_QC → ... → COMPLETED (MF-05)
```

---

## 7. Guest code validation helper

```typescript
async validateGuestOwnership(guestCode: string, target: {
  engravingVersionId?: string; engravingId?: string; orderId?: string;
}) {
  const guest = await this.prisma.guest_customers.findUniqueOrThrow({
    where: { guest_code: guestCode },
  });

  // Với engravingVersionId / engravingId: kiểm tra qua order.engraving
  if (target.engravingVersionId) {
    const version = await this.prisma.engraving_versions.findUniqueOrThrow({
      where: { id: target.engravingVersionId },
      include: { engraving: { include: { order: true } } },
    });
    const order = version.engraving.order;
    if (!order || order.guest_customer_id !== guest.id) {
      throw new ForbiddenException('Guest does not own this engraving');
    }
  }

  if (target.engravingId) {
    const engraving = await this.prisma.engravings.findUniqueOrThrow({
      where: { id: target.engravingId },
      include: { order: true },
    });
    if (!engraving.order || engraving.order.guest_customer_id !== guest.id) {
      throw new ForbiddenException('Guest does not own this engraving');
    }
  }

  // Với orderId: kiểm tra trực tiếp
  if (target.orderId) {
    const order = await this.prisma.orders.findUniqueOrThrow({
      where: { id: target.orderId },
    });
    if (order.guest_customer_id !== guest.id) {
      throw new ForbiddenException('Guest does not own this order');
    }
  }

  return { guestId: guest.id, guest };
}
```

---

## 8. API Endpoint summary

### Staff endpoints (JWT + OrderWrite)

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/api/v1/guest/sessions` | Tạo guest session |
| `POST` | `/api/v1/guest/orders` | Tạo order + engraving cho guest |

### Tablet endpoints (@Public())

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/api/v1/guest-tablet/sessions/:guestCode` | Guest xem session + order + engraving |
| `PATCH` | `/api/v1/guest-tablet/engravings/:versionId/config?guestCode=XXX` | Guest cập nhật design |
| `PATCH` | `/api/v1/guest-tablet/orders/:orderId/submit` | Guest submit / resubmit |
| `GET` | `/api/v1/guest-tablet/orders/:orderId?guestCode=XXX` | Guest xem order |
| `POST` | `/api/v1/guest-tablet/orders/:orderId/payments` | Guest thanh toán FULL |
| `PUT` | `/api/v1/guest-tablet/qr-memories/:engravingId` | Guest cập nhật QR memory |

---

## 9. Acceptance criteria

| # | Tiêu chí | Verify |
|---|----------|--------|
| 1 | POST /api/v1/guest/sessions (Staff) → tạo guest_customers + guest_code GUE-XXXXXX | curl + check DB |
| 2 | POST /api/v1/guest/orders (Staff) → tạo engraving + version + qr_memories + order (AWAITING_SUBMIT) | curl + check DB |
| 3 | GET /api/v1/guest-tablet/sessions/:guestCode → trả về guest + order + engraving + versions | curl |
| 4 | PATCH /api/v1/guest-tablet/engravings/:vId/config?guestCode=XXX → cập nhật config | curl + check DB |
| 5 | PATCH với guestCode sai → 403 | curl |
| 6 | PATCH /api/v1/guest-tablet/orders/:id/submit (lần đầu) → AWAITING_SUBMIT → PENDING_REVIEW | curl + check DB |
| 7 | Manager PATCH /api/v1/orders/:id/review → approve → AWAITING_DEPOSIT | curl |
| 8 | Manager PATCH /api/v1/orders/:id/review → reject → REVISION_REQUIRED, version mới PENDING copy config | curl + check DB |
| 9 | Guest PATCH config trên version mới sau reject → thành công | curl |
| 10 | Guest PATCH submit (resubmit) → REVISION_REQUIRED → PENDING_REVIEW, engraving.status = PENDING | curl + check DB |
| 11 | Guest submit khi order không phải AWAITING_SUBMIT/REVISION_REQUIRED → 400 | curl |
| 12 | POST /api/v1/guest-tablet/orders/:id/payments (FULL) → trả về paymentUrl, amount = total_price | curl |
| 13 | PayOS webhook FULL paid → order DEPOSIT_PAID | curl mock |
| 14 | Guest A không xem được order của guest B | curl |
| 15 | POST /api/v1/orders/lookup (Public) → guest tra cứu đơn (đã có MF-05) | curl |
| 16 | Swagger docs đầy đủ staff + tablet | check /docs |
| 17 | Build không lỗi | npm run build |

---

## 10. Tác động các flow khác

| Flow | Ảnh hưởng | Mức độ |
|------|-----------|--------|
| MF-02/03 | `handlePayOSWebhook` thêm case FULL | Thấp — chỉ thêm case |
| MF-02/03 | `initiatePayment` thêm FULL phase | Thấp — chỉ thêm allowed phase |
| MF-05 | `POST /orders/lookup` đã có | Không cần sửa |

---

## 11. Out of scope

- ❌ Convert guest → registered user (`converted_user_id`)
- ❌ In QR code vật lý cho guest
- ❌ MF-06 Warranty claim cho guest
- ❌ Notification gửi mail/SMS cho guest (Staff thông báo thủ công)
