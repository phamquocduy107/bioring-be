# Personalization Engine

FastAPI service (`:8010`) xử lý **fingerprint** (ảnh vân tay) và **soundwave** (audio ≤ 3s) thành bộ asset REVIEW → APPROVED trên MinIO, phục vụ staff preview 3D và mobile / memory card.

NestJS (biometric-service) gọi HTTP tới engine này. **PostgreSQL / NestJS** giữ status, user, order; Python **không** quản lý role/DB.

```text
Staff upload  →  process / reprocess  →  MinIO REVIEW
NestJS approve →  publish-approved    →  MinIO APPROVED (giữ REVIEW)
NestJS DB ok   →  cleanup-review      →  xóa REVIEW + local .tmp
Mobile         →  approved-viewer-assets (chỉ APPROVED)
```

Swagger: [http://localhost:8010/docs](http://localhost:8010/docs)

---

## Chạy nhanh

### Điều kiện

- Python venv + `pip install -r ../requirements.txt` (trong `python-services/`)
- MinIO đang chạy (bucket personalization)
- **Potrace** (fingerprint SVG): `tools/potrace/potrace.exe` hoặc PATH
- **FFmpeg** (soundwave mp3/m4a/…): binary hệ thống — WAV không cần

### Start

Từ **root repo**:

```bash
# copy env nếu chưa có
cp python-services/.env.example python-services/.env

npm run py:personalization
```

Hoặc trong `python-services/`:

```bash
.\.venv\Scripts\activate   # Windows
python -m uvicorn personalization_engine.main:app --host 0.0.0.0 --port 8010 --reload
```

### Health

```bash
curl http://localhost:8010/health
curl http://localhost:8010/storage/health
curl http://localhost:8010/ffmpeg/health
```

| Endpoint | Ý nghĩa |
|----------|---------|
| `GET /health` | Process sống |
| `GET /storage/health` | MinIO bucket + path templates (+ FFmpeg info) |
| `GET /ffmpeg/health` | Probe `FFMPEG_BINARY` (`ffmpeg -version`) |

---

## Storage

**MinIO là nguồn sự thật.** Local chỉ tạm:

```text
.tmp/personalization/{artifactId}/.work/{operation}_{hex}/
```

Luồng mỗi lần process / reprocess:

1. Chạy pipeline trong `.work`
2. Thành công → upload/overwrite MinIO **REVIEW**
3. Xóa `.work`
4. Fail → bản REVIEW/APPROVED cũ **không** mất

Object key:

```text
{PERSONALIZATION_MINIO_PREFIX}/{stage}/{artifactType}/{artifactId}/{filename}

stage:        review | approved
artifactType: fingerprint | soundwave
artifactId:   fp_… | sw_…
```

Ví dụ:

```text
personalization/review/fingerprint/fp_…/fingerprint_overlay.png
personalization/approved/soundwave/sw_…/audio_original.mp3
```

Public URL:

```text
{MINIO_PUBLIC_ENDPOINT}/{PERSONALIZATION_MINIO_BUCKET}/{objectKey}
```

### Env chính

```env
PERSONALIZATION_PORT=8010
PERSONALIZATION_TEMP_DIR=.tmp/personalization
PERSONALIZATION_MINIO_BUCKET=bioring-personalization
PERSONALIZATION_MINIO_PREFIX=personalization
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
FFMPEG_BINARY=ffmpeg
```

Chi tiết knobs OpenCV / texture / Potrace: xem `python-services/.env.example`.

---

## Vai trò & API

| Ai | Dùng gì |
|----|---------|
| Staff | `process`, `reprocess`, `reprocess-texture`, presets — chỉ **REVIEW** |
| NestJS | `publish-approved` → copy REVIEW → APPROVED; rồi `cleanup-review` sau DB ok |
| Mobile / memory card | `approved-viewer-assets` — chỉ **APPROVED** (+ audio soundwave) |

### Approve tách 2 bước

1. `POST …/publish-approved` — **copy** REVIEW → APPROVED, **không** xóa REVIEW  
2. NestJS cập nhật DB thành công  
3. `POST …/cleanup-review` — xóa MinIO REVIEW + local `.tmp/personalization/{id}/` (best-effort)

---

## Fingerprint

### Workflow

```text
GET  /fingerprint/presets
POST /fingerprint/process                 # upload ảnh → REVIEW (preset standard)
POST /fingerprint/{id}/reprocess          # JSON: preset + overrides
POST /fingerprint/{id}/reprocess-texture  # TexturePresetRequest (shared)
GET  /fingerprint/{id}/textures           # lấy map REVIEW
POST /fingerprint/{id}/publish-approved
GET  /fingerprint/{id}/approved-viewer-assets
POST /fingerprint/{id}/cleanup-review
```

### Ví dụ

```bash
# 1. Upload
curl -F "file=@finger.png" http://localhost:8010/fingerprint/process

# 2. Xem preset
curl http://localhost:8010/fingerprint/presets

# 3. Reprocess
curl -X POST http://localhost:8010/fingerprint/{id}/reprocess \
  -H "Content-Type: application/json" \
  -d '{"preset":"keep_ridges","minArea":8}'

# 4. Texture
curl -X POST http://localhost:8010/fingerprint/{id}/reprocess-texture \
  -H "Content-Type: application/json" \
  -d '{"preset":"realistic_default"}'

# 5. Approve
curl -X POST http://localhost:8010/fingerprint/{id}/publish-approved \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"staff-1","approvedAt":"2026-07-21T10:00:00Z","copyDebugFiles":false}'

# 6. Cleanup (sau DB ok)
curl -X POST http://localhost:8010/fingerprint/{id}/cleanup-review \
  -H "Content-Type: application/json" \
  -d '{"reason":"approved"}'
```

### Output (MinIO)

| File | Dùng |
|------|------|
| `fingerprint_overlay.png` | Decal nhìn thấy |
| `fingerprint_alpha.png` | Mask trong suốt |
| `fingerprint_heightmap.png` | Độ sâu khắc |
| `fingerprint_normal.png` | Normal map |
| `fingerprint_roughness.png` | Độ nhám |
| `fingerprint_ao.png` | Ambient occlusion |
| `fingerprint.svg` | Production vector |
| `input.png`, `06_final_clean.png` | REVIEW — reprocess (debug/source) |
| `options.json`, `artifact_manifest.json` | Metadata |

API `viewerFiles` map sang: `overlayPng`, `alphaMap`, `heightmap`, `normalMap`, `roughnessMap`, `aoMap`.

---

## Soundwave

### Workflow

```text
GET  /soundwave/presets
POST /soundwave/process                   # multipart: file + segmentStartMs + segmentDurationMs (≤3000)
POST /soundwave/{id}/reprocess            # JSON: preset / style / overrides
POST /soundwave/{id}/reprocess-texture
POST /soundwave/{id}/publish-approved     # luôn copy audio_original.* + audio_segment.wav
GET  /soundwave/{id}/approved-viewer-assets  # maps + audioOriginal + audioSegment
POST /soundwave/{id}/cleanup-review
```

`process` luôn dùng preset **`standard`**. Staff tinh chỉnh qua `reprocess` + `GET /soundwave/presets`.

### Styles

`line` · `bars` · `filled_bars` · `outline` · `center_line` · `dots` · `steps` · `ridge`

### Ví dụ

```bash
# 1. Upload đoạn audio (3s từ ms 0)
curl -F "file=@voice.mp3" -F "segmentStartMs=0" -F "segmentDurationMs=3000" \
  http://localhost:8010/soundwave/process

# 2. Presets
curl http://localhost:8010/soundwave/presets

# 3. Đổi style
curl -X POST http://localhost:8010/soundwave/{id}/reprocess \
  -H "Content-Type: application/json" \
  -d '{"preset":"ridge"}'
# hoặc
curl -X POST http://localhost:8010/soundwave/{id}/reprocess \
  -H "Content-Type: application/json" \
  -d '{"style":"outline","smoothing":0.2}'

# 4. Approve + cleanup (giống fingerprint)
```

### Output thêm (so với fingerprint)

| File | Dùng |
|------|------|
| `soundwave_*` maps / `soundwave.svg` | Giống fingerprint (prefix `soundwave_`) |
| `waveform_points.json` | Data sóng — reprocess style |
| `audio_original.*` | **Raw upload** — nghe trên memory card |
| `audio_segment.wav` | Clip ≤3s khớp đoạn khắc |

REVIEW / APPROVED response có:

- `productionFiles.audioOriginal`
- `productionFiles.audioSegment`
- `GET …/approved-viewer-assets` → fields `audioOriginal`, `audioSegment`

### FFmpeg

Binary hệ thống (`FFMPEG_BINARY`), không cài qua pip. Dùng decode mp3/m4a/aac/ogg (qua pydub).

```bash
# Windows: thêm ffmpeg vào PATH hoặc
FFMPEG_BINARY=C:\ffmpeg\bin\ffmpeg.exe

# macOS
brew install ffmpeg

# Debian / Docker
apt-get install -y ffmpeg
```

Thiếu FFmpeg với file nén → HTTP 500: cài FFmpeg hoặc upload WAV.

---

## Texture presets (chung)

```text
GET  /texture-presets
POST /fingerprint/{id}/reprocess-texture
POST /soundwave/{id}/reprocess-texture
```

Body `TexturePresetRequest`: `preset` + optional overrides (`heightmapBlur`, `normalStrength`, …).

---

## API map nhanh

| Method | Path | Tag |
|--------|------|-----|
| GET | `/health` | Health |
| GET | `/ffmpeg/health` | Health |
| GET | `/storage/health` | Storage |
| GET | `/texture-presets` | Texture |
| GET | `/fingerprint/presets` | Fingerprint |
| POST | `/fingerprint/process` | Fingerprint |
| POST | `/fingerprint/{id}/reprocess` | Fingerprint |
| POST | `/fingerprint/{id}/reprocess-texture` | Fingerprint |
| GET | `/fingerprint/{id}/textures` | Fingerprint |
| POST | `/fingerprint/{id}/publish-approved` | Fingerprint |
| GET | `/fingerprint/{id}/approved-viewer-assets` | Fingerprint |
| POST | `/fingerprint/{id}/cleanup-review` | Fingerprint |
| GET | `/soundwave/presets` | Soundwave |
| POST | `/soundwave/process` | Soundwave |
| POST | `/soundwave/{id}/reprocess` | Soundwave |
| POST | `/soundwave/{id}/reprocess-texture` | Soundwave |
| POST | `/soundwave/{id}/publish-approved` | Soundwave |
| GET | `/soundwave/{id}/approved-viewer-assets` | Soundwave |
| POST | `/soundwave/{id}/cleanup-review` | Soundwave |
| POST | `/heartbeat/store` | Heartbeat (raw → MinIO APPROVED) |

Chi tiết schema / request body: **Swagger UI** tại `/docs`.
