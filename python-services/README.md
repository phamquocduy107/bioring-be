# BIORING Python Services

Thư mục Python chung cho các microservice AI / media của BIORING backend.  
Trước đây tên `rag-python`, đã đổi thành `python-services` và mở rộng thêm **personalization_engine**.

```text
python-services/
├── rag_engine/              # RAG chat — FastAPI :8000
├── ingestion_worker/        # PDF ingestion → Qdrant — RabbitMQ worker
├── personalization_engine/  # Fingerprint / SVG / texture maps — FastAPI :8010
├── shared/                  # nest_log và util dùng chung
├── tools/potrace/           # potrace.exe (Windows) cho vector hóa SVG
├── .env / .env.example
└── requirements.txt
```

---

## Tổng quan kiến trúc

```text
                    ┌─────────────────┐
                    │  NestJS (RAG)   │
                    │  rag-service    │
                    └────────┬────────┘
                             │ HTTP
                             ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  RabbitMQ    │─────▶│ ingestion_   │─────▶│   Qdrant     │
│  (jobs)      │      │ worker       │      │  (vectors)   │
└──────────────┘      └──────┬───────┘      └──────▲───────┘
                             │ MinIO               │
                             ▼                     │ retrieve
                      ┌──────────────┐             │
                      │  PDF store   │      ┌──────┴───────┐
                      └──────────────┘      │  rag_engine  │
                                            │  :8000       │
                                            └──────────────┘

┌─────────────────┐      ┌──────────────────────┐
│ biometric-svc   │─────▶│ personalization_     │
│ (sau này)       │ HTTP │ engine :8010         │
└─────────────────┘      │ → PNG / SVG / maps   │
                         └──────────────────────┘
```

| Service | Port / runtime | Vai trò |
|---------|----------------|---------|
| `rag_engine` | `:8000` | Intent + retrieval + LLM trả lời chat |
| `ingestion_worker` | RabbitMQ consumer | PDF → chunk → embed → Qdrant |
| `personalization_engine` | `:8010` | Vân tay → PNG sạch / SVG / texture maps 3D |

---

## 1. Cài môi trường

```bash
cd python-services
python -m venv .venv

# Windows
.\.venv\Scripts\activate
pip install -r requirements.txt

# macOS / Linux
# source .venv/bin/activate
# pip install -r requirements.txt

copy .env.example .env   # Windows
# cp .env.example .env   # Unix
```

Chỉnh `.env` theo infra local (Qdrant, RabbitMQ, MinIO, LM Studio, …).

**Potrace (SVG vân tay):** trên Windows đặt `potrace.exe` vào `tools/potrace/` hoặc cài vào PATH. Xem [tools/potrace/README.md](tools/potrace/README.md).

**FFmpeg (soundwave decode):** system binary — **không** cài qua pip. Docker: `apt-get install -y ffmpeg`. Windows: cài FFmpeg + PATH, hoặc set `FFMPEG_BINARY`. WAV không cần FFmpeg. Chi tiết: [personalization_engine/README.md](personalization_engine/README.md).

---

## 2. Chạy service

Từ **root repo** (dùng `scripts/py.js` — tự chọn `python-services/.venv`):

```bash
npm run py:rag              # rag_engine :8000
npm run py:rag-worker       # ingestion_worker (RabbitMQ)
npm run py:personalization  # personalization_engine :8010

npm run py:rag-stack        # rag + worker
npm run py:all              # rag + worker + personalization
```

Alias cũ vẫn hoạt động: `rag:engine`, `rag:worker`, `rag:python`.

Chạy trực tiếp trong `python-services/`:

```bash
python -m uvicorn rag_engine.main:app --host 0.0.0.0 --port 8000 --reload
python -m ingestion_worker.rabbitmq_worker
python -m uvicorn personalization_engine.main:app --host 0.0.0.0 --port 8010 --reload
```

---

## 3. Health check

```bash
curl http://localhost:8000/health   # rag_engine
curl http://localhost:8010/health   # personalization_engine
```

Swagger:

- RAG: http://localhost:8000/docs
- Personalization: http://localhost:8010/docs

---

## 4. RAG Engine (`rag_engine`)

FastAPI phục vụ chat knowledge: phân loại intent, retrieve Qdrant, gọi LLM local (OpenAI-compatible).

### API chính

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/health` | Trạng thái + collection / model |
| `POST` | `/intent/detect` | Rules-first intent + slot extraction |
| `POST` | `/query` | Retrieve + LLM → câu trả lời |

### Phụ thuộc

- **Qdrant** — vector store (`QDRANT_URL`, `QDRANT_COLLECTION`)
- **LLM / Embedding** — LM Studio hoặc API tương thích (`OPENAI_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`)

### Env quan trọng

| Nhóm | Biến | Ghi chú |
|------|------|---------|
| Qdrant | `QDRANT_URL`, `QDRANT_COLLECTION` | Collection chunks |
| LLM | `OPENAI_BASE_URL`, `LLM_MODEL` | Chat completion |
| Embedding | `EMBEDDING_MODEL` | Vector hóa query |
| Intent | `INTENT_RULES_FIRST`, `ENABLE_LLM_INTENT_FALLBACK` | Ưu tiên rule, hạn chế gọi LLM |
| Retrieval | `DEFAULT_TOP_K`, `*_SCORE_THRESHOLD` | Top-K theo intent |
| Cache | `CACHE_*`, `CACHE_TTL_SECONDS` | In-memory (Redis sau) |
| Debug | `DEBUG_RAG=true` | Log llmCalls, cacheHit, … |

NestJS `rag-service` proxy sang Python engine — prototype chat: [prototype/bioring-chat-ui](../prototype/bioring-chat-ui/README.md).

---

## 5. Ingestion Worker (`ingestion_worker`)

Consumer RabbitMQ: nhận job ingest PDF từ NestJS, lưu MinIO, chunk, embed, upsert Qdrant.

### Routing keys

- `document.ingestion.requested` — ingest mới
- `document.ingestion.reindex` — reindex
- `document.vectors.delete` — xóa vectors

Status publish qua `RABBITMQ_STATUS_QUEUE`.

### Luồng

```text
NestJS upload PDF → RabbitMQ job → worker
  → MinIO (file gốc)
  → pdf_processor (chunk)
  → embedding
  → qdrant_store (upsert)
  → status queue (PENDING → PROCESSING → READY / FAILED)
```

### Phụ thuộc

- RabbitMQ (`RABBITMQ_*`)
- MinIO (`MINIO_*`)
- Qdrant
- Cùng embedding endpoint với `rag_engine`

Chạy: `npm run py:rag-worker`

---

## 6. Personalization Engine (`personalization_engine`)

FastAPI xử lý ảnh vân tay → PNG sạch, SVG (potrace), texture maps cho preview khắc 3D.

Chi tiết API, preset, curl: **[personalization_engine/README.md](personalization_engine/README.md)**

### Workflow khuyến nghị

```text
1. POST /fingerprint/process            → upload, thông số chuẩn → PNG + SVG
2. POST /fingerprint/{id}/reprocess     → preset + knobs (OpenCV + SVG)
3. POST /fingerprint/{id}/reprocess-texture → height / normal / roughness / AO maps
4. GET  /fingerprint/{id}/textures      → lấy maps đã có
```

### API bổ sung

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/fingerprint/presets` | Preset reprocess + `parameterGuide` |
| `GET` | `/texture-presets` | Preset texture 3D (shared fingerprint + soundwave) |

### Artifacts & storage

MinIO is the primary store. Object key:

`personalization/{stage}/{artifactType}/{artifactId}/{filename}`

| Stage / type | Object key example |
|--------------|-------------------|
| Fingerprint REVIEW | `personalization/review/fingerprint/fp_…/fingerprint_overlay.png` |
| Fingerprint APPROVED | `personalization/approved/fingerprint/fp_…/fingerprint_overlay.png` |
| Soundwave REVIEW | `personalization/review/soundwave/sw_…/soundwave.svg` |
| Soundwave APPROVED | `personalization/approved/soundwave/sw_…/soundwave.svg` |

URL: `{MINIO_PUBLIC_ENDPOINT}/{PERSONALIZATION_MINIO_BUCKET}/{objectKey}`

Local `.tmp/personalization/{artifactId}/.work/` is temporary only.

| File | Mục đích |
|------|----------|
| `input.png` | Ảnh gốc upload (fingerprint) |
| `06_final_clean.png` | Vân tay binary sạch |
| `fingerprint.svg` | Vector (potrace) |
| `artifact_manifest.json` | Manifest + stage/status |
| `fingerprint_*` texture maps | 3D preview |
| `soundwave.svg` / `waveform_points.json` | Soundwave production |

Storage health: `GET /storage/health`

**Replace policy:** `reprocess` / `reprocess-texture` reuse the same `artifactId` — overwrite REVIEW only (atomic via `.work/`). Texture presets: `GET /texture-presets` (shared). `publish-approved` copies to APPROVED; `cleanup-review` deletes REVIEW after NestJS DB approve. Details: [personalization_engine/README.md](personalization_engine/README.md).

### Prototype UI

- API + gallery: [prototype/fingerprint-personalization-ui](../prototype/fingerprint-personalization-ui/README.md)
- 3D ring preview (Three.js): cùng folder, bước 5 sau khi generate textures

---

## 7. Shared (`shared/`)

| Module | Vai trò |
|--------|---------|
| `nest_log.py` | Logger format giống NestJS (`setup_logging("ENGINE")`, …) |
| `minio_client.py` | MinIO client mỏng dùng chung: `MinioObjectStore`, upload/download/delete |

Cả 3 service import `from shared.nest_log import setup_logging`.  
`ingestion_worker` và `personalization_engine` dùng `shared.minio_client` cho kết nối MinIO (bucket/key vẫn theo từng service).

---

## 8. Biến môi trường (`.env.example`)

Hai file mẫu cần **đồng bộ** các biến liên quan:

| Nest (root `.env.example`) | Python (`python-services/.env.example`) |
|----------------------------|------------------------------------------|
| `RABBITMQ_INGESTION_*`, `RABBITMQ_STATUS_QUEUE` | cùng tên |
| `MINIO_BUCKET=knowledge-documents` | cùng giá trị |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | cùng giá trị |
| `MINIO_ENDPOINT` + `MINIO_PORT` + `MINIO_USE_SSL` | `MINIO_ENDPOINT=host:port` + `MINIO_SECURE` |
| `QDRANT_URL` / `QDRANT_COLLECTION=rag_chunks` | cùng giá trị |
| `MAX_RECENT_MESSAGES`, … | cùng tên / giá trị |
| `RAG_ENGINE_URL=http://localhost:8000` | (Nest gọi Python) |
| `PERSONALIZATION_ENGINE_URL=http://localhost:8010` | `PERSONALIZATION_PORT=8010` |

Nhóm chính theo service:

| Nhóm | Service |
|------|---------|
| `RABBITMQ_*`, `MINIO_*` | ingestion_worker (+ Nest rag-service) |
| `QDRANT_*`, `OPENAI_*`, `LLM_*`, `EMBEDDING_*`, `INTENT_*`, `CACHE_*` | rag_engine |
| `PERSONALIZATION_*`, `FINGERPRINT_*`, `POTRACE_*`, `FFMPEG_BINARY` | personalization_engine |

Copy `.env.example` → `.env` và chỉnh theo môi trường dev.

---

## 9. Dependencies (`requirements.txt`)

| Package | Dùng cho |
|---------|----------|
| `fastapi`, `uvicorn`, `pydantic` | HTTP services |
| `qdrant-client`, `langchain-*` | RAG + ingestion |
| `pika`, `minio` | Worker queue + storage |
| `opencv-python`, `numpy`, `pillow` | Fingerprint pipeline |
| `pydub` | Soundwave decode bridge (calls FFmpeg binary) |
| `audioop-lts` | Python 3.13+ shim required by pydub |
| `pypdf`, `httpx` | PDF + HTTP client |

Potrace và **FFmpeg** là binary ngoài (không trong pip).

---

## 10. Infra cần chạy (dev)

| Thành phần | RAG chat | Ingestion | Personalization |
|------------|----------|-----------|-----------------|
| Qdrant | ✓ | ✓ | — |
| RabbitMQ | — | ✓ | — |
| MinIO | — | ✓ | — |
| LLM (LM Studio) | ✓ | ✓ (embed) | — |
| potrace | — | — | ✓ (SVG) |
| FFmpeg | — | — | ✓ (soundwave decode) |

Personalization chạy độc lập, không cần Qdrant/RabbitMQ.

---

## 11. Tích hợp NestJS (roadmap)

```text
FE → api-gateway → rag-service        → rag_engine :8000
                 → knowledge-service  → RabbitMQ → ingestion_worker
                 → biometric-service  → personalization_engine :8010
```

Env gợi ý cho NestJS:

```env
PERSONALIZATION_ENGINE_URL=http://localhost:8010
RAG_ENGINE_URL=http://localhost:8000
```

Hiện prototype có thể gọi Python trực tiếp để test, chưa bắt buộc qua gateway.

---

## 12. Troubleshooting

| Vấn đề | Cách xử lý |
|--------|------------|
| `[py] Không tìm thấy venv` | `cd python-services && python -m venv .venv && pip install -r requirements.txt` |
| RAG 502 / LLM timeout | Kiểm tra LM Studio / `OPENAI_BASE_URL`, tăng `LLM_REQUEST_TIMEOUT_S` |
| Ingestion không chạy | RabbitMQ + MinIO + worker (`py:rag-worker`) |
| Không retrieve được | Qdrant collection, reindex document, `ENABLE_RETRIEVAL_FALLBACK` |
| Không có SVG vân tay | Cài potrace, xem `tools/potrace/` |
| Texture CORS | personalization đã bật CORS `*`; mở UI qua Live Server |
| Import `shared` lỗi | Chạy từ `python-services/` hoặc dùng `npm run py:*` |

---

## 13. TODO / hướng phát triển

- [ ] NestJS `biometric-service` proxy sang `personalization_engine`
- [ ] Upload artifacts personalization lên MinIO
- [ ] Redis cache thay in-memory cho RAG
- [ ] Sound wave personalization
- [ ] Export geometry khắc (STL/GLB) — chưa trong scope hiện tại

---

## Tài liệu con

- [personalization_engine/README.md](personalization_engine/README.md) — fingerprint API, preset, texture maps, Three.js
- [tools/potrace/README.md](tools/potrace/README.md) — cài potrace Windows
- [prototype/bioring-chat-ui](../prototype/bioring-chat-ui/README.md) — UI test RAG chat
- [prototype/fingerprint-personalization-ui](../prototype/fingerprint-personalization-ui/README.md) — UI test fingerprint + 3D preview
