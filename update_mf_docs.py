import sys

file_path = r'd:\BTFPT\WDP\bioring-be\plans\business\MainFlow_Bioring.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace MF02
old_mf02 = """   - **Bước 5a - Ghi âm:** User thu âm 5-15 giây. Mobile upload MP3 lên Cloudinary → nhận `audioUrl`. Gọi `PATCH /api/v1/engravings/versions/:versionId/config { customizationConfig: { ... }, audioUrl }`. (`audioUrl` là field **riêng**, không nằm trong `customizationConfig`.)
     - Server nhận `audioUrl` → gọi gRPC `BiometricService.processAudio` → Python waveform → **tạo/update engraving_biometrics** (SW, raw_file_url, processed_svg_url, status=CAPTURED) → mobile poll GET engraving → thấy SW biometric → hiển thị waveform.
   - **Bước 5b - Chọn 3s + vị trí:** User chọn đoạn 3s, kéo slider vị trí. Gọi `PATCH /api/v1/engravings/:versionId/config { customizationConfig: { ..., engravingPositions: { sw: { selectedSegment, position } } } }`.
   - *Data đã lưu:* `engraving_biometrics` row có raw_file_url (audio), processed_svg_url (waveform SVG), extra_data (segment, durationMs). customization_config.sw có position (vị trí khắc) + status = 'captured'.
   - *Nếu user out ra sau bước 5a:* Quay lại sau → thấy `engraving_biometrics` đã có SW row với processed_svg_url → hiển thị waveform → tiếp tục bước 5b."""

new_mf02 = """   - **Bước 5a - Ghi âm:** User thu âm 5-15 giây. Mobile gọi API `POST /api/v1/me/engravings/:engravingId/biometrics` (Multipart upload) để gửi file audio trực tiếp.
     - Server lưu trữ và tạo biometric asset, trả về `biometricAssetId`. (Biometric asset chạy ngầm qua Python REVIEW pipeline để tạo PBR Textures).
   - **Bước 5b - Chọn 3s + vị trí:**
     - Mobile polling API `GET /api/v1/me/biometric-assets/:assetId/viewer-assets` để lấy bộ `viewerFiles` (normalMap, alphaMap, roughnessMap...).
     - Mobile render model 3D bằng Decal Mesh với bộ texture PBR. User chọn đoạn 3s, kéo slider vị trí. Gọi `PATCH /api/v1/engravings/:versionId/config { customizationConfig: { ..., engravingPositions: { sw: { selectedSegment, position } } } }`. Đồng thời gọi `POST /api/v1/me/biometric-assets/:assetId/confirm-placement` để chốt vị trí.
   - *Data đã lưu:* Hệ thống tạo `BiometricAsset`, lưu vết ở `engraving_biometrics`. Customization config lưu vị trí khắc.
   - *Nếu user out ra sau bước 5a:* Quay lại sau → gọi `GET /api/v1/me/engravings/:engravingId/biometrics` lấy được `biometricAssetId` → gọi `viewer-assets` → hiển thị lại model 3D → tiếp tục bước 5b."""

content = content.replace(old_mf02, new_mf02)

# Replace MF03 step 7
old_mf03_step7 = """7. Store Staff hỗ trợ lấy dữ liệu (vân tay, giọng nói, nhịp tim) thông qua IoT Device và upload lên System. Server tự động xử lý SW → waveform SVG, FP → fingerprint SVG."""

new_mf03_step7 = """7. Store Staff hỗ trợ lấy dữ liệu (vân tay, giọng nói) thông qua IoT Device:
   - Staff gọi `POST /api/v1/admin/biometric-assets/fingerprint` (hoặc `soundwave`) để upload raw data → **Python REVIEW pipeline**.
   - Staff xem kết quả render PBR qua `GET /api/v1/admin/biometric-assets/:assetId`. (Nếu cần có thể `reprocess` hoặc `textures` lại).
   - Khi hoàn thiện, Staff duyệt tài sản: `POST /api/v1/admin/biometric-assets/:assetId/approve`.
   - Cuối cùng, Staff gán asset này vào đơn hàng của khách: `POST /api/v1/admin/biometric-assets/:assetId/assign`."""

content = content.replace(old_mf03_step7, new_mf03_step7)

# Replace MF03 step 8
old_mf03_step8 = """8. **Màn hình 3 - Advanced Design (OFFLINE - với dữ liệu thật sau IoT):**
   - Hiển thị **model 3D tương tác** ở phía trên, vị trí khắc (từ Design Code) được hiển thị mặc định trên model.
   - Giao diện phụ thuộc vào tổ hợp đã chọn:
     - **Có cả SW + FP (SW+FP / ALL):** Hiển thị UI **chọn engraving type**: "Bạn muốn khắc loại nào lên nhẫn? (FP hoặc SW). Loại còn lại sẽ hiển thị trong memory card."
       - *Chọn SW:* Hiển thị **waveform thật** (từ file audio đã upload), cho chọn **đoạn 3s**, **slider** chỉnh vị trí (kế thừa từ Design Code). Lưu `engravedType = "sw"`.
       - *Chọn FP:* Hiển thị **fingerprint thật** (từ file scan đã upload), **slider** chỉnh vị trí (kế thừa từ Design Code). Lưu `engravedType = "fp"`.
     - **SW + HB / SW only:** Hiển thị waveform thật, chọn 3s, slider. Lưu `engravedType = "sw"`. (HB → memory card bước 9).
     - **FP + HB / FP only:** Hiển thị fingerprint thật, slider chỉnh vị trí. Lưu `engravedType = "fp"`. (HB → memory card bước 9).
     - **HB only:** Không có Advanced Design engraving. `engravedType = null`. Chuyển thẳng sang bước 9."""

new_mf03_step8 = """8. **Màn hình 3 - Advanced Design (OFFLINE - với dữ liệu thật sau IoT):**
   - App Customer gọi `GET /api/v1/me/engravings/:engravingId/biometrics` để lấy danh sách biometric (gồm `biometricAssetId` do Staff gán).
   - Dùng `assetId`, App gọi `GET /api/v1/me/biometric-assets/:assetId/viewer-assets` lấy bộ PBR Textures (normalMap, alphaMap, overlayPng...) và render lên model 3D (Decal Mesh).
   - Giao diện phụ thuộc vào tổ hợp đã chọn:
     - **Có cả SW + FP (SW+FP / ALL):** Hiển thị UI **chọn engraving type**: "Bạn muốn khắc loại nào lên nhẫn? (FP hoặc SW). Loại còn lại sẽ vào memory card."
       - *Sau khi chọn (VD FP):* Hiển thị PBR texture vân tay trên nhẫn 3D. Khách kéo slider vị trí. Gọi `PATCH /api/v1/engravings/:versionId/config` để lưu tọa độ. Đồng thời gọi `POST /api/v1/me/biometric-assets/:assetId/confirm-placement` để chốt Decal UV. Lưu `engravedType = "fp"|"sw"`.
     - **HB only:** Không khắc lên nhẫn. `engravedType = null`. Chuyển thẳng sang bước 9."""

content = content.replace(old_mf03_step8, new_mf03_step8)

# Replace MF04
old_mf04 = """   - **Trường hợp OFFLINE (có FP/SW):**
     - Nếu có **cả FP + SW**: Hiển thị UI chọn engraving type trước: "Chọn 1 loại để khắc lên nhẫn, loại còn lại vào memory card."
      - Sau đó hiển thị preview tương tự Flow 3, vị trí kế thừa từ bước 2. Gắn dữ liệu thật (IoT cho FP, upload/ghi âm cho SW).
     - Lưu `engravedType` tương ứng."""

new_mf04 = """   - **Trường hợp OFFLINE (có FP/SW):**
     - Staff thực hiện upload IoT (`POST /fingerprint`), sau đó duyệt (`POST /approve`) và gán (`POST /assign`) thông qua bộ API Admin của Biometric Asset.
     - App trên iPad tự động lấy `viewer-assets` của `assetId` vừa duyệt để hiển thị 3D PBR Model vô cùng chân thực ngay trước mặt khách. Khách chốt vị trí (`POST /confirm-placement`).
     - Nếu có **cả FP + SW**: Chọn 1 loại để khắc lên nhẫn.
     - Lưu `engravedType` tương ứng."""

content = content.replace(old_mf04, new_mf04)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated MainFlow_Bioring.md successfully!")
