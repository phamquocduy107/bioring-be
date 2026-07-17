# BIORING RAG Python Services

Bộ code này gồm 2 phần:

```txt
rag-python/
├── ingestion_worker/   # RabbitMQ worker: MinIO PDF -> chunk -> embedding -> Qdrant
└── rag_engine/         # FastAPI service: question -> Qdrant retrieval -> LLM answer
```

## 1. Cài môi trường

```bash
cd rag-python
python -m venv .venv
```

Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

Cài package:

```bash
pip install -r requirements.txt
copy .env.example .env
```

## 2. Các service cần chạy trước

- MinIO: `localhost:9000`
- Qdrant: `http://localhost:6333`
- RabbitMQ: `amqp://guest:guest@localhost:5672`
- LM Studio: `http://localhost:1234/v1`

RabbitMQ UI mặc định:

```txt
http://localhost:15672
user: guest
pass: guest
```

## 3. Chạy ingestion worker bằng RabbitMQ

```bash
python -m ingestion_worker.rabbitmq_worker
```

Worker sẽ lắng nghe queue:

```txt
rag.ingestion.jobs
```

Các routing key worker nhận:

```txt
document.ingestion.requested
document.ingestion.reindex
document.vectors.delete
```

Worker publish status về routing key:

```txt
document.ingestion.status
```

## 4. Job payload từ NestJS sang RabbitMQ

### INGEST

Routing key:

```txt
document.ingestion.requested
```

Body:

```json
{
  "jobId": "job_123",
  "jobType": "INGEST",
  "documentId": "doc_123",
  "workspaceId": "ws_001",
  "userId": "user_001",
  "bucket": "rag-documents",
  "objectName": "workspaces/ws_001/documents/doc_123/original.pdf",
  "originalName": "research.pdf",
  "documentType": "custom_design",
  "retrievalTypes": ["custom_design", "package", "policy", "ring_guide"],
  "createdAt": "2026-07-13T08:00:00.000Z"
}
```

`documentType`/`retrievalTypes` được worker gắn vào metadata + top-level payload từng chunk
để Qdrant filter theo chat intent. Job cũ thiếu 2 field này sẽ default `general`.

> Lưu ý reindex: sau khi thêm `document_type`/`retrieval_types`, các chunk cũ trong Qdrant
> chưa có metadata này nên filter theo `retrieval_types` sẽ không tìm thấy chúng.
> Cần reindex tài liệu cũ (POST `/knowledge/documents/:id/reindex`) hoặc xóa collection và
> upload lại với `documentType` đúng. Có thể bật `ENABLE_RETRIEVAL_FALLBACK=true` để tạm
> search rộng khi filter không ra kết quả (debug ghi `retrievalFallbackUsed=true`).

### REINDEX

Routing key:

```txt
document.ingestion.reindex
```

Body giống INGEST, chỉ đổi:

```json
{
  "jobType": "REINDEX"
}
```

### DELETE_VECTORS

Routing key:

```txt
document.vectors.delete
```

Body:

```json
{
  "jobId": "job_123",
  "jobType": "DELETE_VECTORS",
  "documentId": "doc_123",
  "workspaceId": "ws_001",
  "userId": "user_001",
  "createdAt": "2026-07-13T08:00:00.000Z"
}
```

## 5. Status event worker gửi về RabbitMQ

Routing key:

```txt
document.ingestion.status
```

Body ví dụ:

```json
{
  "jobId": "job_123",
  "jobType": "INGEST",
  "documentId": "doc_123",
  "workspaceId": "ws_001",
  "status": "PROCESSING",
  "progress": 55,
  "message": "Created 20 chunks. Deleting old vectors.",
  "updatedAt": "2026-07-13T08:00:00.000Z"
}
```

Khi xong:

```json
{
  "jobId": "job_123",
  "jobType": "INGEST",
  "documentId": "doc_123",
  "workspaceId": "ws_001",
  "status": "READY",
  "progress": 100,
  "message": "Document ingestion completed.",
  "chunkCount": 120,
  "updatedAt": "2026-07-13T08:00:00.000Z"
}
```

Khi lỗi:

```json
{
  "jobId": "job_123",
  "jobType": "INGEST",
  "documentId": "doc_123",
  "workspaceId": "ws_001",
  "status": "FAILED",
  "progress": 0,
  "message": "Document ingestion failed.",
  "errorMessage": "...",
  "updatedAt": "2026-07-13T08:00:00.000Z"
}
```

## 6. Chạy RAG engine

```bash
copy .env.example .env
uvicorn rag_engine.main:app --host 0.0.0.0 --port 8000 --reload
```

Test health:

```bash
curl http://localhost:8000/health
```

Intent (rules-first, mặc định không gọi LLM):

```bash
curl -X POST http://localhost:8000/intent/detect \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Tư vấn cho tôi một mẫu nhẫn\",\"chatHistory\":[],\"userPreferences\":{},\"lastIntent\":null}"
```

Query (final LLM tối đa 1 lần; bật debug bằng DEBUG_RAG=true):

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"ws_001\",\"userId\":\"user_001\",\"documentIds\":[],\"question\":\"Shop có bảo hành không?\",\"chatHistory\":[],\"intentOverride\":\"POLICY_QA\",\"retrievalTypes\":[\"policy\"]}"
```

### Tối ưu LLM call (local)

| Case | LLM calls |
|------|-----------|
| Clarification (thiếu purpose/budget/style) | 0 |
| First turn đủ info | 1 (final answer) |
| Follow-up có history (không mơ hồ / có preferences) | 1 |
| Policy/package hỏi lại (cache hit) | 0 |

Env chính: `INTENT_RULES_FIRST`, `ENABLE_LLM_INTENT_FALLBACK`, `ENABLE_QUERY_REWRITE`, `ENABLE_QUERY_REWRITE_FALLBACK`, `CACHE_POLICY_ANSWERS`, `CACHE_RETRIEVAL_RESULTS`, `DEBUG_RAG`. Chi tiết trong `.env.example`.

## 7. Flow tổng thể

```txt
Upload PDF ở NestJS
→ lưu file vào MinIO
→ tạo document DB status = UPLOADED
→ publish RabbitMQ job INGEST
→ ingestion_worker consume job
→ tải PDF từ MinIO
→ PyPDFLoader đọc PDF
→ SemanticChunker chia chunk
→ OpenAIEmbeddings gọi LM Studio
→ upsert vector vào Qdrant
→ publish status READY/FAILED về RabbitMQ
→ NestJS consume status và update DB
```

Sau khi document status = READY:

```txt
Frontend hỏi
→ api-gateway
→ apps/rag-service
→ gọi rag_engine /intent/detect (rules-first) rồi /query
→ rag_engine: build retrieval query → Qdrant + local embedding → final LLM (1 lần)
→ trả answer + sources (+ debug nếu DEBUG_RAG)
```

Chat query **không** dùng RabbitMQ. RabbitMQ chỉ cho ingestion PDF.
