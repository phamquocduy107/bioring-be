# Notification System (Email) — Thực tế sau implement

> **Trạng thái: ĐÃ IMPLEMENT (Option B — 10/07/2026)**
> So với plan gốc:
> - ❌ Không dùng MJML → HTML template inline (`templates.ts`)
> - ❌ Không dùng BullMQ queue → send trực tiếp qua SendGrid
> - ❌ Không dùng nodemailer → `@sendgrid/mail`
> - ✅ Ghi `email_trackings` DB mỗi lần gửi
> - ✅ 4 events → thêm 3 events nữa (12/07/2026): order.rejected, order.production_started, order.ready_for_delivery

---

## 1. Kiến trúc thực tế

```
Order Service ──emit(event)──> EventEmitter2 ──@OnEvent──> NotificationListener
                                                              │
                                                    resolve email từ DB
                                                    (users.email hoặc guest_customers.email)
                                                              │
                                                              ▼
                                                       EmailService
                                                       SendGrid.send()
                                                              │
                                                    INSERT email_trackings
```

---

## 2. Templates (templates.ts)

File: `libs/common/src/notification/templates.ts`

Layout chung: HTML inline, logo white, nâu #8B4513, font Arial.

Template list (7):

| Key | Mô tả |
|-----|-------|
| `orderSubmitted` | Gửi Manager/Admin khi có đơn mới |
| `orderApproved` | Gửi Customer khi duyệt |
| `orderRejected` | Gửi Customer khi từ chối |
| `paymentConfirmed` | Gửi Customer khi thanh toán OK |
| `productionStarted` | Gửi Customer khi bắt đầu sản xuất |
| `readyForDelivery` | Gửi Customer khi sẵn sàng giao |
| `orderDelivered` | Gửi Customer khi đã giao |

---

## 3. Events & Emits

File: `apps/ecommerce-service/src/order/order.service.ts`

| Event | Nơi emit | Gửi cho ai |
|-------|---------|-----------|
| `order.submitted` | `submitOrder()` | Manager/Admin |
| `order.approved` | `reviewOrder()` approve | Customer/Guest |
| `order.rejected` | `reviewOrder()` reject | Customer/Guest |
| `payment.confirmed` | `handlePayOSWebhook()` PAID | Customer/Guest |
| `order.production_started` | `assignJeweler()` | Customer/Guest |
| `order.ready_for_delivery` | `qcAcceptOrder()` PASS | Customer/Guest |
| `order.delivered` | `completeOrder()` | Customer/Guest |

---

## 4. Notification Listener

File: `apps/ecommerce-service/src/notification/notification.listener.ts`

```typescript
@Injectable()
export class NotificationListener {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  // getCustomerInfo(): resolve email từ users hoặc guest_customers

  @OnEvent('order.submitted')
  // → tìm Manager/Admin → gửi email cho từng người

  @OnEvent('order.approved')      // → gửi customer
  @OnEvent('order.rejected')      // → gửi customer + lý do
  @OnEvent('payment.confirmed')   // → gửi customer
  @OnEvent('order.production_started') // → gửi customer
  @OnEvent('order.ready_for_delivery') // → gửi customer
  @OnEvent('order.delivered')     // → gửi customer
}
```

---

## 5. EmailService

File: `libs/common/src/notification/email.service.ts`

```typescript
@Injectable()
export class EmailService {
  async send(params: {
    to: string;
    type: string;
    subject: string;
    html: string;
    orderId?: string;
  }) {
    await this.sg.send({ to, from: SENDGRID_FROM, subject, html });
    await this.prisma.email_trackings.create({
      data: { email_id: randomUUID(), email_to: to, email_type: type, order_id: orderId, sent_at: new Date() },
    });
  }
}
```

---

## 6. Files

### Mới (6)

| File | Vai trò |
|------|---------|
| `libs/common/src/notification/email.service.ts` | SendGrid send + track |
| `libs/common/src/notification/templates.ts` | 7 HTML templates |
| `libs/common/src/notification/notification.module.ts` | @Global module |
| `libs/common/src/notification/index.ts` | Barrel |
| `apps/ecommerce-service/src/notification/notification.listener.ts` | @OnEvent listener |
| `apps/ecommerce-service/src/notification/notification.module.ts` | Module listener |

### Sửa (5)

| File | Thay đổi |
|------|----------|
| `libs/prisma/prisma/schema.prisma` | Thêm `email_trackings` |
| `libs/common/src/index.ts` | Export NotificationModule |
| `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import module + EventEmitterModule.forRoot() |
| `apps/ecommerce-service/src/order/order.service.ts` | 7 emits + inject EventEmitter2 |
| `apps/ecommerce-service/src/order/order.module.ts` | Không cần sửa (EventEmitterModule.forRoot ở module cha) |

---

## 7. Schema: email_trackings

```prisma
model email_trackings {
  id           String    @id @db.Uuid
  email_id     String    @unique @db.VarChar(100)
  email_to     String
  email_type   String    @db.VarChar(100)
  order_id     String?   @db.Uuid
  claim_id     String?   @db.Uuid
  opened_at    DateTime?
  open_count   Int       @default(0)
  sent_at      DateTime  @default(now()) @db.Timestamptz(6)
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
}
```

Migration: `20260710155500_add_email_trackings`

---

## 8. Env variables (mới)

```env
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@bioring.com  # verified sender
```

---

## 9. Out of scope

- ❌ Deep link `bioring://` trong email
- ❌ Tracking pixel `/track/open` endpoint (schema đã có, API endpoint cần thêm)
- ❌ SMS notification
- ❌ Push notification
- ❌ MJML templates
- ❌ BullMQ queue
