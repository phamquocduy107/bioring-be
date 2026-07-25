"""OpenAI-compatible embeddings helpers (local LM Studio / OpenRouter)."""

from __future__ import annotations

from typing import Any

from langchain_openai import OpenAIEmbeddings


def build_openai_embeddings(
    *,
    model: str,
    base_url: str,
    api_key: str,
    encoding_format: str = "float",
) -> OpenAIEmbeddings:
    """
    Build LangChain embeddings client.

    OpenRouter NVIDIA embed models reject the OpenAI SDK default
    `encoding_format=base64` and return HTTP 400 with empty `data`,
    which surfaces as ValueError: No embedding data received.
    Always request float vectors unless caller overrides.
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "base_url": base_url,
        "api_key": api_key,
        "check_embedding_ctx_length": False,
        "model_kwargs": {"encoding_format": encoding_format},
    }
    return OpenAIEmbeddings(**kwargs)
