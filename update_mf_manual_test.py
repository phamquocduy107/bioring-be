import re

file_mf02 = r'd:\BTFPT\WDP\bioring-be\plans\manual-testing\MF02-online-order-flow.md'

with open(file_mf02, 'r', encoding='utf-8') as f:
    mf02 = f.read()

# Replace the MF02 Upload step
old_mf02_step6 = """## 6. Upload audio biometric + chọn segment

> Sau tạo order, user ghi âm → upload file audio trực tiếp qua multipart `POST /api/v1/engravings/:id/biometrics`.
> Server gửi file sang Personalization Engine xử lý & lưu trên MinIO (stage `REVIEW`), tự động gán `biometricAssetId` và sinh `processedSvgUrl` (Waveform SVG).

```http
POST /api/v1/engravings/ENGRAVING_ID/biometrics"""

new_mf02_step6 = """## 6. Upload audio biometric + Lấy PBR Textures

> Sau tạo order, user ghi âm → upload file audio trực tiếp qua multipart `POST /api/v1/me/engravings/:engravingId/biometrics`.
> Server (Auto-Approve): gửi file sang Python Engine xử lý, tự động duyệt và tự động gán (`BiometricAsset`) vào bản khắc. Trả về `biometricAssetId`.

```http
POST /api/v1/me/engravings/ENGRAVING_ID/biometrics"""

mf02 = mf02.replace(old_mf02_step6, new_mf02_step6)

old_mf02_response = """> Server nhận file qua multipart, gọi Python Personalization Engine xử lý waveform → tạo `biometric_assets` record & trả về `processedSvgUrl` (SVG đã xử lý). Cả raw audio (dùng cho mem card) và processed SVG (dùng cho khắc) đều được lưu.
> FE có thể gọi GET engraving → thấy `engraving_biometrics` list → render SW vào vị trí đã đặt."""

new_mf02_response = """> Backend gọi Python Pipeline xử lý waveform, tự động Publish (Approve) và gán Asset cho Customer. Trả về `biometricAssetId`.

### 6b. Lấy PBR Textures (viewer-assets) để hiển thị 3D

> FE dùng `biometricAssetId` vừa nhận để lấy các map (normal, alpha...) render Decal Mesh.

```http
GET /api/v1/me/biometric-assets/ASSET_ID_001/viewer-assets
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response mẫu:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "asset": {
      "assetId": "ASSET_ID_001",
      "viewerFiles": {
        "overlayPng": "http://...",
        "alphaMap": "http://...",
        "normalMap": "http://..."
      }
    }
  }
}
```
> FE lấy `viewerFiles` ốp vào 3D model. Sau đó người dùng chỉnh slider vị trí và `PATCH /api/v1/engravings/versions/VERSION_ID/config` để lưu tọa độ."""

mf02 = mf02.replace(old_mf02_response, new_mf02_response)

with open(file_mf02, 'w', encoding='utf-8') as f:
    f.write(mf02)

print("Updated MF02.")
