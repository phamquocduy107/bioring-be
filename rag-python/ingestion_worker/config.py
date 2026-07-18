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

    # MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "rag-documents")
    MINIO_SECURE: bool = get_bool_env("MINIO_SECURE", False)

    # Qdrant
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_API_KEY: str | None = os.getenv("QDRANT_API_KEY") or None
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "rag_chunks")

    # LM Studio / OpenAI-compatible embedding API
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "lm-studio")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-bge-m3")

    # Local temp
    TEMP_DIR: str = os.getenv("TEMP_DIR", "/tmp/rag-documents")


settings = Settings()
