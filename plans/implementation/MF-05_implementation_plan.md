# MF-05: Delivery, Pickup & QR Memory — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Quản lý khâu hậu mãi sau sản xuất: Manager nghiệm thu sản phẩm, giao/nhận hàng, kích hoạt bảo hành, kích hoạt QR Memory.

Các flow được hỗ trợ:
| Flow | Trạng thái cuối Jeweler | Thanh toán còn lại |
|------|------------------------|-------------------|
| MF-02 (Online SW) | IN_PRODUCTION | Còn nợ → cần trả trước nhận |
| MF-03 (Offline có FP/HB) | IN_PRODUCTION | Còn nợ → cần trả trước nhận |
| MF-04 (Walk-in) | IN_PRODUCTION | Đã trả Full → không còn nợ |

### Actors
- **Manager (Web Dashboard)**: Nghiệm thu sản phẩm thực tế (QC check), confirm ready
- **Store Staff (Web Dashboard)**: Xác nhận pickup tại cửa hàng
- **Delivery Staff (Web Dashboard)**: Nhận việc giao, cập nhật tracking
- **Customer (App)**: Nhận thông báo, track delivery, quét QR Memory
- **System**: Sinh warranty, activate QR Memory, gửi notification

### Luồng chính
```
Jeweler completes task (IN_PRODUCTION)
  → Manager QC Accept (PENDING_QC → READY_FOR_DELIVERY)
       → [nếu còn nợ] Pay remaining → READY_FOR_DELIVERY
       → Chọn hình thức:
             ├── Store Pickup → READY_FOR_PICKUP → Staff confirm nhận → DELIVERED + warranty + unlock QR → COMPLETED
             └── Internal Delivery → (vẫn READY_FOR_DELIVERY) → Staff start delivery → SHIPPING → confirm nhận → DELIVERED + warranty + unlock QR → COMPLETED
       → QR Memory có thể kích hoạt bất kỳ lúc nào sau COMPLETED (hoặc sau khi chủ sở hữu unlock)
```

---

## 2. Thay đổi Schema

### 2.1 `orders` — thêm status mới

| Status | Ý nghĩa |
|--------|---------|
| `PENDING_QC` | Jeweler đã hoàn thành, chờ Manager kiểm tra thực tế |
| `READY_FOR_DELIVERY` | Manager đã nghiệm thu OK, chờ khách trả tiền còn lại |
| `SHIPPING` | Đang vận chuyển nội bộ |
| `READY_FOR_PICKUP` | Sẵn sàng để khách đến lấy |
| `DELIVERED` | Đã bàn giao hàng cho khách (pickup hoặc giao tận nơi) |

### 2.2 Order status machine (đầy đủ)

```
AWAITING_SUBMIT
  → PENDING_REVIEW ↔ REVISION_REQUIRED
    → AWAITING_DEPOSIT
      → DEPOSIT_PAID
        → IN_PRODUCTION
          → PENDING_QC (mới) ←─── Jeweler completes
            → READY_FOR_DELIVERY (mới) ←── Manager Accept
              → [nếu còn nợ] AWAITING_REMAINING
                → (trả REMAINING) → READY_FOR_DELIVERY
              → InitiateDelivery (PICKUP) → READY_FOR_PICKUP
              → InitiateDelivery (DELIVERY) → vẫn READY_FOR_DELIVERY (chờ staff start)
                → Staff start delivery → SHIPPING (mới)
              → Staff confirm nhận → DELIVERED (mới) + warranty + unlock QR → COMPLETED

### 2.3 Enum updates

**`order-status.enum.ts`:**
```typescript
export enum OrderStatus {
  AWAITING_SUBMIT = 'AWAITING_SUBMIT',
  AWAITING_DEPOSIT_1 = 'AWAITING_DEPOSIT_1',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  AWAITING_DEPOSIT = 'AWAITING_DEPOSIT',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  IN_PRODUCTION = 'IN_PRODUCTION',
  PENDING_QC = 'PENDING_QC',              // THÊM
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY', // THÊM
  SHIPPING = 'SHIPPING',                  // THÊM
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',  // THÊM
  DELIVERED = 'DELIVERED',                // THÊM
  AWAITING_REMAINING = 'AWAITING_REMAINING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
```

**Schema Prisma:** Các bảng `shipments`, `pickup_records`, `qa_checks`, `warranties` đã có sẵn. Cần thêm column `lookup_code` vào `orders` (xem section 5.4).

---

## 3. API Endpoints

### 3.1 Manager QC Accept

```
PUT /api/v1/orders/:orderId/qc-accept
Authorization: Bearer <manager-token>
```

**Mô tả:** Manager xác nhận sản phẩm thực tế OK sau khi Jeweler hoàn thành.

**Request:**
```json
{
  "result": "PASS",               // PASS | FAIL
  "checklist": {"engraving": true, "material": true, "size": true},
  "proofImages": ["https://cloudinary.com/img1.jpg"],
  "note": "Sản phẩm đạt yêu cầu"
}
```

**Logic:**
1. Order phải ở `IN_PRODUCTION` và `production_task.completed_at` != null
2. Tạo `qa_checks` record mới (cả PASS và FAIL đều ghi lại lịch sử)
3. Nếu `result = "PASS"`:
   - Order → `READY_FOR_DELIVERY`
   - Notify customer (App/Email)
4. Nếu `result = "FAIL"`:
   - Order → `IN_PRODUCTION` (quay lại sản xuất)
   - `production_task.status` → `IN_PROGRESS` (sửa lại)
   - Ghi `manager_note` để Jeweler biết cần sửa gì

**Allow:** Chỉ Manager (`@Permissions(Permission.OrderWrite)`)

### 3.2 Initiate Delivery

```
POST /api/v1/orders/:orderId/delivery
Authorization: Bearer <manager-token>
```

**Request:**
```json
{
  "deliveryMethod": "PICKUP",           // PICKUP | DELIVERY
  "recipientName": "Nguyen Van A",
  "recipientPhone": "0909123456",
  "addressId": "ADDRESS_ID",            // chỉ cho DELIVERY
  "shippingAddressText": "123 đường ABC" // chỉ cho DELIVERY
}
```

**Logic:**
1. Order phải ở `READY_FOR_DELIVERY`
2. Kiểm tra `remainingAmount`:
   - Nếu `remainingAmount > 0`: order → `AWAITING_REMAINING` (yêu cầu thanh toán trước)
   - Nếu `remainingAmount = 0`: tiếp tục
3. Tạo `shipments` record
4. Nếu `PICKUP`: order → `READY_FOR_PICKUP` (chờ staff confirm nhận)
5. Nếu `DELIVERY`: giữ nguyên `READY_FOR_DELIVERY` — chỉ tạo shipment, chờ staff bắt đầu giao

### 3.3 Start Delivery (chỉ DELIVERY)

```
PUT /api/v1/orders/:orderId/delivery/start
Authorization: Bearer <staff-token>
```

**Mô tả:** Staff xác nhận bắt đầu giao hàng. Chỉ áp dụng cho DELIVERY.

**Logic:**
1. Order phải ở `READY_FOR_DELIVERY`, shipments.delivery_method = "DELIVERY"
2. Order → `SHIPPING`

### 3.4 Update Shipment Status

```
PUT /api/v1/orders/:orderId/shipment/status
Authorization: Bearer <staff-token>
```

**Mô tả:** Cập nhật trạng thái shipment. Gộp start delivery + confirm delivery thành 1 API. Server tự biết transition dựa vào `delivery_method` của shipment.

**Request (chung cho cả PICKUP và DELIVERY):**
```json
{
  "status": "SHIPPING",
  "receiverName": "Nguyen Van A",
  "receiverPhone": "0909123456",
  "identityNote": "CMND 123456789",
  "proofImageUrl": "https://cloudinary.com/proof.jpg",
  "trackingCode": "BIORING-DEL-001"
}
```

**Logic chung:**
1. Tìm shipment theo `order_id`
2. Server validate transition dựa trên `delivery_method`:
   - **SHIPPING**: chỉ khi DELIVERY, shipment `PENDING`, order `READY_FOR_DELIVERY` → order `SHIPPING`
   - **DELIVERED**:
     - Nếu PICKUP: order `READY_FOR_PICKUP` → tạo `pickup_records` → order `DELIVERED`
     - Nếu DELIVERY: order `SHIPPING` → update `tracking_code`, `delivered_at` → order `DELIVERED`
3. Sau khi `DELIVERED` → tự động gọi `completeOrder`: tạo warranty + unlock QR → `COMPLETED`

### 3.5 Activate Warranty (tự động)

Khi order chuyển từ `DELIVERED` → `COMPLETED`, system tự động:

1. Tạo `warranties` record:
```sql
INSERT INTO warranties (id, engraving_id, order_id, warranty_code, warranty_type,
                        issue_format, warranty_scope, issue_date, expiry_date,
                        activated_at, status)
VALUES (
  gen_random_uuid(),
  order.engraving_id,
  order.id,
  'WAR-' || order.order_code,              -- warranty_code
  'STANDARD',                               -- warranty_type
  'DIGITAL',                                -- issue_format
  '{"description": "1 năm bảo hành chính hãng", "coverage": ["manufacturing_defect"]}',
  NOW(),                                    -- issue_date
  NOW() + INTERVAL '1 year',               -- expiry_date
  NOW(),                                    -- activated_at
  'ACTIVE'
);
```

2. Cập nhật `qr_memories.is_locked = false` nếu đã kích hoạt bởi chủ sở hữu.

**Lưu ý:** Warranty có `engraving_id @unique` — 1 engraving chỉ có 1 warranty.

### 3.6 Remaining Payment webhook — bổ sung logic

**Endpoint:** `POST /api/v1/orders/:orderId/payments { paymentPhase: "REMAINING" }`

Đã có sẵn ở MF-02/MF-03. Cần sửa `handlePayOSWebhook`:

Khi webhook nhận `REMAINING` payment, chuyển order từ `AWAITING_REMAINING` → `READY_FOR_DELIVERY`:
```typescript
if (payment.payment_phase === 'REMAINING') {
  newStatus = 'READY_FOR_DELIVERY';
}
```
**Logic:** REMAINING chỉ cập nhật số tiền. Sau khi trả hết, order về `READY_FOR_DELIVERY` — chờ Manager chọn hình thức giao/nhận qua `initiateDelivery`. Không tự động suy từ shipment vì lúc này chưa biết delivery method.

### 3.7 Order Lookup (cho Walk-in Guest — MF-04)

```
POST /api/v1/orders/lookup
Content-Type: application/json

{
  "orderCode": "BIORING-ABC123"
}
```

**Mô tả:** Cho khách vãng lai (không tài khoản) tra cứu đơn hàng bằng mã `order_code`.

**Logic:**
- Tìm `orders` theo `order_code`
- Trả về thông tin cơ bản: status, delivery info, warranty info
- `lookup_code` dùng luôn `order_code` — không cần column riêng

### 3.8 Get Warranty Info

```
GET /api/v1/warranties/:orderId
Authorization: Bearer <customer-token>
```

**Mô tả:** Customer xem thông tin bảo hành của đơn hàng.

**Response:**
```json
{
  "warranty": {
    "id": "WAR_ID",
    "warrantyCode": "WAR-BIORING-ABC123",
    "warrantyType": "STANDARD",
    "issueDate": "2026-07-02T00:00:00.000Z",
    "expiryDate": "2027-07-02T00:00:00.000Z",
    "status": "ACTIVE",
    "warrantyScope": {"description": "1 năm bảo hành chính hãng"}
  }
}
```

### 3.9 Get Delivery Info

```
GET /api/v1/orders/:orderId/delivery
Authorization: Bearer <customer-token>
```

**Mô tả:** Xem thông tin giao hàng: phương thức, tracking, trạng thái, staff info.

### 3.10 Get Production & QC Info

```
GET /api/v1/orders/:orderId/production
Authorization: Bearer <customer-token>
```

**Mô tả:** Xem thông tin sản xuất (jeweler, task status) + QC result (checklist, proof images).

---

## 4. Logic chi tiết

### 4.1 Sửa `updateProductionStatus`

Hiện tại khi task `COMPLETED`:
```typescript
if (status === 'COMPLETED') {
  const order = await this.prisma.orders.findUnique({
    where: { id: task.order_id },
  });
  const remainingAmount = Number(order?.remaining_amount ?? 0);
  if (remainingAmount > 0) {
    await this.prisma.orders.update({
      where: { id: task.order_id },
      data: { status: 'AWAITING_REMAINING' },
    });
  } else {
    await this.prisma.orders.update({
      where: { id: task.order_id },
      data: { status: 'COMPLETED' },
    });
  }
}
```

Sửa thành:
```typescript
if (status === 'COMPLETED') {
  await this.prisma.orders.update({
    where: { id: task.order_id },
    data: { status: 'PENDING_QC' },
  });
}
```

### 4.2 `updateShipmentStatus` — cập nhật trạng thái giao/nhận + tự động complete

Gộp start delivery và confirm delivery thành 1 method. Server tự biết transition dựa vào `delivery_method` + `status` hiện tại:

```typescript
async updateShipmentStatus(orderId: string, data: {
  status: string;  // SHIPPING | DELIVERED
  receiverName?: string;
  receiverPhone?: string;
  identityNote?: string;
  proofImageUrl?: string;
  trackingCode?: string;
  staffId: string;
}) {
  const shipment = await this.prisma.shipments.findFirst({
    where: { order_id: orderId },
    include: { orders: true },
  });
  if (!shipment) throw new NotFoundException('Shipment not found');

  const order = shipment.orders;
  const deliveryMethod = shipment.delivery_method;

  if (data.status === 'SHIPPING') {
    // Chỉ DELIVERY mới có SHIPPING
    if (deliveryMethod !== 'DELIVERY') throw new BadRequestException('...');
    if (order.status !== 'READY_FOR_DELIVERY') throw new BadRequestException('...');

    await this.prisma.shipments.update({
      where: { id: shipment.id },
      data: { status: 'SHIPPING' },
    });
    await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: 'SHIPPING' },
    });
    return this.getOrder(orderId);
  }

  if (data.status === 'DELIVERED') {
    // PICKUP: order phải READY_FOR_PICKUP
    if (deliveryMethod === 'PICKUP') {
      if (order.status !== 'READY_FOR_PICKUP') throw new BadRequestException('...');
      await this.prisma.pickup_records.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          store_staff_id: data.staffId,
          receiver_name: data.receiverName,
          receiver_phone: data.receiverPhone,
          identity_note: data.identityNote,
          proof_image_url: data.proofImageUrl,
          picked_up_at: new Date(),
        },
      });
    }

    // DELIVERY: order phải SHIPPING
    if (deliveryMethod === 'DELIVERY') {
      if (order.status !== 'SHIPPING') throw new BadRequestException('...');
      await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          status: 'DELIVERED',
          tracking_code: data.trackingCode,
          delivered_at: new Date(),
        },
      });
    }

    // DELIVERED → tự động complete: warranty + unlock QR + COMPLETED
    return this.completeOrder(orderId);
  }

  throw new BadRequestException('Status must be SHIPPING or DELIVERED');
}

async completeOrder(orderId: string) {
  const order = await this.prisma.orders.findUnique({
    where: { id: orderId },
    include: { engraving: true },
  });

  // 1. Activate warranty
  await this.prisma.warranties.create({
    data: {
      id: randomUUID(),
      engraving_id: order.engraving.id,
      order_id: order.id,
      warranty_code: `WAR-${order.order_code}`,
      warranty_type: 'STANDARD',
      issue_format: 'DIGITAL',
      warranty_scope: { description: '1 năm bảo hành chính hãng', coverage: ['manufacturing_defect'] },
      issue_date: new Date(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      activated_at: new Date(),
      status: 'ACTIVE',
    },
  });

  // 2. Unlock qr_memories (nếu chưa unlock)
  await this.prisma.qr_memories.updateMany({
    where: { engraving_id: order.engraving.id, is_locked: true },
    data: { is_locked: false },
  });

  // 3. Complete order
  return this.prisma.orders.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' },
  });
}
```

### 4.3 Ràng buộc `READY_FOR_DELIVERY`

Các ràng buộc PATCH config, PUT qr-memories, POST biometrics đã được xử lý bởi guard trong engraving service (block khi đã có order). Cần verify:

- `POST payments (REMAINING)` — cho phép ở `READY_FOR_DELIVERY` hoặc `AWAITING_REMAINING`
- `POST delivery` — cho phép ở `READY_FOR_DELIVERY` (chỉ Manager)

---

## 5. File-by-file changes

### 5.1 Proto — `proto/ecommerce.proto`

Thêm các RPC mới:
```protobuf
service EcommerceService {
  // ... existing RPCs

  // MF-05
  rpc QcAcceptOrder (QcAcceptOrderRequest) returns (GetOrderResponse);
  rpc InitiateDelivery (InitiateDeliveryRequest) returns (DeliveryResponse);
  rpc UpdateShipmentStatus (UpdateShipmentStatusRequest) returns (GetOrderResponse);
  rpc GetDeliveryInfo (GetDeliveryInfoRequest) returns (DeliveryResponse);
  rpc GetDeliveryInfo (GetDeliveryInfoRequest) returns (DeliveryResponse);
  rpc GetWarrantyInfo (GetWarrantyInfoRequest) returns (WarrantyResponse);
  rpc GetProductionInfo (GetProductionInfoRequest) returns (GetProductionInfoResponse);
}

message QcAcceptOrderRequest {
  string orderId = 1;
  string result = 2;        // PASS | FAIL
  string checklist = 3;     // JSON string
  repeated string proofImages = 4;
  string note = 5;
  string managerId = 6;
}

message InitiateDeliveryRequest {
  string orderId = 1;
  string deliveryMethod = 2;  // PICKUP | DELIVERY
  string recipientName = 3;
  string recipientPhone = 4;
  string addressId = 5;
  string shippingAddressText = 6;
}

message StartDeliveryRequest { string orderId = 1; string staffId = 2; }

message UpdateShipmentStatusRequest {
  string orderId = 1;
  string status = 2;         // SHIPPING | DELIVERED
  string receiverName = 3;
  string receiverPhone = 4;
  string identityNote = 5;
  string proofImageUrl = 6;
  string trackingCode = 7;
  string staffId = 8;
}

message DeliveryResponse {
  string id = 1;
  string orderId = 2;
  string deliveryMethod = 3;
  string status = 4;
  string trackingCode = 5;
  string trackingUrl = 6;
  string recipientName = 7;
  string recipientPhone = 8;
  string shippingAddressText = 9;
  string estimatedDeliveryAt = 10;
  string deliveredAt = 11;
  string createdAt = 12;
}

message WarrantyResponse {
  string id = 1;
  string engravingId = 2;
  string orderId = 3;
  string warrantyCode = 4;
  string warrantyType = 5;
  string issueDate = 6;
  string expiryDate = 7;
  string activatedAt = 8;
  string status = 9;
  string warrantyScope = 10;
}

message GetDeliveryInfoRequest { string orderId = 1; }
message GetWarrantyInfoRequest { string orderId = 1; }

message GetProductionInfoRequest { string orderId = 1; }
message GetProductionInfoResponse {
  ProductionTask task = 1;
  QaCheck qaCheck = 1;
}
message QaCheck {
  string id = 1;
  string orderId = 2;
  string result = 3;
  string checklist = 4;
  repeated string proofImages = 5;
  string note = 6;
  string checkedAt = 7;
  string checkedByManagerId = 8;
}
```

### 5.2 DTOs — `libs/common/src/dtos/ecommerce/`

Tạo các DTO mới:
```
delivery/
  qc-accept-order.dto.ts
  initiate-delivery.dto.ts
  update-shipment-status.dto.ts
  order-lookup.dto.ts
```

### 5.3 Enum — `order-status.enum.ts` và `shipment-status.enum.ts`

**`order-status.enum.ts`** — thêm các status mới:
```typescript
export enum OrderStatus {
  // ... existing ...
  PENDING_QC = 'PENDING_QC',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  SHIPPING = 'SHIPPING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  DELIVERED = 'DELIVERED',
}
```

**`libs/common/src/enums/shipment-status.enum.ts`** — tạo mới:
```typescript
export enum ShipmentStatus {
  PENDING = 'PENDING',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
}
```

### 5.4 Prisma — `schema.prisma`

Không cần thay đổi schema. Các bảng `shipments`, `pickup_records`, `qa_checks`, `warranties` đã có sẵn. `lookup_code` dùng luôn `orders.order_code` — không cần column mới.

### 5.5 Order Service — `order.service.ts`

**Thêm methods:**

| Method | Mô tả |
|--------|-------|
| `qcAcceptOrder(orderId, result, checklist, proofImages, note, managerId)` | Manager QC accept/reject |
| `initiateDelivery(orderId, deliveryData)` | Tạo shipment / chuẩn bị pickup |
| `updateShipmentStatus(orderId, status, ...)` | Gộp start delivery + confirm delivery. Server tự validate transition |
| `completeOrder(orderId)` | Kích hoạt warranty + unlock QR + COMPLETED |
| `getDeliveryInfo(orderId)` | Tra cứu thông tin giao hàng |
| `getWarrantyInfo(orderId)` | Tra cứu thông tin bảo hành |
| `lookupOrder(lookupCode)` | Tra cứu đơn cho walk-in guest |

**Sửa existing methods:**

| Method | Thay đổi |
|--------|----------|
| `updateProductionStatus` | Task COMPLETED → `PENDING_QC` (thay vì `AWAITING_REMAINING`/`COMPLETED`) |
| `mapOrder` | Thêm `lookupCode`, `status` mới vào map |
| `mapOrderFull` | Thêm `shipments`, `pickupRecords`, `qaChecks`, `warranty` vào include + map |

### 5.6 Ecommerce Controller — `order.controller.ts`

Thêm các RPC handlers tương ứng.

### 5.7 Gateway Controller — `order.controller.ts`

Thêm routes mới:

| Route | Handler |
|-------|---------|
| `PUT /api/v1/orders/:orderId/qc-accept` | `qcAccept` |
| `POST /api/v1/orders/:orderId/delivery` | `initiateDelivery` |
| `PUT /api/v1/orders/:orderId/shipment/status` | `updateShipmentStatus` |
| `GET /api/v1/orders/:orderId/delivery` | `getDeliveryInfo` |
| `GET /api/v1/warranties/:orderId` | `getWarrantyInfo` |
| `POST /api/v1/orders/lookup` | `lookupOrder` |
| `GET /api/v1/orders/:orderId/production` | `getProductionInfo` |

### 5.8 Ecommerce Module

Đăng ký `WarrantyService` (nếu tách riêng) hoặc để trong `OrderService`.

### 5.9 Swagger — `order.swagger.ts`

Thêm docs cho các endpoint mới.

---

## 6. Gatecheck / Constraints

### 6.1 QC Accept — chỉ cho phép khi:
- Order status = `IN_PRODUCTION`
- Production task có `completed_at` != null (đã hoàn thành)
- Chỉ Manager mới được gọi

### 6.2 Initiate Delivery — chỉ cho phép khi:
- Order status = `READY_FOR_DELIVERY`
- Chưa có shipment record nào cho order này
- Nếu `remainingAmount > 0`: order → `AWAITING_REMAINING` (chờ thanh toán trước khi giao)
- Nếu `remainingAmount = 0`: tiếp tục (không chuyển status, chờ tiếp bước)

### 6.3 Update Shipment Status — validate transition theo `delivery_method`:
- **SHIPPING**: chỉ DELIVERY, shipment đang `PENDING`, order `READY_FOR_DELIVERY`
- **DELIVERED (PICKUP)**: order `READY_FOR_PICKUP`
- **DELIVERED (DELIVERY)**: order `SHIPPING`
- Chỉ Staff mới được gọi

### 6.4 Warranty — chỉ tạo 1 lần:
- `warranties.engraving_id` unique → không thể tạo 2 warranty cho 1 engraving

### 6.5 Order Lookup:
- `order_code` unique trên orders
- Guest lookup không yêu cầu auth (`@Public()`)
- Trả về thông tin limited (không trả về payment details)

---

## 7. Thứ tự implement

1. **Schema + Enum** — thêm status mới (không cần migration, chỉ thêm giá trị enum)
2. **Proto** — thêm messages + RPCs (`GetOrderResponse` thay vì `OrderResponse`)
3. **DTOs** — tạo DTOs cho endpoint mới
4. **Order Service** — implement `qcAcceptOrder`, `initiateDelivery`, `confirmDelivery`, `completeOrder` (gọi từ confirm)
5. **Order Service** — sửa `updateProductionStatus` (task complete → `PENDING_QC`)
6. **Order Service** — thêm `getDeliveryInfo`, `getWarrantyInfo`, `getProductionInfo`
7. **Ecommerce Controller** — thêm RPC handlers
8. **Gateway Controller** — thêm routes + interface
9. **Swagger** — docs cho endpoint mới
10. **Sửa handlePayOSWebhook** — REMAINING → `READY_FOR_DELIVERY`
11. **Build** — verify ecommerce-service + api-gateway

---

## 8. Phụ thuộc

| Phụ thuộc vào | Lý do |
|---------------|-------|
| MF-02/MF-03 | Cần đơn hàng hoàn chỉnh để bắt đầu MF-05 |
| Notification system | Cần notify customer khi `READY_FOR_DELIVERY` — nếu chưa có, có thể bỏ qua tạm |

**Không phụ thuộc MF-04.** `lookup_code` dùng luôn `order_code`, không cần column mới.

---

## 9. Notes

- `activateQrMemory` endpoint đã có sẵn — không cần implement lại
- `shipments` + `pickup_records` + `qa_checks` + `warranties` models đã có trong schema — chỉ cần dùng
- Cần xem xét notification (push/email) — nếu chưa có, tạm thời bỏ qua, chỉ update order status
- `assignJeweler` + `updateProductionStatus` đã có sẵn — chỉ cần sửa logic chuyển status
