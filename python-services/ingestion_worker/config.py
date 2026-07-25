import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"true", "1", "yes", "y"}


@dataclass(frozen=True)
class Settings:
    # RabbitMQ
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
    RABBITMQ_INGESTION_EXCHANGE: str = os.getenv(
        "RABBITMQ_INGESTION_EXCHANGE", "rag.ingestion.exchange"
    )
    RABBITMQ_INGESTION_QUEUE: str = os.getenv(
        "RABBITMQ_INGESTION_QUEUE", "rag.ingestion.jobs"
    )
    RABBITMQ_INGESTION_DLX: str = os.getenv(
        "RABBITMQ_INGESTION_DLX", "rag.ingestion.dlx"
    )
    RABBITMQ_INGESTION_DLQ: str = os.getenv(
        "RABBITMQ_INGESTION_DLQ", "rag.ingestion.dlq"
    )
    RABBITMQ_STATUS_QUEUE: str = os.getenv(
        "RABBITMQ_STATUS_QUEUE", "rag.ingestion.status"
    )

    # MinIO — đồng bộ bucket với NestJS rag-service (MINIO_BUCKET)
    # Endpoint Python: host:port | Nest: MINIO_ENDPOINT + MINIO_PORT
    # SSL: MINIO_SECURE (Python) ≈ MINIO_USE_SSL (Nest)
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "knowledge-documents")
    MINIO_SECURE: bool = (
        get_bool_env("MINIO_SECURE", False)
        if os.getenv("MINIO_SECURE") is not None
        else get_bool_env("MINIO_USE_SSL", False)
    )

    # Qdrant
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_API_KEY: str | None = os.getenv("QDRANT_API_KEY") or None
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "rag_chunks")

    # Provider: local (LM Studio) | openrouter
    EMBEDDING_PROVIDER: str = (
        os.getenv("EMBEDDING_PROVIDER", "local") or "local"
    ).strip().lower()

    # LM Studio / OpenAI-compatible embedding API (local)
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "lm-studio")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-bge-m3")

    # OpenRouter embedding (chỉ dùng khi EMBEDDING_PROVIDER=openrouter)
    OPENROUTER_BASE_URL: str = os.getenv(
        "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
    )
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_EMBEDDING_MODEL: str = os.getenv(
        "OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"
    )

    # Local temp
    TEMP_DIR: str = os.getenv("TEMP_DIR", "/tmp/knowledge-documents")

    def _normalize_provider(self, value: str) -> str:
        normalized = (value or "local").strip().lower()
        if normalized in {"openrouter", "or"}:
            return "openrouter"
        return "local"

    @property
    def embedding_provider(self) -> str:
        return self._normalize_provider(self.EMBEDDING_PROVIDER)

    @property
    def active_embedding_base_url(self) -> str:
        if self.embedding_provider == "openrouter":
            return self.OPENROUTER_BASE_URL
        return self.OPENAI_BASE_URL

    @property
    def active_embedding_api_key(self) -> str:
        if self.embedding_provider == "openrouter":
            return self.OPENROUTER_API_KEY
        return self.OPENAI_API_KEY

    @property
    def active_embedding_model(self) -> str:
        if self.embedding_provider == "openrouter":
            return self.OPENROUTER_EMBEDDING_MODEL
        return self.EMBEDDING_MODEL


settings = Settings()
