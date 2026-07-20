# Personalization Engine

FastAPI: fingerprint → clean PNG / SVG (potrace) → texture maps for 3D engraving preview.

## Run

```bash
npm run py:personalization
# Docs: http://localhost:8010/docs
```

## Storage (MinIO REVIEW → APPROVED)

Local `.tmp/personalization/{artifactId}/` chỉ là nơi xử lý tạm trong quá trình chạy pipeline.
Tất cả asset public đều được phục vụ qua MinIO với 2 prefix:

```text
REVIEW:   personalization/review/{artifactId}/{filename}
APPROVED: personalization/approved/{artifactId}/{filename}
```

URL public (không hết hạn — không dùng presigned URL):

```text
{MINIO_PUBLIC_ENDPOINT}/{PERSONALIZATION_MINIO_BUCKET}/{objectKey}
```

Bucket `bioring-personalization` được set **public-read** (`s3:GetObject` anonymous) khi engine start. Nếu mở URL bị `AccessDenied`, restart `npm run py:personalization` hoặc set policy thủ công trên MinIO Console.
Env (xem `python-services/.env.example`):

```env
PERSONALIZATION_MINIO_BUCKET=bioring-personalization
PERSONALIZATION_MINIO_PREFIX=personalization
MINIO_ENDPOINT=localhost:9000
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
```

### Kiểm tra storage

```bash
curl http://localhost:8010/storage/health

# Dev upload test
curl -X POST http://localhost:8010/storage/test-upload \
  -F "file=@path/to/test.png"
```

Mỗi artifact có `artifact_manifest.json` (local + MinIO) — liệt kê file mới nhất, `lastOperation`, URL/object key.

### Replace policy (cùng artifactId)

| Operation | Giữ | Replace / xóa |
|-----------|-----|----------------|
| **process** | — | Tạo `artifactId` mới, sync toàn bộ dir |
| **reprocess** | `input.png` | `06_final_clean.png`, SVG, pipeline, texture maps (+ baked/production nếu có) |
| **reconvert** | `input.png`, `06_final_clean.png`, texture maps | Chỉ `fingerprint.svg` (+ xóa `fingerprint_placed.svg`, `manufacturing_metadata.json`) |
| **textures** | input, final PNG, SVG | Chỉ texture maps (+ baked cũ) |

Atomic replace: output tạo trong `.work/{operation}_{uuid}/` trước; chỉ replace khi thành công — fail thì giữ bản cũ.

## Workflow khuyến nghị

```
1. POST /fingerprint/process
   → chỉ upload ảnh, thông số chuẩn cố định
   → xem 06_final_clean.png + fingerprint.svg

2. Nếu chưa đẹp
   → POST /fingerprint/{artifactId}/reprocess
   → chọn preset + chỉnh knobs cần thiết

3. Nếu PNG đã đẹp nhưng SVG chưa
   → POST /fingerprint/{artifactId}/reconvert
   → chỉ chỉnh Potrace (turdsize / opttolerance)

4. Cuối cùng
   → POST /fingerprint/{artifactId}/textures
   → tạo / regenerate bộ texture maps
   → GET  /fingerprint/{artifactId}/textures  (lấy maps đã có)
```

| API | Việc làm |
|-----|----------|
| `POST /fingerprint/process` | Upload only — fixed standard params → PNG + SVG |
| `GET  /fingerprint/presets` | Preset reprocess + giải thích tham số |
| `GET  /fingerprint/texture-presets` | Preset texture maps + giải thích tham số |
| `POST /fingerprint/{id}/reprocess` | OpenCV + SVG lại — `preset` + knobs |
| `POST /fingerprint/{id}/reconvert` | Chỉ Potrace từ `06_final_clean.png` |
| `POST /fingerprint/{id}/textures` | Tạo / regenerate texture maps (preset + override) |
| `GET  /fingerprint/{id}/textures` | Lấy texture maps đã có |
| `POST /fingerprint/{id}/publish-approved` | NestJS approve: copy REVIEW → APPROVED, **xóa toàn bộ** `review/{artifactId}/` |
| `GET  /fingerprint/{id}/approved-viewer-assets` | Mobile: chỉ URL APPROVED |

Sau **publish-approved**:

- MinIO prefix `personalization/review/{artifactId}/` bị xóa hết (manifest, PNG, SVG, debug…).
- Manifest APPROVED không còn `reviewPrefix`.
- NestJS `approve` set `review_files = null` trong PostgreSQL — client chỉ thấy `approvedFiles`.

## Reprocess presets

| Preset | Khi nào dùng |
|--------|--------------|
| `standard` | Ảnh rõ, ít nhiễu |
| `keep_ridges` | Mất nhiều nét |
| `clean_noise` | Nhiều nhiễu |
| `thick_ridges` | Vân quá mỏng/đứt |
| `less_crop` | Bị cắt mép ngoài |

Giải thích nhanh:

- `minArea` tăng → sạch hơn nhưng dễ mất nét
- `adaptiveC` giảm → vân dày/liền hơn
- `erodeSize` giảm → giữ mép ngoài nhiều hơn
- `applyMorphology` true → sạch hơn nhưng dễ đứt nét
- `turdsize` giảm → SVG giữ nhiều path nhỏ hơn
- `opttolerance` giảm → SVG giữ nhiều chi tiết hơn

Knobs có thể override sau preset: `minArea`, `adaptiveC`, `erodeSize`, `applyMorphology`, `turdsize`, `opttolerance`.

## Texture presets

| Preset | Khi nào dùng |
|--------|--------------|
| `realistic_default` | Preview mặc định |
| `deep_engrave` | Rãnh nhìn quá nông |
| `soft_engrave` | Rãnh quá gắt/giả |
| `sharp_detail` | Muốn vân rõ hơn |
| `subtle_luxury` | Khắc nhẹ, cao cấp |

## Curl examples

```bash
# GET preset reprocess
curl http://localhost:8010/fingerprint/presets

# GET preset texture
curl http://localhost:8010/fingerprint/texture-presets

# 1. Upload (không params)
curl -X POST http://localhost:8010/fingerprint/process \
  -F "file=@.tmp/personalization/test_fp.png"

# 2. Reprocess với preset
curl -X POST http://localhost:8010/fingerprint/{artifactId}/reprocess \
  -H "Content-Type: application/json" \
  -d "{\"preset\":\"less_crop\"}"

# 3. Reconvert SVG only
curl -X POST http://localhost:8010/fingerprint/{artifactId}/reconvert \
  -H "Content-Type: application/json" \
  -d "{\"turdsize\":2,\"opttolerance\":0.05}"

# 4. Texture maps bằng preset
curl -X POST http://localhost:8010/fingerprint/{artifactId}/textures \
  -H "Content-Type: application/json" \
  -d "{\"preset\":\"deep_engrave\"}"

# Preset + override
curl -X POST http://localhost:8010/fingerprint/{artifactId}/textures \
  -H "Content-Type: application/json" \
  -d "{\"preset\":\"deep_engrave\",\"normalStrength\":4.0,\"aoStrength\":0.7}"

# Lấy maps đã có
curl http://localhost:8010/fingerprint/{artifactId}/textures
```

## Texture maps for 3D engraving preview

Chỉ tạo ở bước `/textures` (không auto trong process/reprocess):

| File | Mục đích |
|------|---------|
| `fingerprint_heightmap.png` | Displacement/bump map để tạo lõm/nổi |
| `fingerprint_normal.png` | Normal map để ánh sáng giống rãnh khắc |
| `fingerprint_roughness.png` | Vùng khắc nhám hơn |
| `fingerprint_ao.png` | Tạo shadow trong rãnh |

Env knobs (xem `python-services/.env.example`):

- `FINGERPRINT_HEIGHTMAP_BLUR=1.2`
- `FINGERPRINT_NORMAL_STRENGTH=2.5`
- `FINGERPRINT_ROUGHNESS_BASE=180`
- `FINGERPRINT_ROUGHNESS_RIDGE=235`
- `FINGERPRINT_AO_STRENGTH=0.45`
- `FINGERPRINT_ENGRAVE_DEPTH=0.18`

### Three.js usage

```js
const heightTexture = textureLoader.load(files.heightmap)
const normalTexture = textureLoader.load(files.normalMap)
const roughnessTexture = textureLoader.load(files.roughnessMap)
const aoTexture = textureLoader.load(files.aoMap)

material.bumpMap = heightTexture
material.bumpScale = -0.08

material.normalMap = normalTexture
material.normalScale = new THREE.Vector2(1, 1)

material.roughnessMap = roughnessTexture
material.aoMap = aoTexture
```

Nếu dùng displacement:

- geometry phải nhiều subdivisions
- `CylinderGeometry` `heightSegments` nên từ 64–128
- `radialSegments` nên 256–512

```js
material.displacementMap = heightTexture
material.displacementScale = -0.03
```

Ghi chú:

- Heightmap: nền trắng (cao), vân đen (lõm). `displacementScale` âm → khắc lõm.
- Nếu ánh sáng normal bị ngược: thử `normalScale.y = -1`.
- Roughness map càng trắng càng nhám — vùng khắc mặc định nhám hơn nền kim loại.
