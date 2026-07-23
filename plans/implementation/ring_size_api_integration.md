# Hướng Dẫn Tích Hợp API: Ring Size & Quản Lý Hồ Sơ Kích Thước Nhẫn

Tài liệu hướng dẫn dành cho team Frontend (Web Portal & Mobile App) tích hợp bộ API Kích thước nhẫn (**Ring Size**).

---

## 1. Vị trí lưu Ring Size cho Đơn hàng / Bản khắc (Engraving)

* **Quy chuẩn Backend:** Kích thước nhẫn (Size) của bản khắc được lưu tại trường **`ringSize`** thuộc model **`engraving_versions`** (hoặc `design_drafts.ringSize` đối với bản nháp).
* **API cập nhật Size khi thiết kế:**
  FE gửi `ringSize` trong body API cập nhật cấu hình thiết kế:
  `PATCH /api/v1/engravings/versions/:versionId/config`
  ```json
  {
    "ringSize": "7",
    "selectedMaterialId": "mat-gold-18k",
    "selectedGemstoneId": "gem-diamond-01",
    "customizationConfig": "{\"engravedType\":\"sw\"}"
  }
  ```
* **Khi xem đơn hàng / bản khắc:** API `GET /api/v1/orders` và `GET /api/v1/engravings` sẽ trả về `ringSize` nằm bên trong object `version` tương ứng.

---

## 2. Bộ API Quản lý Hồ sơ & Lịch sử Đo Ring Size (`user_ring_sizes`)

Phục vụ tính năng **Đo size nhẫn** (đo thước giấy, đo qua nhẫn có sẵn, hoặc camera AI):

📌 **Route Prefix:** `/api/v1/me/ring-sizes` (hoặc `/api/v1/ring-sizes`)

| HTTP Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| **`GET`** | `/api/v1/me/ring-sizes` | Lấy danh sách kích thước nhẫn đã lưu của User |
| **`POST`** | `/api/v1/me/ring-sizes` | Lưu kết quả đo Ring Size mới |
| **`PUT`** | `/api/v1/me/ring-sizes/:id` | Cập nhật thông tin bản ghi đo Ring Size |
| **`DELETE`** | `/api/v1/me/ring-sizes/:id` | Xóa bản ghi Ring Size |
| **`PATCH`** | `/api/v1/me/ring-sizes/:id/default` | Đặt bản ghi Size làm mặc định |

---

## 3. Payload Mẫu Cho API Tạo / Cập Nhật Ring Size

### 3a. API POST `/api/v1/me/ring-sizes`

**Headers:** `Authorization: Bearer <Customer_JWT>`

**Request Body:**
```json
{
  "label": "Ngón áp út tay trái",
  "handSide": "LEFT",             
  "fingerType": "RING",           
  "sizeSystem": "VN",             
  "ringSize": "7",
  "diameterMm": 17.3,
  "circumferenceMm": 54.4,
  "measurementMethod": "PAPER_STRIP", 
  "measurementSource": "SELF",        
  "guideStepResult": {
    "step1": "completed",
    "measuredMm": 54.4
  },
  "confidenceScore": 98.5,
  "isDefault": true,
  "note": "Đo bằng hướng dẫn thước giấy trên ứng dụng"
}
```

**Response mẫu (201 Created):**
```json
{
  "ringSize": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "label": "Ngón áp út tay trái",
    "handSide": "LEFT",
    "fingerType": "RING",
    "sizeSystem": "VN",
    "ringSize": "7",
    "diameterMm": 17.3,
    "circumferenceMm": 54.4,
    "measurementMethod": "PAPER_STRIP",
    "measurementSource": "SELF",
    "isDefault": true,
    "createdAt": "2026-07-23T10:00:00.000Z",
    "updatedAt": "2026-07-23T10:00:00.000Z"
  }
}
```

---

## 4. Gợi Ý Luồng Tích Hợp Trên FE / Mobile

1. **Màn hình Profile / Hồ sơ người dùng:**
   * Gọi `GET /api/v1/me/ring-sizes` để hiển thị danh sách các size ngón tay đã đo và lưu của người dùng.
2. **Luồng Công cụ Đo Size (Ring Sizer Tool):**
   * Sau khi người dùng thực hiện xong các bước hướng dẫn đo (thước dây / thước nhẫn / chụp ảnh), ứng dụng gọi `POST /api/v1/me/ring-sizes` để lưu kết quả vào hồ sơ.
3. **Màn hình Ring Studio / Checkout:**
   * Người dùng có thể chọn nhanh từ danh bạ size đã lưu để điền `ringSize` khi tạo/cập nhật bản thiết kế (`PATCH /api/v1/engravings/versions/:versionId/config`).
