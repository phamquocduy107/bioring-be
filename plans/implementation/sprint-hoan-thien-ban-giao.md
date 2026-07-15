# Sprint "Hoàn thiện & Bàn giao" — Implementation Plan

**Ngày:** 2026-07-19

---

## P0: Rate Limiting cho Public Endpoints

### Mục tiêu
Bảo vệ các endpoint `@Public()` khỏi bị spam/abuse.

### Package
```bash
npm i @nestjs/throttler
```

### Các endpoint cần rate limit

| Endpoint | Limit | Window | Lý do |
|----------|-------|--------|-------|
| `POST /api/v1/guest-tablet/*` | 30 req | 60s | Tablet guest flow |
| `POST /api/v1/orders/lookup` | 10 req | 60s | Guest tra cứu đơn |
| `GET /api/v1/track/open` | 100 req | 60s | Tracking pixel (mỗi lần mở email) |
| `POST /api/v1/warranty-claims/lookup` | 10 req | 60s | Guest tạo claim |
| `POST /api/v1/qr-memories/activate` | 5 req | 60s | Brute-force PIN |

### Logic

```typescript
// app.module.ts
imports: [
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]), // default: 30 req/60s
]

// Trên từng controller method:
@Throttle({ default: { ttl: 60000, limit: 10 } })
```

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `package.json` | Thêm `@nestjs/throttler` |
| 2 | `apps/api-gateway/src/app.module.ts` | Import ThrottlerModule.forRoot() |
| 3 | `apps/api-gateway/src/modules/ecommerce/guest/guest-tablet.controller.ts` | `@Throttle(30, 60)` |
| 4 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | `@Throttle(10, 60)` trên lookup |
| 5 | `apps/api-gateway/src/modules/track/track.controller.ts` | `@Throttle(100, 60)` |
| 6 | `apps/api-gateway/src/modules/ecommerce/warranty/warranty.controller.ts` | `@Throttle(10, 60)` trên lookup |
| 7 | `apps/api-gateway/src/modules/ecommerce/memory-card/memory-card.controller.ts` | `@Throttle(5, 60)` trên activate |

### Acceptance
- Gọi lookup 11 lần trong 60s → 429 Too Many Requests lần thứ 11
- Gọi các endpoint khác → không bị ảnh hưởng

---

## P1: Deep Link trong Email Templates

### Mục tiêu
Thêm nút "Mở App Bioring" với `bioring://` deep link vào tất cả email templates.

### Thay đổi

Mỗi template trong `templates.ts` thêm 1 dòng sau nội dung:

```html
<a href="bioring://order/{{orderCode}}" style="display:inline-block;background:#8B4513;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">
  Mở App Bioring →
</a>
<p style="font-size:12px;color:#999">Hoặc truy cập: https://bioring.com/track/{{orderCode}}</p>
```

Mỗi loại template có deep link khác nhau:

| Template | Deep link |
|----------|-----------|
| orderApproved | `bioring://payment/{{orderCode}}` |
| orderRejected | `bioring://order/{{orderCode}}` |
| paymentConfirmed | `bioring://order/{{orderCode}}` |
| productionStarted | `bioring://order/{{orderCode}}` |
| readyForDelivery | `bioring://order/{{orderCode}}` |
| orderDelivered | `bioring://memory/{{orderCode}}` |

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `libs/common/src/notification/templates.ts` | Thêm deep link button vào tất cả 7 templates |

### Acceptance
- Mở email trên mobile có app Bioring → click nút → mở app
- Mở email trên desktop → click → mở web fallback

---

## P2: Payment Refund API

### Mục tiêu
Khi order bị cancel sau khi đã thanh toán, tự động refund qua PayOS.

### Endpoint

```
POST /api/v1/orders/:id/refund
Authorization: Bearer <manager-token> (OrderWrite)
```

### Request

```json
{
  "reason": "Khách hàng yêu cầu hủy đơn"
}
```

### Logic

```typescript
async refundOrder(orderId: string, reason: string) {
  const order = await this.prisma.orders.findUnique({
    where: { id: orderId },
    include: { payments: { where: { status: 'PAID' } } },
  });
  if (!order) throw new NotFoundException('Order not found');
  if (order.status !== 'CANCELLED') throw new BadRequestException('Order must be CANCELLED');

  // Refund từng payment đã thanh toán
  for (const payment of order.payments) {
    if (payment.method === 'PAYOS' && payment.payos_transaction_id) {
      await this.payOS.refundPayment(payment.payos_transaction_id, {
        amount: Number(payment.amount),
        description: `Refund ${order.order_code} - ${reason}`,
      });
    }

    await this.prisma.payments.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });
  }

  // Cập nhật order
  await this.prisma.orders.update({
    where: { id: orderId },
    data: {
      paid_amount: 0,
      remaining_amount: Number(order.total_price ?? 0),
      note: `[Refunded] ${reason}`,
    },
  });
}
```

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm `refundOrder()` |
| 2 | `apps/ecommerce-service/src/order/order.controller.ts` | Thêm gRPC handler |
| 3 | `apps/api-gateway/.../order/order.controller.ts` | `POST /:id/refund` |
| 4 | `apps/api-gateway/.../order/order.swagger.ts` | Swagger docs |
| 5 | `proto/ecommerce.proto` | Thêm `RefundOrder` RPC |
| 6 | `libs/common/src/payment/payos.service.ts` | Thêm `refundPayment()` |

### Acceptance
- Order CANCELLED (đã thanh toán DEPOSIT_2) → refund → payments REFUNDED, paid_amount=0
- Order chưa CANCELLED → refund → 400

---

## P3: Audit Logging

### Mục tiêu
Ghi log mọi status change của order, payment, claim vào bảng `audit_logs`.

### Kiến trúc

Không dùng middleware — dùng EventEmitter2 pattern giống notification system:

```
Order Service ──emit('audit.log')──> EventEmitter2 ──@OnEvent──> AuditListener
                                                              │
                                                    INSERT audit_logs
```

### Events cần log

| Event | Entity | Action | Data |
|-------|--------|--------|------|
| `order.submitted` | orders | status_change | AWAITING_SUBMIT → PENDING_REVIEW |
| `order.approved` | orders | status_change | PENDING_REVIEW → AWAITING_DEPOSIT |
| `order.rejected` | orders | status_change | PENDING_REVIEW → REVISION_REQUIRED |
| `payment.confirmed` | payments | payment_received | amount, method |
| `payment.refunded` | payments | payment_refunded | amount |
| `order.cancelled` | orders | status_change | → CANCELLED |
| `order.delivered` | orders | status_change | DELIVERED → COMPLETED |

### Listener

```typescript
@Injectable()
export class AuditListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('audit.log')
  async handleAuditLog(payload: {
    userId: string;
    action: string;
    entityName: string;
    entityId: string;
    newValue?: Record<string, unknown>;
  }) {
    await this.prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: payload.userId,
        action: payload.action,
        entity_name: payload.entityName,
        entity_id: payload.entityId,
        new_value: payload.newValue,
        created_at: new Date(),
      },
    });
  }
}
```

### Emit từ order.service.ts

Thêm `this.eventEmitter.emit('audit.log', { ... })` ở các status transition (cùng chỗ emit notification).

### Files

| # | File | Thay đổi |
|---|------|----------|
| 1 | `apps/ecommerce-service/src/audit/audit.module.ts` | Module mới |
| 2 | `apps/ecommerce-service/src/audit/audit.listener.ts` | @OnEvent listener |
| 3 | `apps/ecommerce-service/src/order/order.service.ts` | Thêm emit audit.log |
| 4 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import AuditModule |

### Acceptance
- Order submit → audit_logs có record "status_change"
- Payment confirmed → audit_logs có record "payment_received"
- `audit_logs` table có đủ action, entity_name, entity_id, new_value, created_at

---

## P4: Manual Test Doc MF-06

### Mục tiêu
Tạo file `MF06-warranty-service-claim-flow.md` theo pattern MF-01→MF-05.

### File

`D:\BTFPT\WDP\bioring-be\plans\manual-testing\MF06-warranty-service-claim-flow.md`

### Nội dung

Theo pattern có sẵn:
1. Prerequisites
2. Step-by-step flow (10 bước từ tạo claim đến return)
3. Expected response cho mỗi bước
4. Edge cases
5. Variable reference table

---

## Tổng kết

| # | Feature | Effort | Files mới | Files sửa | Migration |
|---|---------|--------|----------|-----------|-----------|
| P0 | Rate limiting | 1-2h | 0 | 7 | 0 |
| P1 | Deep link email | 10p | 0 | 1 | 0 |
| P2 | Refund API | 2-4h | 0 | 6 | 0 |
| P3 | Audit logging | 2-3h | 2 | 2 | 0 |
| P4 | Manual test MF-06 | 30p | 1 | 0 | 0 |

| **Tổng** | **6-10h** | **3** | **16** | **0** |
