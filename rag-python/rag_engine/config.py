import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ["true", "1", "yes", "y"]


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


def get_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return float(value)


@dataclass
class Settings:
    # Qdrant
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_API_KEY: str | None = os.getenv("QDRANT_API_KEY") or None
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "rag_chunks")

    # If your ingestion payload contains document_type, set this to true.
    # Default false because the initial ingestion worker only stores document_id/workspace_id/source/page/chunk_index.
    ENABLE_DOCUMENT_TYPE_FILTER: bool = get_bool_env("ENABLE_DOCUMENT_TYPE_FILTER", False)

    # LM Studio / OpenAI-compatible API
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "lm-studio")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-bge-m3")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen2.5-7b-instruct")
    LLM_TEMPERATURE: float = get_float_env("LLM_TEMPERATURE", 0.0)
    # Abort hung LM Studio calls so intent can fall back to rules.
    LLM_REQUEST_TIMEOUT_S: float = get_float_env("LLM_REQUEST_TIMEOUT_S", 45.0)
    # Prefer rules-only intent when LM Studio is cold/slow (local demo).
    INTENT_RULES_FIRST: bool = get_bool_env("INTENT_RULES_FIRST", False)

    # Retrieval defaults
    DEFAULT_TOP_K: int = get_int_env("DEFAULT_TOP_K", 5)
    DEFAULT_SCORE_THRESHOLD: float = get_float_env("DEFAULT_SCORE_THRESHOLD", 0.45)

    # Safety limits
    MAX_CHAT_HISTORY_MESSAGES: int = get_int_env("MAX_CHAT_HISTORY_MESSAGES", 10)
    MAX_PRODUCT_CANDIDATES: int = get_int_env("MAX_PRODUCT_CANDIDATES", 8)
    MAX_PACKAGE_CANDIDATES: int = get_int_env("MAX_PACKAGE_CANDIDATES", 5)
    MAX_CONTEXT_CHARS: int = get_int_env("MAX_CONTEXT_CHARS", 12000)


settings = Settings()
