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
    scheme = "https" if settings.MINIO_SECURE else "http"
    health_url = f"{scheme}://{settings.MINIO_ENDPOINT}/minio/health/live"
    try:
        status, _ = _http_get(health_url)
        if status != 200:
            return False, f"{settings.MINIO_ENDPOINT} health status={status}"

        from shared.minio_client import MinioObjectStore, MinioSettings

        store = MinioObjectStore(
            MinioSettings(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
        )
        exists = store.bucket_exists(settings.MINIO_BUCKET)
        detail = (
            f"{scheme}://{settings.MINIO_ENDPOINT} "
            f"bucket={settings.MINIO_BUCKET} exists={exists}"
        )
        return exists, detail
    except Exception as exc:
        return False, f"{settings.MINIO_ENDPOINT} error={exc}"


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
    base = settings.active_embedding_base_url.rstrip("/")
    models_url = f"{base}/models"
    key = settings.active_embedding_api_key
    model = settings.active_embedding_model
    if settings.embedding_provider == "openrouter" and not key:
        return False, "OPENROUTER_API_KEY missing"
    try:
        _, body = _http_get(
            models_url,
            headers={"Authorization": f"Bearer {key}"},
        )
        payload = json.loads(body.decode("utf-8"))
        model_ids = {m.get("id") for m in payload.get("data", []) if isinstance(m, dict)}
        if settings.embedding_provider == "openrouter":
            ok = True
            status = "reachable"
        else:
            ok = model in model_ids
            status = "ok" if ok else "missing"
        detail = (
            f"provider={settings.embedding_provider} {settings.active_embedding_base_url} "
            f"embed={model}={status}"
        )
        return ok, detail
    except Exception as exc:
        return False, f"{models_url} error={exc}"


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
