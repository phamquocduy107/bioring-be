# MF-02: Delivery Address Integration — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Bổ sung 5 endpoints cho phép customer registered user:
1. Quản lý địa chỉ giao hàng (CRUD `user_addresses`)
2. Chọn phương thức + địa nhận hàng sau khi deposit, trước remaining payment

### Luồng cập nhật
```
[Login] → [Ring Studio] → [Design + Submit] → [Manager Approve]
    ↓
[AWAITING_DEPOSIT] → POST /orders/:id/payments { paymentPhase: 'DEPOSIT_2', returnUrl, cancelUrl }
    ↓ callback success (order → DEPOSIT_PAID)
[DeliveryOptionsScreen] → GET /addresses + POST /addresses + POST /orders/:id/delivery-preference
    ↓ (shipments PENDING, order giữ AWAITING_REMAINING)
[FinalPaymentScreen] → POST /orders/:id/payments { paymentPhase: 'REMAINING', returnUrl, cancelUrl }
    ↓ PayOS webhook → shipment auto-activate (PENDING → ACTIVE) + order → READY_FOR_DELIVERY / READY_FOR_PICKUP
```

### Endpoints

| # | Method | Path | Auth | Body | Mục đích |
|---|--------|------|------|------|----------|
| 1 | `GET` | `/api/v1/addresses` | JWT | — | Danh sách địa chỉ đã lưu |
| 2 | `POST` | `/api/v1/addresses` | JWT | `{ recipientName, phone, fullAddress, ward?, district?, province?, isDefault? }` | Thêm địa chỉ mới |
| 3 | `PUT` | `/api/v1/addresses/:id` | JWT | Partial same as POST | Sửa địa chỉ |
| 4 | `DELETE` | `/api/v1/addresses/:id` | JWT | — | Xoá địa chỉ |
| 5 | `POST` | `/api/v1/orders/:id/delivery-preference` | JWT | `{ addressId, method: 'DELIVERY' \| 'PICKUP' }` | Chọn address + method |

### Field mapping convention
```
Mobile (camelCase)    →    DTO    →    DB (snake_case)
recipientName         →    recipientName     →    recipient_name
phone                 →    phone             →    phone_number
fullAddress           →    fullAddress       →    full_address
ward                  →    ward              →    ward
district              →    district          →    district
province              →    province          →    province
isDefault             →    isDefault         →    is_default
```

Dùng `class-transformer` `@Expose()` + `@Transform()` hoặc mapping thủ công trong service.

### Quy tắc delivery-preference
- Nếu đã có shipment `PENDING` cho order → update thay vì tạo mới
- Order status **không đổi** (vẫn `AWAITING_REMAINING`)
- Khi PayOS webhook confirm REMAINING:
  - Nếu có shipment PENDING → update `status = 'ACTIVE'`
  - Nếu `method = 'DELIVERY'` → order → `READY_FOR_DELIVERY`
  - Nếu `method = 'PICKUP'` → order → `READY_FOR_PICKUP`
- Shipment chỉ được tạo **sau deposit**, trước remaining

---

## 2. File-by-file changes

### 2.1 New files

| # | File path | Mục đích |
|---|-----------|----------|
| 1 | `libs/common/src/dtos/ecommerce/address/create-address.dto.ts` | DTO tạo address |
| 2 | `libs/common/src/dtos/ecommerce/address/update-address.dto.ts` | DTO sửa address |
| 3 | `libs/common/src/dtos/ecommerce/address/address-response.dto.ts` | DTO response address |
| 4 | `libs/common/src/dtos/ecommerce/address/index.ts` | Barrel export |
| 5 | `libs/common/src/dtos/ecommerce/delivery/delivery-preference.dto.ts` | DTO delivery-preference |
| 6 | `libs/common/src/dtos/ecommerce/delivery/delivery-preference-response.dto.ts` | DTO response delivery-preference |
| 7 | `apps/ecommerce-service/src/address/address.module.ts` | Module address |
| 8 | `apps/ecommerce-service/src/address/address.controller.ts` | gRPC controller address |
| 9 | `apps/ecommerce-service/src/address/address.service.ts` | Business logic CRUD user_addresses |
| 10 | `apps/api-gateway/src/modules/ecommerce/address/address.controller.ts` | HTTP routes address |
| 11 | `apps/api-gateway/src/modules/ecommerce/address/address.swagger.ts` | Swagger docs address |

### 2.2 Modified files

| # | File path | Thay đổi |
|---|-----------|----------|
| 1 | `proto/ecommerce.proto` | Thêm `Address`, `CreateAddressRequest`, `UpdateAddressRequest`, `DeleteAddressRequest`, `ListAddressesRequest`, `DeliveryPreferenceRequest` messages + RPCs |
| 2 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | Thêm route `POST :id/delivery-preference` |
| 3 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | Register AddressController |
| 4 | `apps/api-gateway/src/modules/ecommerce/ecommerce.service.ts` | Thêm 5 gRPC methods (list/create/update/delete address + saveDeliveryPreference) |
| 5 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm `@GrpcMethod` cho `SaveDeliveryPreference` |
| 6 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `saveDeliveryPreference()` + sửa webhook handler auto-activate shipment |
| 7 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import AddressModule |

---

## 3. Implementation Steps

### Step 1: Proto messages

Thêm vào `proto/ecommerce.proto`:

```protobuf
// === Address ===
message Address {
  string id = 1;
  string userId = 2;
  string recipientName = 3;
  string phone = 4;
  string fullAddress = 5;
  string ward = 6;
  string district = 7;
  string province = 8;
  bool isDefault = 9;
  string createdAt = 10;
  string updatedAt = 11;
}

message CreateAddressRequest {
  string userId = 1;
  string recipientName = 2;
  string phone = 3;
  string fullAddress = 4;
  string ward = 5;
  string district = 6;
  string province = 7;
  bool isDefault = 8;
}

message UpdateAddressRequest {
  string id = 1;
  string userId = 2;       // ownership check
  string recipientName = 3;
  string phone = 4;
  string fullAddress = 5;
  string ward = 6;
  string district = 7;
  string province = 8;
  bool isDefault = 9;
}

message DeleteAddressRequest {
  string id = 1;
  string userId = 2;
}

message ListAddressesRequest { string userId = 1; }
message ListAddressesResponse { repeated Address addresses = 1; }
message AddressResponse { Address address = 1; }
message DeleteAddressResponse { bool success = 1; }

// === Delivery Preference ===
message SaveDeliveryPreferenceRequest {
  string orderId = 1;
  string addressId = 2;
  string method = 3;       // DELIVERY | PICKUP
}

message SaveDeliveryPreferenceResponse {
  string shipmentId = 1;
  string status = 2;       // PENDING
}
```

Thêm RPCs:

```protobuf
service EcommerceService {
  // Address CRUD
  rpc CreateAddress(CreateAddressRequest) returns (AddressResponse);
  rpc UpdateAddress(UpdateAddressRequest) returns (AddressResponse);
  rpc DeleteAddress(DeleteAddressRequest) returns (DeleteAddressResponse);
  rpc ListAddresses(ListAddressesRequest) returns (ListAddressesResponse);

  // Delivery preference
  rpc SaveDeliveryPreference(SaveDeliveryPreferenceRequest) returns (SaveDeliveryPreferenceResponse);
}
```

### Step 2: DTOs

**`create-address.dto.ts`:**
```typescript
export class CreateAddressDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: '123 Nguyen Hue, Bến Nghé' })
  @IsString()
  @IsNotEmpty()
  fullAddress!: string;

  @ApiPropertyOptional({ example: 'Bến Nghé' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'TP Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
```

**`update-address.dto.ts`:** Same fields, all optional.

**`address-response.dto.ts`:** `{ id, userId, recipientName, phone, fullAddress, ward, district, province, isDefault, createdAt, updatedAt }`

**`delivery-preference.dto.ts`:**
```typescript
export class DeliveryPreferenceDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  addressId!: string;

  @ApiProperty({ enum: ['DELIVERY', 'PICKUP'] })
  @IsIn(['DELIVERY', 'PICKUP'])
  method!: string;
}
```

**`delivery-preference-response.dto.ts`:** `{ shipmentId: string, status: string }`

### Step 3: Address Service

`apps/ecommerce-service/src/address/address.service.ts`:

```typescript
@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.user_addresses.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async create(userId: string, data: CreateAddressInput) {
    // Nếu isDefault = true → unset các default cũ
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.user_addresses.updateMany({
          where: { user_id: userId, is_default: true },
          data: { is_default: false },
        });
      }
      return tx.user_addresses.create({
        data: {
          id: randomUUID(),
          user_id: userId,
          recipient_name: data.recipientName,
          phone_number: data.phone,
          full_address: data.fullAddress,
          ward: data.ward,
          district: data.district,
          province: data.province,
          is_default: data.isDefault ?? false,
        },
      });
    });
  }

  async update(id: string, userId: string, data: UpdateAddressInput) {
    // ownership check + isDefault handling
  }

  async delete(id: string, userId: string) {
    // ownership check
  }
}
```

### Step 4: Order Service — `saveDeliveryPreference()`

```typescript
async saveDeliveryPreference(orderId: string, addressId: string, method: string) {
  const order = await this.prisma.orders.findUniqueOrThrow({
    where: { id: orderId },
  });

  // Chỉ cho phép khi order đã deposit và chưa pay remaining
  if (order.status !== 'AWAITING_REMAINING') {
    throw new GrpcException('Invalid order status', 3 /* INVALID_ARGUMENT */);
  }

  const existing = await this.prisma.shipments.findFirst({
    where: { order_id: orderId, status: 'PENDING' },
  });

  if (existing) {
    const updated = await this.prisma.shipments.update({
      where: { id: existing.id },
      data: {
        address_id: addressId,
        delivery_method: method,
      },
    });
    return { shipmentId: updated.id, status: updated.status! };
  }

  const shipment = await this.prisma.shipments.create({
    data: {
      id: randomUUID(),
      order_id: orderId,
      address_id: addressId,
      delivery_method: method,
      status: 'PENDING',
    },
  });

  return { shipmentId: shipment.id, status: shipment.status! };
}
```

### Step 5: Webhook handler — auto-activate shipment

Trong `handlePayOSWebhook` / `manualPayment` khi `paymentPhase === 'REMAINING'`:

```typescript
// Sau khi update order status
const shipment = await this.prisma.shipments.findFirst({
  where: { order_id: order.id, status: 'PENDING' },
});

if (shipment) {
  const updatedOrderStatus = shipment.delivery_method === 'DELIVERY'
    ? 'READY_FOR_DELIVERY'
    : 'READY_FOR_PICKUP';

  await this.prisma.$transaction([
    this.prisma.shipments.update({
      where: { id: shipment.id },
      data: { status: 'ACTIVE' },
    }),
    this.prisma.orders.update({
      where: { id: order.id },
      data: { status: updatedOrderStatus },
    }),
  ]);
}
```

### Step 6: Address Controller (API Gateway)

`apps/api-gateway/src/modules/ecommerce/address/address.controller.ts`:

```
@Controller('api/v1/addresses')
export class AddressController {
  @Get()      → listUserAddresses
  @Post()     → createAddress
  @Put(':id') → updateAddress
  @Delete(':id') → deleteAddress
}
```

Tất cả đều JWT-auth (không cần permission riêng). Ownership check qua `@CurrentUser().sub`.

### Step 7: Delivery Preference Route

Thêm vào `order.controller.ts`:

```
@Post(':id/delivery-preference')
@ApiOperation({ summary: 'Save delivery preference (address + method) after deposit' })
async saveDeliveryPreference(
  @Param('id') id: string,
  @Body() dto: DeliveryPreferenceDto,
  @CurrentUser() user: JwtPayload,
) {
  // gRPC call → SaveDeliveryPreference
}
```

---

## 4. Summary

| Hạng mục | Files | Dòng ước tính |
|----------|-------|---------------|
| Proto messages + RPCs | 1 | ~80 |
| DTOs (5 files) | 5 | ~120 |
| Address service + controller (ecommerce) | 3 | ~150 |
| Address controller (gateway) + swagger | 2 | ~100 |
| Order service (saveDeliveryPreference + webhook) | 1 | ~60 |
| Delivery-preference route (gateway) | 1 | ~30 |
| Module imports | 2 | ~10 |
| **Tổng** | **~15** | **~550** |

### Không thay đổi
- `POST /orders/:id/payments` — đã có, xài cho deposit + remaining
- `shipments` table schema — không cần thêm column
- `user_addresses` table — đã có sẵn
