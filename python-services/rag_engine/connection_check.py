"""Startup connection probes for the rag-engine (compact Nest-style logs)."""

from __future__ import annotations

import json
import logging
import urllib.request
from typing import Callable

from .config import settings

logger = logging.getLogger("connections")

PROBE_TIMEOUT_S = 5


def _http_get(url: str, headers: dict[str, str] | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT_S) as resp:
        return resp.status, resp.read()


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
        points = None
        if has:
            try:
                _, info_body = _http_get(
                    f"{base}/collections/{settings.QDRANT_COLLECTION}",
                    headers=headers,
                )
                info = json.loads(info_body.decode("utf-8"))
                points = (info.get("result") or {}).get("points_count")
            except Exception:
                points = None
        detail = f"{settings.QDRANT_URL} collection={settings.QDRANT_COLLECTION}"
        if points is not None:
            detail += f" points={points}"
        elif not has:
            detail += " (missing - ingest first)"
        return True, detail
    except Exception as exc:
        return False, f"{settings.QDRANT_URL} error={exc}"


def check_openai_compatible() -> tuple[bool, str]:
    base = settings.OPENAI_BASE_URL.rstrip("/")
    models_url = f"{base}/models"
    try:
        _, body = _http_get(
            models_url,
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        )
        payload = json.loads(body.decode("utf-8"))
        model_ids = {m.get("id") for m in payload.get("data", []) if isinstance(m, dict)}
        has_llm = settings.LLM_MODEL in model_ids
        has_embed = settings.EMBEDDING_MODEL in model_ids
        detail = (
            f"{settings.OPENAI_BASE_URL} "
            f"llm={settings.LLM_MODEL}={'ok' if has_llm else 'missing'} "
            f"embed={settings.EMBEDDING_MODEL}={'ok' if has_embed else 'missing'}"
        )
        return has_llm and has_embed, detail
    except Exception as exc:
        return False, f"{models_url} error={exc}"


def run_startup_checks() -> dict[str, bool]:
    checks: list[tuple[str, Callable[[], tuple[bool, str]]]] = [
        ("Qdrant", check_qdrant),
        ("LLM/Embed", check_openai_compatible),
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
