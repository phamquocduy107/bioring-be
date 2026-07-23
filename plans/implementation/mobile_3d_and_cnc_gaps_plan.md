# Cập nhật API Backend hỗ trợ Mobile (Thiết kế, 3D & File CNC)

Kế hoạch này lưu trữ các cập nhật về API Backend để phục vụ hiển thị 3D trên Mobile, làm rõ quy trình chọn size nhẫn và sinh file sản xuất CNC cho thợ kim hoàn.

---

## 1. Vấn đề Ring Size cho Design Draft
- Trường `ringSize` ở cả Database (`schema.prisma`) và API (`CreateDesignDraftDto` / `UpdateDesignDraftDto`) **đã là tuỳ chọn (optional)**. 
- Mobile và Web hoàn toàn có thể tạo/cập nhật Draft mà **không cần truyền `ringSize`**. 
- Dữ liệu lưu `null`, khách hàng bổ sung thông tin này sau trên Mobile (thông qua công cụ đo size).

---

## 2. Thêm trường hiển thị 3D cho Material & Gemstone
Thêm trường `render_config` (dạng `Json?`) vào cả 2 bảng `materials` và `gemstones` trong Prisma Schema:

```prisma
model materials {
  // ... existing fields
  render_config          Json?    // Cấu hình 3D (VD: textureUrl, metalness, roughness, colorHex...)
}

model gemstones {
  // ... existing fields
  render_config          Json?    // Cấu hình 3D (VD: colorHex, refractiveIndex, dispersion...)
}
```

Việc dùng kiểu `Json` giúp Mobile và Web chủ động định nghĩa các thông số đồ hoạ cần thiết mà không phải sửa schema backend nhiều lần.

---

## 3. Xuất file khắc CNC cho thợ sản xuất (Jeweler)
Để Jeweler có thể tải/xuất file kỹ thuật dùng chạy máy khắc CNC lên nhẫn thực tế:
- Backend tích hợp với Python service (hoặc module chuyển đổi vector) để tự động sinh file khắc CNC (định dạng DXF / G-code / SVG chuẩn khắc) dựa trên hình ảnh vector (Fingerprint SVG hoặc Soundwave SVG) và tọa độ vị trí khắc đã duyệt (`customization_config`).
- Cập nhật URL file này vào `production_file_url` trong bảng `engraving_versions`.
- Thêm API cho Jeweler / Production Staff: `GET /api/v1/orders/production-tasks/:taskId/cnc-file` (hoặc trả về trực tiếp URL file CNC trong thông tin `production_task` / `engraving`).

---

## Danh sách file sẽ thay đổi khi triển khai (Proposed Changes)

### Database & Schema
- `libs/prisma/prisma/schema.prisma`: Thêm `render_config` vào `materials` & `gemstones`. Chạy `npx prisma migrate dev`.

### Services & DTOs
- `libs/common/src/dtos/ecommerce/material.dto.ts` & `gemstone.dto.ts`: Thêm field `renderConfig`.
- `apps/ecommerce-service/src/material/` & `gemstone/`: Update service & mapper trả về `renderConfig`.

### CNC Export Module
- Python `biometric-service` hoặc NestJS module sinh file CNC từ vector SVG + `customization_config`.
- Update `production_tasks` / `engravings` API trả về `production_file_url`.
