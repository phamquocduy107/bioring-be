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


def _probe_models(base_url: str, api_key: str) -> tuple[set[str], str]:
    models_url = f"{base_url.rstrip('/')}/models"
    _, body = _http_get(
        models_url,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    payload = json.loads(body.decode("utf-8"))
    model_ids = {m.get("id") for m in payload.get("data", []) if isinstance(m, dict)}
    return model_ids, models_url


def check_llm() -> tuple[bool, str]:
    base = settings.active_llm_base_url
    key = settings.active_llm_api_key
    model = settings.active_llm_model
    if settings.llm_provider == "openrouter" and not key:
        return False, "OPENROUTER_API_KEY missing"
    try:
        model_ids, models_url = _probe_models(base, key)
        # OpenRouter catalog lớn / free route có thể không khớp id tuyệt đối — chỉ cần API sống.
        if settings.llm_provider == "openrouter":
            ok = True
            status = "reachable"
        else:
            ok = model in model_ids
            status = "ok" if ok else "missing"
        detail = (
            f"provider={settings.llm_provider} {base} "
            f"llm={model}={status}"
        )
        return ok, detail
    except Exception as exc:
        return False, f"{base}/models error={exc}"


def check_embedding() -> tuple[bool, str]:
    from shared.embeddings import build_openai_embeddings

    base = settings.active_embedding_base_url
    key = settings.active_embedding_api_key
    model = settings.active_embedding_model
    if settings.embedding_provider == "openrouter" and not key:
        return False, "OPENROUTER_API_KEY missing"
    try:
        embeddings = build_openai_embeddings(
            model=model,
            base_url=base,
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
        ("Qdrant", check_qdrant),
        ("LLM", check_llm),
        ("Embed", check_embedding),
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
