# Deploy Python services (Arcane)

## Docker Hub

```text
kietmn/bioring-python:latest
```

## Gan len Arcane

1. Projects -> Create Project -> ten `bioring-python`
2. Cot Compose: paste toan bo `docker-compose.yml`
3. Cot Environment (.env): paste `.env.example`, sua IP/key that
4. Create / Redeploy

Compose dung `env_file: .env` (dung theo docs Arcane) — moi bien trong .env se vao container.

## Ports

| Service | Port |
|---------|------|
| rag-engine | 8000 |
| personalization-engine | 8010 |
| ingestion-worker | (khong mo port) |

Bat buoc trong `.env`: `RABBITMQ_URL`, `MINIO_ENDPOINT`, `QDRANT_URL`, `OPENROUTER_API_KEY`.
