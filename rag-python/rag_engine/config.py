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
    ENABLE_DOCUMENT_TYPE_FILTER: bool = get_bool_env("ENABLE_DOCUMENT_TYPE_FILTER", False)

    # LM Studio / OpenAI-compatible API
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "lm-studio")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-bge-m3")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen2.5-7b-instruct")
    LLM_TEMPERATURE: float = get_float_env("LLM_TEMPERATURE", 0.0)
    LLM_REQUEST_TIMEOUT_S: float = get_float_env("LLM_REQUEST_TIMEOUT_S", 45.0)

    # Intent: rules-first by default (no LLM for intent)
    INTENT_RULES_FIRST: bool = get_bool_env("INTENT_RULES_FIRST", True)
    ENABLE_LLM_INTENT_FALLBACK: bool = get_bool_env("ENABLE_LLM_INTENT_FALLBACK", False)

    # Query rewrite: off by default; rare ambiguous follow-up fallback
    ENABLE_QUERY_REWRITE: bool = get_bool_env("ENABLE_QUERY_REWRITE", False)
    ENABLE_QUERY_REWRITE_FALLBACK: bool = get_bool_env("ENABLE_QUERY_REWRITE_FALLBACK", True)

    # History / context limits
    MAX_RECENT_MESSAGES: int = get_int_env("MAX_RECENT_MESSAGES", 8)
    MAX_AMBIGUOUS_RECENT_MESSAGES: int = get_int_env("MAX_AMBIGUOUS_RECENT_MESSAGES", 12)
    MAX_HISTORY_TOKENS: int = get_int_env("MAX_HISTORY_TOKENS", 1200)
    MAX_CHAT_HISTORY_MESSAGES: int = get_int_env("MAX_CHAT_HISTORY_MESSAGES", 10)

    MAX_CONTEXT_CHARS: int = get_int_env("MAX_CONTEXT_CHARS", 6000)
    MAX_CONTEXT_CHARS_POLICY: int = get_int_env("MAX_CONTEXT_CHARS_POLICY", 3500)
    MAX_CONTEXT_CHARS_PACKAGE: int = get_int_env("MAX_CONTEXT_CHARS_PACKAGE", 4000)
    MAX_CONTEXT_CHARS_RING: int = get_int_env("MAX_CONTEXT_CHARS_RING", 5000)
    MAX_CONTEXT_CHARS_CUSTOM_DESIGN: int = get_int_env("MAX_CONTEXT_CHARS_CUSTOM_DESIGN", 6000)

    MAX_PRODUCT_CANDIDATES: int = get_int_env("MAX_PRODUCT_CANDIDATES", 5)
    MAX_PACKAGE_CANDIDATES: int = get_int_env("MAX_PACKAGE_CANDIDATES", 3)
    MAX_SOURCES: int = get_int_env("MAX_SOURCES", 4)

    # Retrieval defaults (per-intent overrides applied in pipeline)
    DEFAULT_TOP_K: int = get_int_env("DEFAULT_TOP_K", 4)
    POLICY_TOP_K: int = get_int_env("POLICY_TOP_K", 3)
    PACKAGE_TOP_K: int = get_int_env("PACKAGE_TOP_K", 3)
    RING_TOP_K: int = get_int_env("RING_TOP_K", 4)
    CUSTOM_DESIGN_TOP_K: int = get_int_env("CUSTOM_DESIGN_TOP_K", 5)

    DEFAULT_SCORE_THRESHOLD: float = get_float_env("DEFAULT_SCORE_THRESHOLD", 0.50)
    POLICY_SCORE_THRESHOLD: float = get_float_env("POLICY_SCORE_THRESHOLD", 0.55)
    RING_SCORE_THRESHOLD: float = get_float_env("RING_SCORE_THRESHOLD", 0.45)
    PACKAGE_SCORE_THRESHOLD: float = get_float_env("PACKAGE_SCORE_THRESHOLD", 0.50)
    CUSTOM_DESIGN_SCORE_THRESHOLD: float = get_float_env(
        "CUSTOM_DESIGN_SCORE_THRESHOLD", 0.45
    )

    # Cache
    CACHE_POLICY_ANSWERS: bool = get_bool_env("CACHE_POLICY_ANSWERS", True)
    CACHE_RETRIEVAL_RESULTS: bool = get_bool_env("CACHE_RETRIEVAL_RESULTS", True)
    CACHE_TTL_SECONDS: int = get_int_env("CACHE_TTL_SECONDS", 3600)
    CACHE_ANSWER_TTL_SECONDS: int = get_int_env("CACHE_ANSWER_TTL_SECONDS", 1800)

    # Debug payload in /query response
    DEBUG_RAG: bool = get_bool_env("DEBUG_RAG", False)
    APP_ENV: str = os.getenv("APP_ENV", os.getenv("NODE_ENV", "development"))

    @property
    def debug_enabled(self) -> bool:
        return self.DEBUG_RAG or self.APP_ENV.strip().lower() in {
            "development",
            "dev",
            "local",
        }


settings = Settings()
