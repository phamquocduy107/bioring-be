"""Startup connection probes for the ingestion worker (compact Nest-style logs)."""

from __future__ import annotations

import json
import logging
import urllib.request
from typing import Callable
from urllib.parse import urlparse

from .config import settings

logger = logging.getLogger("connections")

PROBE_TIMEOUT_S = 5


def _http_get(url: str, headers: dict[str, str] | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT_S) as resp:
        return resp.status, resp.read()


def _mask_amqp(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or "?"
    port = parsed.port or 5672
    user = parsed.username or "guest"
    return f"{parsed.scheme}://{user}:***@{host}:{port}"


def check_rabbitmq_config() -> tuple[bool, str]:
    try:
        return True, _mask_amqp(settings.RABBITMQ_URL)
    except Exception as exc:
        return False, str(exc)


def check_minio() -> tuple[bool, str]:
    from shared.minio_client import MinioObjectStore, MinioSettings, normalize_minio_endpoint

    endpoint, secure_from_url = normalize_minio_endpoint(settings.MINIO_ENDPOINT)
    secure = settings.MINIO_SECURE if secure_from_url is None else secure_from_url
    scheme = "https" if secure else "http"
    health_url = f"{scheme}://{endpoint}/minio/health/live"
    try:
        status, _ = _http_get(health_url)
        if status != 200:
            return False, f"{endpoint} health status={status}"

        store = MinioObjectStore(
            MinioSettings(
                endpoint=endpoint,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=secure,
            )
        )
        exists = store.bucket_exists(settings.MINIO_BUCKET)
        detail = (
            f"{scheme}://{endpoint} "
            f"bucket={settings.MINIO_BUCKET} exists={exists}"
        )
        return exists, detail
    except Exception as exc:
        return False, f"{endpoint} error={exc}"


def check_qdrant() -> tuple[bool, str]:
    base = settings.QDRANT_URL.rstrip("/")
    url = f"{base}/collections"
    headers: dict[str, str] = {}
    if settings.QDRANT_API_KEY:
        headers["api-key"] = settings.QDRANT_API_KEY
    try:
        status, body = _http_get(url, headers=headers)
        if status != 200:
            return False, f"{settings.QDRANT_URL} status={status}"
        payload = json.loads(body.decode("utf-8"))
        collections = [
            c.get("name")
            for c in (payload.get("result", {}) or {}).get("collections", [])
            if isinstance(c, dict)
        ]
        has = settings.QDRANT_COLLECTION in collections
        detail = (
            f"{settings.QDRANT_URL} collection={settings.QDRANT_COLLECTION} "
            f"exists={has}"
        )
        return True, detail
    except Exception as exc:
        return False, f"{settings.QDRANT_URL} error={exc}"


def check_embedding_api() -> tuple[bool, str]:
    from shared.embeddings import build_openai_embeddings

    base = settings.active_embedding_base_url.rstrip("/")
    key = settings.active_embedding_api_key
    model = settings.active_embedding_model
    if settings.embedding_provider == "openrouter" and not key:
        return False, "OPENROUTER_API_KEY missing"
    try:
        embeddings = build_openai_embeddings(
            model=model,
            base_url=settings.active_embedding_base_url,
            api_key=key,
        )
        vector = embeddings.embed_query("bioring embedding probe")
        ok = bool(vector) and len(vector) > 0
        detail = (
            f"provider={settings.embedding_provider} {base} "
            f"embed={model} dim={len(vector) if vector else 0}"
        )
        return ok, detail
    except Exception as exc:
        return False, f"{base}/embeddings error={exc}"


def run_startup_checks() -> dict[str, bool]:
    checks: list[tuple[str, Callable[[], tuple[bool, str]]]] = [
        ("RabbitMQ", check_rabbitmq_config),
        ("MinIO", check_minio),
        ("Qdrant", check_qdrant),
        ("Embedding", check_embedding_api),
    ]
    results: dict[str, bool] = {}
    for name, fn in checks:
        ok, detail = fn()
        results[name] = ok
        if ok:
            logger.info("%s OK - %s", name, detail)
        else:
            logger.error("%s FAIL - %s", name, detail)
    return results
