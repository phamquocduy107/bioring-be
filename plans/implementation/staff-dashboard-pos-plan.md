# Staff Dashboard Backend — POS Manual Payment & Customer Lookup

## 1. Customer Lookup API

### Mục tiêu
Staff nhập email → hệ thống check xem là Member hay Walk-in, trả về lịch sử khách hàng.

### Endpoint

```
GET /api/v1/customers/lookup?email=xxx
Authorization: Bearer <staff-token> (Permission.OrderWrite)
```

### Response

**Walk-in (đã từng đến):**
```json
{
  "type": "walk-in",
  "member": null,
  "guest": {
    "id": "G1",
    "guestCode": "GUE-A7B9X2",
    "fullName": "Nguyễn Văn A",
    "phone": "0909123456",
    "email": "guest@example.com",
    "orderCount": 2,
    "lastOrderAt": "2026-07-07T..."
  }
}
```

**Member (đã đăng ký app):**
```json
{
  "type": "member",
  "member": {
    "id": "U1",
    "fullName": "Nguyễn Văn A",
    "email": "user@gmail.com",
    "phone": "0909123456",
    "orderCount": 5,
    "activeOrders": 1
  },
  "guest": {
    "id": "G1",
    "guestCode": "GUE-A7B9X2",
    "convertedAt": "2026-07-07T..."
  }
}
```

**Mới hoàn toàn:**
```json
{ "type": "new" }
```

### Logic

```typescript
async lookupCustomer(email: string) {
  // 1. Check users
  const user = await this.prisma.users.findUnique({
    where: { email },
    include: { _count: { select: { orders: true } } },
  });

  if (user) {
    const guest = await this.prisma.guest_customers.findFirst({
      where: { email, converted_user_id: user.id },
    });
    return {
      type: 'member',
      member: { id: user.id, fullName: user.full_name, email: user.email, phone: user.phone, orderCount: user._count.orders },
      guest: guest ? { id: guest.id, guestCode: guest.guest_code, convertedAt: guest.created_at } : null,
    };
  }

  // 2. Check guest_customers
  const guest = await this.prisma.guest_customers.findFirst({
    where: { email },
    orderBy: { created_at: 'desc' },
    include: { orders: { select: { created_at: true } } },
  });

  if (guest) {
    return {
      type: 'walk-in',
      member: null,
      guest: {
        id: guest.id, guestCode: guest.guest_code,
        fullName: guest.full_name, phone: guest.phone, email: guest.email,
        orderCount: guest.orders?.length ?? 0,
        lastOrderAt: guest.orders?.[0]?.created_at?.toISOString() ?? null,
      },
    };
  }

  return { type: 'new' };
}
```

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/customer/customer.module.ts` | Module mới |
| 2 | `apps/ecommerce-service/src/customer/customer.service.ts` | Lookup logic |
| 3 | `apps/ecommerce-service/src/customer/customer.controller.ts` | gRPC |
| 4 | `apps/api-gateway/.../customer/customer.controller.ts` | REST |
| 5 | `apps/api-gateway/.../customer/customer.swagger.ts` | Swagger |
| 6 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import |
| 7 | `apps/api-gateway/.../ecommerce.module.ts` | Register |
| 8 | `proto/ecommerce.proto` | RPC + messages |

---

## 2. POS Manual Payment API

### Mục tiêu
Staff xác nhận đã nhận tiền mặt / chuyển khoản từ khách. Backend tạo payment record `method: 'MANUAL'` và cập nhật order status.

### Endpoint

```
POST /api/v1/orders/:id/payments/manual
Authorization: Bearer <staff-token> (Permission.OrderWrite)
```

### Request

```json
{
  "paymentPhase": "DEPOSIT_1",
  "amount": 100000
}
```

### Logic

```typescript
async manualPayment(orderId: string, data: {
  paymentPhase: string;
  amount: number;
  receivedBy: string;
}) {
  const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundException('Order not found');

  const allowedPhases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'];
  if (!allowedPhases.includes(data.paymentPhase)) {
    throw new BadRequestException(`Invalid paymentPhase: ${data.paymentPhase}`);
  }

  // Tạo payment record (method = MANUAL, status = PAID luôn)
  const payment = await this.prisma.payments.create({
    data: {
      id: randomUUID(),
      order_id: orderId,
      payment_code: `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      payment_phase: data.paymentPhase,
      amount: data.amount,
      method: 'MANUAL',
      status: 'PAID',
      paid_at: new Date(),
    },
  });

  // Update order (giống webhook logic)
  const newPaidAmount = Number(order.paid_amount ?? 0) + data.amount;
  const totalPrice = Number(order.total_price ?? 0);
  const remainingAmount = totalPrice - newPaidAmount;

  let newStatus = order.status;
  if (data.paymentPhase === 'DEPOSIT_1') newStatus = 'AWAITING_SUBMIT';
  else if (data.paymentPhase === 'DEPOSIT_2') newStatus = 'DEPOSIT_PAID';
  else if (data.paymentPhase === 'FULL') newStatus = 'DEPOSIT_PAID';
  else if (data.paymentPhase === 'REMAINING') newStatus = 'READY_FOR_DELIVERY';

  const updated = await this.prisma.orders.update({
    where: { id: orderId },
    data: {
      paid_amount: newPaidAmount,
      remaining_amount: remainingAmount >= 0 ? remainingAmount : 0,
      status: newStatus,
    },
  });

  // Emit event cho notification
  if (newStatus === 'DEPOSIT_PAID' || newStatus === 'READY_FOR_DELIVERY') {
    this.eventEmitter.emit('payment.confirmed', { orderId });
  }

  return { payment, order: await this.mapOrder(updated) };
}
```

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `manualPayment()` |
| 2 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm gRPC handler |
| 3 | `apps/api-gateway/.../order/order.controller.ts` | `POST /:id/payments/manual` |
| 4 | `apps/api-gateway/.../order/order.swagger.ts` | Swagger docs |
| 5 | `proto/ecommerce.proto` | RPC + messages |
| 6 | `libs/common/src/dtos/ecommerce/payment/manual-payment.dto.ts` | DTO |

---

## 3. Payment Status API

### Mục tiêu
Staff xem trạng thái thanh toán của đơn hàng — biết còn nợ gì, đã trả gì.

### Endpoint

```
GET /api/v1/orders/:id/payment-status
Authorization: Bearer <staff-token> (Permission.OrderWrite)
```

### Response

```json
{
  "orderId": "O1",
  "orderCode": "172000000042",
  "totalPrice": 13200000,
  "paidAmount": 100000,
  "remainingAmount": 13100000,
  "phases": [
    { "phase": "DEPOSIT_1", "status": "PAID", "amount": 100000, "method": "MANUAL", "paidAt": "2026-07-07T..." },
    { "phase": "DEPOSIT_2", "status": "PENDING", "amount": null, "method": null, "paidAt": null },
    { "phase": "REMAINING", "status": "PENDING", "amount": null, "method": null, "paidAt": null }
  ]
}
```

### Logic

```typescript
async getPaymentStatus(orderId: string) {
  const order = await this.prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, order_code: true, total_price: true, paid_amount: true, remaining_amount: true },
  });
  if (!order) throw new NotFoundException('Order not found');

  const payments = await this.prisma.payments.findMany({
    where: { order_id: orderId, status: 'PAID' },
    select: { payment_phase: true, amount: true, method: true, paid_at: true },
    orderBy: { paid_at: 'desc' },
  });

  const phases = ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING', 'FULL'].map((phase) => {
    const paid = payments.find((p) => p.payment_phase === phase);
    return {
      phase,
      status: paid ? 'PAID' : 'PENDING',
      amount: paid ? Number(paid.amount) : null,
      method: paid?.method ?? null,
      paidAt: paid?.paid_at?.toISOString() ?? null,
    };
  });

  return {
    orderId: order.id,
    orderCode: order.order_code,
    totalPrice: Number(order.total_price ?? 0),
    paidAmount: Number(order.paid_amount ?? 0),
    remainingAmount: Number(order.remaining_amount ?? 0),
    phases,
  };
}
```

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `getPaymentStatus()` |
| 2 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm gRPC handler |
| 3 | `apps/api-gateway/.../order/order.controller.ts` | `GET /:id/payment-status` |
| 4 | `apps/api-gateway/.../order/order.swagger.ts` | Swagger docs |
| 5 | `proto/ecommerce.proto` | RPC + messages |

---

## 4. Validate Biometrics trong CreateGuestOrder

### Mục tiêu
Khi Staff tạo order cho guest (Tab 1), validate rằng biometric file đã đủ trước khi cho phép submit.

### Logic

Trong `createGuestOrder()`, trước khi tạo order, kiểm tra version `selectedBiometrics` và số lượng biometric files đã upload.

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/guest/guest.service.ts` | Thêm validate trong `createGuestOrder()` |

---

## 5. Tổng kết

| # | Feature | Files mới | Files sửa | Migration |
|---|---------|----------|-----------|-----------|
| 1 | Customer Lookup | 5 | 3 | Không |
| 2 | Manual Payment | 1 | 5 | Không |
| 3 | Payment Status | 0 | 5 | Không |
| 4 | Validate biometrics | 0 | 1 | Không |

| Tổng | 6 mới | 14 sửa | 0 migration |
