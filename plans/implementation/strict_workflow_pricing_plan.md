# Chuyển đổi sang luồng Business Flow chặt chẽ (Strict Workflow)

Dưới đây là kế hoạch chi tiết đã được cập nhật hoàn chỉnh, bao gồm logic tính giá theo Size Nhẫn và các hạng mục cập nhật Document. **(Chưa có code nào được sửa)**.

## Công thức tính giá Nhẫn (Pricing Formula)

Sử dụng phương pháp Hardcode Constants tạm thời cho trọng lượng:

```typescript
// Các hằng số (Constants) dùng cho việc tính trọng lượng
const BASE_WEIGHT_GRAMS = 3.0; // Trọng lượng gốc của nhẫn (Size tham chiếu)
const BASE_RING_SIZE = 10;     // Size nhẫn tham chiếu (Chuẩn)
const WEIGHT_PER_SIZE = 0.1;   // Mỗi size lớn hơn cộng thêm 0.1 gram
```

   **Công thức tính toán trong Backend (`calculatePrice`):**
   1. Xác định `ringSize` (ví dụ: Size 14).
   2. Tính trọng lượng ước tính: `Weight = BASE_WEIGHT_GRAMS + (14 - BASE_RING_SIZE) * WEIGHT_PER_SIZE` = 3.0 + (4 * 0.1) = 3.4 grams.
   3. Tính giá Vật liệu: `Material Cost = Weight * current_price_per_gram` (Lấy từ bảng `materials`).
   4. Tính tổng giá (Total Price): `Material Cost + Gemstone Cost (nếu có) + Service Fee`.

## Đánh giá tác động và Luồng mới (Impact Analysis & New Flow)

### 1. Khóa Cấu hình (Config Locking)
- **Khi nào khóa?** Ngay khi Order được tạo (tức là bước chuyển sang màn hình thanh toán Deposit 1).
- **Khóa những gì?** `selectedMaterialId`, `selectedGemstoneId`, `ringSize`, `ringStyle`, `ringShape`, `selectedBiometrics` (Package).
- **Trường hợp bị Reject (`REVISION_REQUIRED`)?** Vẫn giữ nguyên trạng thái khóa. Khách hàng **TUYỆT ĐỐI KHÔNG** được phép đổi size nhẫn, vật liệu, hay package đã mua. Họ chỉ được phép:
  - Chỉnh sửa lại vị trí khắc (của Asset thật).
  - Thu âm / Lấy mẫu sinh trắc học lại.

### 2. Xóa bỏ Placeholder (No Temp Positioning)
- Màn hình 3D sẽ **chặn** không cho phép chỉnh sửa vị trí nếu chưa có Biometric Asset thật.
- Giao diện Advanced Design sẽ yêu cầu người dùng phải thực hiện lấy mẫu (tại Store hoặc thu âm trên App) để Backend duyệt $\rightarrow$ gán Asset $\rightarrow$ sinh ra PBR Textures (`viewer-assets`).
- Chỉ khi App fetch được PBR Textures thật thì người dùng mới được phép kéo thả, chọn đoạn 3s và chốt vị trí.

### 3. Validate Submit Order
- Khi gọi API `PATCH /api/v1/orders/:id/submit` (chuyển sang `PENDING_REVIEW`), Backend sẽ kiểm tra chéo:
  - Asset của các Biometric Type tương ứng đã thực sự được Approve và Assign chưa?
  - Hệ thống **không** ràng buộc cấu trúc (format) cố định bên trong `customizationConfig`, mà chỉ validate xem dữ liệu gửi lên có phải là JSON hợp lệ hay không. (Các trường JSON trong Model chỉ cần đúng định dạng JSON).
  - Nếu có type chưa được upload và duyệt Asset, API sẽ trả về lỗi HTTP 400.

## Kế hoạch Cập nhật Tài liệu (Documentation Updates)

Đảm bảo tuân thủ tuyệt đối các quy định trong `plans/rule.md` (chuẩn response `{ statusCode, message, data }`, rule về UUID, format của `customization_config`).

1. **`plans/business/MainFlow_Bioring.md`**: 
   - Cập nhật luồng thiết kế để thể hiện rõ: "Chốt Base/Package/Size $\rightarrow$ Tạo Order $\rightarrow$ Lock Config $\rightarrow$ Lấy mẫu $\rightarrow$ Chỉnh vị trí $\rightarrow$ Submit".
   - Cập nhật rule về `REVISION_REQUIRED` (chỉ cho phép sửa vị trí, không được sửa material/size/gem).
2. **`plans/manual-testing/` (MF02, MF03, MF04)**:
   - Sửa kịch bản test để phản ánh việc API `PATCH config` sẽ ném lỗi `400 Bad Request` nếu cố gắng đổi `material/size/gem` sau khi Order đã được tạo.
   - Thêm case test cho việc `Submit Order` bị lỗi 400 nếu chưa có Biometric Asset.
   - **Tích hợp Biometric Asset APIs vào test cases**:
     - Cập nhật kịch bản MF02 (Online SW) sử dụng `POST /api/v1/admin/biometric-assets/soundwave` để upload âm thanh.
     - Cập nhật kịch bản MF03, MF04 (Offline) sử dụng `POST /api/v1/admin/biometric-assets/fingerprint` (kèm `preset_id` lấy từ `GET /presets`) và `POST /api/v1/admin/biometric-assets/heartbeat`.
     - Thêm các bước duyệt Asset (`POST /approve`) và gán Asset (`POST /assign`) thông qua bộ API Admin.
     - Cập nhật bước lấy Asset để hiển thị 3D thông qua `GET /api/v1/me/biometric-assets/:assetId/viewer-assets`.
3. **`plans/business/api-reference.md`**:
   - Cập nhật description của API `PATCH /api/v1/engravings/versions/:versionId/config` để cảnh báo về hành vi khóa các trường giá trị.
   - Bổ sung thông tin lỗi HTTP 400 vào API Submit Order nếu chưa upload Biometric Asset (khác với vị trí tọa độ).
   - Đảm bảo danh sách các API Biometric Asset (`fingerprint`, `soundwave`, `heartbeat`, `reprocess`, `textures`, `approve`, `assign`) được định nghĩa chuẩn xác và đồng bộ với luồng thực tế.

Kế hoạch này đã được lưu cứng vào `d:\BTFPT\WDP\bioring-be\plans\implementation\strict_workflow_pricing_plan.md`.
