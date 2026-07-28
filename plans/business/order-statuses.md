# Order Statuses — Business Reference

> Dành cho web portal (staff/manager UI) để hiển thị đúng trạng thái, action button, và quyền hủy.

---

## Status table

| # | Status | Business meaning | Portal hiển thị | Cancel allowed? |
|---|--------|-----------------|-----------------|:---------------:|
| 1 | `AWAITING_SUBMIT` | Vừa tạo order từ engraving, đang thiết kế + upload biometrics | *Chờ submit* — cho phép chỉnh config, upload biometrics | ✅ |
| 2 | `AWAITING_DEPOSIT_1` | (MF-03 offline) Chờ thanh toán IoT fee 100k + base price | *Chờ thanh toán IoT* — hiển thị QR PayOS đóng 100k | ✅ |
| 3 | `PENDING_REVIEW` | Đã submit, chờ manager duyệt thiết kế | *Chờ duyệt* — mở tab manager review, khoá config | ✅ |
| 4 | `REVISION_REQUIRED` | Manager reject, yêu cầu sửa lại thiết kế | *Cần chỉnh sửa* — mở khoá config, cho edit + resubmit | ✅ |
| 5 | `AWAITING_DEPOSIT` | Manager approve, chờ thanh toán deposit 2 (30%, min 3tr) | *Chờ đặt cọc* — QR PayOS deposit 2 | ❌ |
| 6 | `DEPOSIT_PAID` | Đã đóng deposit 2, chờ assign jeweler | *Đã đặt cọc* — chờ staff assign jeweler | ❌ |
| 7 | `IN_PRODUCTION` | Đang sản xuất (jeweler làm nhẫn) | *Đang sản xuất* — show tiến độ + estimated completion | ❌ |
| 8 | `PENDING_QC` | Sản xuất xong, chờ QC kiểm tra | *Chờ kiểm định* — mở tab QC cho manager | ❌ |
| 9 | `AWAITING_REMAINING` | QC pass nhưng còn nợ số tiền còn lại | *Chờ thanh toán còn lại* — QR PayOS phần remaining | ❌ |
| 10 | `READY_FOR_DELIVERY` | Đã thanh toán đủ, chọn phương thức nhận | *Sẵn sàng giao* — staff chọn PICKUP hoặc DELIVERY | ❌ |
| 11 | `SHIPPING` | (DELIVERY) Đang vận chuyển | *Đang giao hàng* — show tracking code + link | ❌ |
| 12 | `READY_FOR_PICKUP` | (PICKUP) Chờ khách đến quầy nhận | *Chờ nhận tại quầy* — staff chờ confirm | ❌ |
| 13 | `DELIVERED` | Đã giao (tay đôi / đơn vị VC xác nhận). Auto tạo warranty + unlock QR. | *Đã giao* | ❌ |
| 14 | `COMPLETED` | Hoàn tất — warranty + QR memory unlocked | *Hoàn thành* — hiển thị bảo hành, QR memory | ❌ |
| 15 | `REJECTED` | Order bị từ chối hẳn (không phải revision) | *Bị từ chối* — chỉ admin xử lý | ❌ |
| 16 | `CANCELLED` | Đã hủy (terminal state) | *Đã hủy* | — |

---

## Flow diagram

```
                  ┌──────────────────────────────────────────────┐
                  │               AWAITING_SUBMIT                │ ← MF-02 online
                  │  (thiết kế + upload biometrics)              │
                  └──────┬───────────────────────┬───────────────┘
                         │ (SW)                 │ (FP/HB)
                         │                      ▼
                         │           AWAITING_DEPOSIT_1 ← MF-03 offline
                         │           (pay IoT fee 100k + base)
                         ▼                      │
              ┌──────────────────┐               │
              │ AWAITING_SUBMIT  │◄──────────────┘
              │ (đã pay IoT)     │
              └────────┬─────────┘
                       ▼ submit
              ┌──────────────────┐
              │  PENDING_REVIEW  │
              └──┬─────────────┬─┘
      approve   │             │  reject
               ▼             ▼
       AWAITING_DEPOSIT  REVISION_REQUIRED
       (pay 30% min 3tr)  (edit + resubmit → PENDING_REVIEW)
               │
               ▼
         DEPOSIT_PAID
               │
               ▼ assign-jeweler
          IN_PRODUCTION
               │
               ▼ production complete
            PENDING_QC
               │ qc pass
               ▼
       ┌── remaining > 0 ── AWAITING_REMAINING ── pay remaining ──┐
       │                                                          │
       └── remaining ≤ 0 ──────── READY_FOR_DELIVERY ◄────────────┘
                                       │
                              ┌────────┴────────┐
                              ▼                 ▼
                       READY_FOR_PICKUP     SHIPPING
                              │                 │
                              ▼                 ▼
                           DELIVERED ─────→ COMPLETED
                                   (auto warranty + unlock QR)
```

---

## Transition rules

| Action | Requires status | → New status |
|--------|---------------|-------------|
| `submitOrder` | `AWAITING_SUBMIT` / `REVISION_REQUIRED` | `PENDING_REVIEW` |
| `reviewOrder` (approve) | `PENDING_REVIEW` | `AWAITING_DEPOSIT` |
| `reviewOrder` (reject) | `PENDING_REVIEW` | `REVISION_REQUIRED` |
| `assignJeweler` | `DEPOSIT_PAID` | `IN_PRODUCTION` |
| updateProductionStatus (complete) | `IN_PRODUCTION` | `PENDING_QC` |
| qcAcceptOrder (PASS, remaining>0) | `IN_PRODUCTION` / `PENDING_QC` | `AWAITING_REMAINING` |
| qcAcceptOrder (PASS, remaining≤0) | `IN_PRODUCTION` / `PENDING_QC` | `READY_FOR_DELIVERY` |
| qcAcceptOrder (FAIL) | `IN_PRODUCTION` / `PENDING_QC` | `IN_PRODUCTION` (reset task) |
| initiateDelivery (PICKUP) | `READY_FOR_DELIVERY` | `READY_FOR_PICKUP` |
| updateShipmentStatus → SHIPPING | `READY_FOR_DELIVERY` | `SHIPPING` |
| updateShipmentStatus → DELIVERED (PICKUP) | `READY_FOR_PICKUP` | `DELIVERED` |
| updateShipmentStatus → DELIVERED (DELIVERY) | `SHIPPING` | `DELIVERED` |
| `cancelOrder` | 9 trạng thái đầu (AWAITING_SUBMIT ~ PENDING_QC) | `CANCELLED` |

---

## Portal UI guidelines

| Status | Actions visible | Notes |
|--------|---------------|-------|
| `AWAITING_SUBMIT` | Edit design, upload biometrics, Submit | Cho phép mọi thay đổi |
| `AWAITING_DEPOSIT_1` | Pay deposit 1, Cancel | Chỉ MF-03 offline |
| `PENDING_REVIEW` | Review (manager), Cancel | Manager mở tab review |
| `REVISION_REQUIRED` | Edit design, Submit, Cancel | Mở khoá config lại |
| `AWAITING_DEPOSIT` | Pay deposit 2 | QR code thanh toán |
| `DEPOSIT_PAID` | Assign jeweler (manager) | Chọn jeweler từ dropdown |
| `IN_PRODUCTION` | Xem tiến độ | Jeweler cập nhật status |
| `PENDING_QC` | QC accept/reject (manager) | Manager mở tab QC |
| `AWAITING_REMAINING` | Pay remaining | QR code thanh toán |
| `READY_FOR_DELIVERY` | Chọn PICKUP / DELIVERY (staff) | Quyết định phương thức giao |
| `SHIPPING` | Xem tracking | Từ đây đến DELIVERED tự động |
| `READY_FOR_PICKUP` | Confirm pickup (staff) | Staff xác nhận khách đã nhận |
| `DELIVERED` | (tự động → COMPLETED) | Warranty + QR unlock auto |
| `COMPLETED` | Xem thông tin | End state |
