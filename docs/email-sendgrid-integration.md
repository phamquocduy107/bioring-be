# SendGrid Email Module — Hướng dẫn tích hợp

Tài liệu mô tả cách module email SendGrid hoạt động trong monorepo BioRing và cách tích hợp / mở rộng.

## Tổng quan

| Thành phần | Vị trí | Vai trò |
|------------|--------|---------|
| `EmailService` | `libs/common/src/notification/email.service.ts` | Gửi mail qua SendGrid, inject logo, ghi `email_trackings` |
| `NotificationModule` (`@app/common`) | `libs/common/src/notification/notification.module.ts` | `@Global()` — export `EmailService` |
| HTML templates | `libs/common/src/notification/templates.ts` | Layout + template theo loại mail |
| Invoice PDF | `libs/common/src/notification/invoice-pdf.ts` + `invoice.types.ts` | PDF biên lai / hóa đơn cuối |
| Ecommerce listener | `apps/ecommerce-service/src/notification/notification.listener.ts` | Lắng nghe event → gửi mail |
| Invoice builder | `apps/ecommerce-service/src/notification/invoice.builder.ts` | Build data + PDF cho invoice mail |
| Open tracking | `apps/api-gateway/src/modules/track/track.controller.ts` | Pixel `GET /api/v1/track/open` |
| Dev test | `POST /api/v1/dev/email/test` + `docs/email-previews/` | Gửi / xem trước template |

Luồng hiện tại: **không dùng queue** — emit Nest `EventEmitter` → listener gọi `EmailService.send()` trực tiếp.

```
order.service.ts
  eventEmitter.emit('order.approved', { orderId })
        │
        ▼
NotificationListener (@OnEvent)
  templates.*()  →  EmailService.send()
        │
        ├─ INSERT email_trackings
        ├─ inject {{EMAIL_LOGO_URL}}
        ├─ append tracking pixel
        └─ SendGrid.send()
```

---

## 1. Cấu hình môi trường

Thêm vào `.env` (xem `.env.example`):

```env
SENDGRID_API_KEY=SG.xxx          # Bắt buộc để gửi thật
SENDGRID_FROM_EMAIL=noreply@bioring.vn   # Domain/from đã verify trên SendGrid
EMAIL_LOGO_URL=https://.../logo.png      # Logo header (runtime inject)
ENABLE_EMAIL_TEST=true                   # Cho phép endpoint test (dev)

# Hiển thị trên biên lai / PDF
COMPANY_NAME=Bioring Vietnam
COMPANY_ADDRESS=Việt Nam
COMPANY_TAX_CODE=
COMPANY_EMAIL=noreply@bioring.vn
COMPANY_PHONE=
```

**Lưu ý:**

- Thiếu `SENDGRID_API_KEY` → `EmailService` chỉ `console.warn`, **không throw** (không làm fail business flow).
- `SENDGRID_FROM_EMAIL` phải là sender đã verify trong SendGrid (Single Sender hoặc Domain Authentication).
- Logo dùng placeholder `{{EMAIL_LOGO_URL}}` trong HTML template; `EmailService` thay bằng `EMAIL_LOGO_URL` lúc gửi (tránh webpack bake empty env lúc build).

### Setup SendGrid (một lần)

1. Tạo API Key (Mail Send) trên [SendGrid](https://app.sendgrid.com/).
2. Verify sender / domain.
3. Gán key vào `SENDGRID_API_KEY` trên mọi process chạy ecommerce-service (và api-gateway nếu dùng endpoint test).

---

## 2. Import module vào service

`NotificationModule` từ `@app/common` đã `@Global()`. Import một lần ở root module của app cần gửi mail:

```ts
// apps/ecommerce-service/src/ecommerce-service.module.ts
import { NotificationModule } from '@app/common';
import { NotificationModule as EcommerceNotificationModule } from './notification/notification.module';

@Module({
  imports: [
    NotificationModule,           // EmailService
    EcommerceNotificationModule,  // NotificationListener + InvoiceBuilder
    // ...
  ],
})
export class EcommerceServiceModule {}
```

Api-gateway cũng import `NotificationModule` (dùng cho `EmailTestController`).

Inject trực tiếp:

```ts
import { EmailService, templates } from '@app/common';

constructor(private readonly emailService: EmailService) {}
```

---

## 3. API gửi mail (`EmailService.send`)

```ts
await this.emailService.send({
  to: 'customer@email.com',
  type: 'order.approved',          // lưu vào email_trackings.email_type
  subject: 'Thiết kế đã được duyệt',
  html: templates.orderApproved({ fullName, orderCode }),
  orderId: order.id,               // optional — gắn tracking với order
  attachments: [                   // optional
    {
      content: pdfBuffer.toString('base64'),
      filename: 'INV-xxx.pdf',
      type: 'application/pdf',
      disposition: 'attachment',
    },
  ],
});
```

| Field | Bắt buộc | Mô tả |
|-------|----------|--------|
| `to` | ✅ | Email người nhận |
| `type` | ✅ | Mã loại mail (analytics / filter DB) |
| `subject` | ✅ | Subject |
| `html` | ✅ | HTML body (nên dùng `templates.*`) |
| `orderId` | ❌ | UUID order → `email_trackings.order_id` |
| `attachments` | ❌ | Base64 + MIME type (PDF biên lai) |

Return: `emailId` (UUID) nếu gửi OK; `undefined` nếu thiếu key / lỗi SendGrid (đã catch + warn).

---

## 4. Event → mail (ecommerce)

Listener: `apps/ecommerce-service/src/notification/notification.listener.ts`.

| Event | `email_type` | Template | Đính kèm |
|-------|--------------|----------|----------|
| `order.approved` | `order.approved` | `templates.orderApproved` | — |
| `order.rejected` | `order.rejected` | `templates.orderRejected` | — |
| `payment.confirmed` | `invoice.payment` | `templates.invoicePayment` | PDF biên lai |
| `order.ready_for_delivery` | `order.ready_for_delivery` / `order.ready_for_pickup` | `templates.readyForDelivery` | — |
| `order.completed` | `invoice.final` | `templates.invoiceFinal` | PDF hóa đơn cuối |

Emit từ `order.service.ts`, ví dụ:

```ts
this.eventEmitter.emit('order.approved', { orderId: id });
this.eventEmitter.emit('order.rejected', { orderId: id, note });
this.eventEmitter.emit('payment.confirmed', {
  orderId,
  paymentId,
  paymentPhase,
});
this.eventEmitter.emit('order.ready_for_delivery', {
  orderId,
  method: 'DELIVERY' | 'PICKUP',
});
this.eventEmitter.emit('order.completed', { orderId });
```

Người nhận: email user đăng ký **hoặc** `guest_customers.email` (ưu tiên user nếu có). Không có email → skip im lặng.

> Các event như `order.production_started` / `order.delivered` vẫn có thể được emit nhưng **không** còn listener gửi mail customer.

---

## 5. Templates HTML

File: `libs/common/src/notification/templates.ts`.

- Layout chung: card trắng, logo placeholder, Lucide SVG inline (SendGrid-safe, không phụ thuộc CDN ngoài).
- Export object `templates`:

```ts
templates.orderApproved({ fullName, orderCode })
templates.orderRejected({ fullName, orderCode, note? })
templates.readyForDelivery({ fullName, orderCode, method })
templates.invoicePayment({ ...invoiceFields })
templates.invoiceFinal({ ...invoiceFields })
```

Khi thêm template mới:

1. Viết hàm HTML trong `templates.ts` (dùng `layout()`, `ctaButton()`, …).
2. Thêm vào object `templates`.
3. Gọi từ listener hoặc `EmailService.send` trực tiếp.
4. (Tuỳ chọn) thêm vào `scripts/generate-email-previews.ts` + `EMAIL_TEST_TEMPLATES`.

---

## 6. Tracking mở mail

1. Mỗi lần gửi tạo `email_id` (UUID), insert `email_trackings`.
2. HTML cuối được append pixel:

   `GET https://api.bioring.com/api/v1/track/open?id={emailId}`

3. `TrackController` cập nhật `opened_at`, `open_count++`, trả GIF 1×1.

Schema:

```prisma
model email_trackings {
  id         String    @id @db.Uuid
  email_id   String    @unique
  email_to   String
  email_type String
  order_id   String?   @db.Uuid
  claim_id   String?   @db.Uuid
  opened_at  DateTime?
  open_count Int       @default(0)
  sent_at    DateTime
  created_at DateTime
}
```

> URL pixel đang hardcode host production. Môi trường local/staging nếu cần đo open rate, đổi host cho khớp gateway public.

---

## 7. Preview & test gửi

### Static preview

```bash
npm run email:previews
```

Mở `docs/email-previews/index.html` (hoặc qua static `/demo/email-previews/` nếu gateway serve).

### Gửi test thật

```http
POST /api/v1/dev/email/test
Content-Type: application/json

{
  "to": "you@example.com",
  "template": "order.approved",
  "fullName": "Nguyen Van A"
}
```

Điều kiện: `NODE_ENV !== 'production'` **hoặc** `ENABLE_EMAIL_TEST=true`.

---

## 8. Thêm loại mail mới (checklist)

1. **Template** — thêm hàm trong `templates.ts`.
2. **Event** (khuyến nghị) — emit từ service nghiệp vụ:

   ```ts
   this.eventEmitter.emit('order.my_event', { orderId });
   ```

3. **Listener** — `@OnEvent('order.my_event')` → `emailService.send({ type: '...', html: templates.myTemplate(...) })`.
4. **Hoặc gọi trực tiếp** `EmailService` trong service (không bắt buộc qua event).
5. **Preview / test** — cập nhật script preview + `SendTestEmailDto` nếu cần QA.
6. Không cần bảng `notifications` — tracking dùng `email_trackings`.

---

## 9. Attachment PDF (biên lai)

`payment.confirmed` / `order.completed` đi qua `InvoiceBuilder`:

1. Load order + payments → `InvoiceData` (`invoice.types.ts`: payment plan theo ONLINE 2 bước / OFFLINE 3 bước).
2. `buildInvoicePdf(data)` → `Buffer`.
3. HTML invoice + attach PDF base64 qua `EmailService.send`.

Env `COMPANY_*` đưa vào PDF/HTML biên lai.

---

## 10. Troubleshooting

| Hiện tượng | Kiểm tra |
|------------|----------|
| Không nhận mail | `SENDGRID_API_KEY` có trong process ecommerce-service? Log `[Email] SENDGRID_API_KEY not configured` |
| SendGrid 403 | From address chưa verify / key thiếu quyền Mail Send |
| Logo trống / sai | `EMAIL_LOGO_URL` runtime; template phải còn `{{EMAIL_LOGO_URL}}` |
| Không có row tracking | Lỗi DB — xem `[Email] Failed to save tracking` (gửi vẫn có thể thành công) |
| Guest không nhận mail | `guest_customers.email` null |
| Endpoint test 403 | Bật `ENABLE_EMAIL_TEST=true` hoặc chạy non-production |

---

## File liên quan

```
libs/common/src/notification/
  email.service.ts
  templates.ts
  invoice-pdf.ts
  invoice.types.ts
  notification.module.ts
  index.ts

apps/ecommerce-service/src/notification/
  notification.module.ts
  notification.listener.ts
  invoice.builder.ts

apps/api-gateway/src/modules/
  track/track.controller.ts
  dev/email-test.controller.ts
  dev/email-test.service.ts

docs/email-previews/          # HTML preview sau npm run email:previews
scripts/generate-email-previews.ts
```
