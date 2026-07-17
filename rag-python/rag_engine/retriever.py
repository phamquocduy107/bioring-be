import hashlib
import re
from typing import List, Optional, Tuple

from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http import models

from .config import settings
from .schemas import RagIntent, RetrievedChunk, Source


class Retriever:
    def __init__(self) -> None:
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            check_compatibility=False,
        )
        self.collection_name = settings.QDRANT_COLLECTION
        self.embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            base_url=settings.OPENAI_BASE_URL,
            api_key=settings.OPENAI_API_KEY,
            check_embedding_ctx_length=False,
        )

    def search(
        self,
        query: str,
        workspace_id: str,
        document_ids: Optional[List[str]] = None,
        document_types: Optional[List[str]] = None,
        top_k: int = 4,
        score_threshold: float = 0.50,
    ) -> List[RetrievedChunk]:
        query_vector = self.embeddings.embed_query(query)
        query_filter = self._build_filter(
            workspace_id=workspace_id,
            document_ids=document_ids or [],
            document_types=document_types or [],
        )

        # qdrant-client >=1.12: search() removed; use query_points()
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k,
            score_threshold=score_threshold,
            with_payload=True,
        )
        results = response.points

        chunks: List[RetrievedChunk] = []
        for point in results:
            payload = point.payload or {}
            metadata = payload.get("metadata") or {}
            content = payload.get("page_content") or payload.get("content") or ""

            source = Source(
                documentId=payload.get("document_id") or metadata.get("document_id"),
                source=payload.get("source") or metadata.get("source"),
                page=payload.get("page") if payload.get("page") is not None else metadata.get("page"),
                chunkIndex=(
                    payload.get("chunk_index")
                    if payload.get("chunk_index") is not None
                    else metadata.get("chunk_index")
                ),
                score=float(point.score) if point.score is not None else None,
                contentPreview=self._preview(content),
            )
            chunks.append(
                RetrievedChunk(
                    content=content,
                    source=source,
                    metadata={
                        "source": source.source,
                        "page": source.page,
                        "chunkIndex": source.chunkIndex,
                    },
                )
            )
        return chunks

    def _build_filter(
        self,
        workspace_id: str,
        document_ids: List[str],
        document_types: List[str],
    ) -> models.Filter:
        must_conditions: list[models.Condition] = [
            models.FieldCondition(
                key="workspace_id",
                match=models.MatchValue(value=workspace_id),
            )
        ]

        if document_ids:
            must_conditions.append(
                models.FieldCondition(
                    key="document_id",
                    match=models.MatchAny(any=document_ids),
                )
            )

        if settings.ENABLE_DOCUMENT_TYPE_FILTER and document_types:
            must_conditions.append(
                models.FieldCondition(
                    key="document_type",
                    match=models.MatchAny(any=document_types),
                )
            )

        return models.Filter(must=must_conditions)

    @staticmethod
    def retrieval_limits_for_intent(intent: RagIntent) -> Tuple[int, float, int]:
        """Return (top_k, score_threshold, max_context_chars)."""
        if intent == RagIntent.POLICY_QA:
            return (
                settings.POLICY_TOP_K,
                settings.POLICY_SCORE_THRESHOLD,
                settings.MAX_CONTEXT_CHARS_POLICY,
            )
        if intent == RagIntent.PACKAGE_QA:
            return (
                settings.PACKAGE_TOP_K,
                settings.PACKAGE_SCORE_THRESHOLD,
                settings.MAX_CONTEXT_CHARS_PACKAGE,
            )
        if intent == RagIntent.RING_RECOMMENDATION:
            return (
                settings.RING_TOP_K,
                settings.RING_SCORE_THRESHOLD,
                settings.MAX_CONTEXT_CHARS_RING,
            )
        if intent == RagIntent.GEMSTONE_ADVICE:
            return (
                settings.RING_TOP_K,
                settings.RING_SCORE_THRESHOLD,
                settings.MAX_CONTEXT_CHARS_RING,
            )
        if intent == RagIntent.CUSTOM_DESIGN_CONSULTING:
            return (
                settings.CUSTOM_DESIGN_TOP_K,
                settings.CUSTOM_DESIGN_SCORE_THRESHOLD,
                settings.MAX_CONTEXT_CHARS_CUSTOM_DESIGN,
            )
        return (
            settings.DEFAULT_TOP_K,
            settings.DEFAULT_SCORE_THRESHOLD,
            settings.MAX_CONTEXT_CHARS,
        )

    @staticmethod
    def limit_text_by_chars(text: str, max_chars: int) -> str:
        cleaned = (text or "").strip()
        if max_chars <= 0 or len(cleaned) <= max_chars:
            return cleaned
        return cleaned[: max_chars - 1].rstrip() + "…"

    @staticmethod
    def filter_low_score_chunks(
        chunks: List[RetrievedChunk], score_threshold: float
    ) -> List[RetrievedChunk]:
        filtered: List[RetrievedChunk] = []
        for chunk in chunks:
            score = chunk.source.score
            if score is None or score >= score_threshold:
                filtered.append(chunk)
        return filtered

    @staticmethod
    def deduplicate_chunks(chunks: List[RetrievedChunk]) -> List[RetrievedChunk]:
        best_by_key: dict[str, RetrievedChunk] = {}
        order: List[str] = []

        for chunk in chunks:
            normalized = re.sub(r"\s+", " ", (chunk.content or "").strip().lower())
            if not normalized:
                continue
            # Prefer identical/near-identical content by prefix hash.
            prefix = normalized[:240]
            key = hashlib.md5(prefix.encode("utf-8")).hexdigest()
            existing = best_by_key.get(key)
            if existing is None:
                best_by_key[key] = chunk
                order.append(key)
                continue
            old_score = existing.source.score or 0.0
            new_score = chunk.source.score or 0.0
            if new_score > old_score:
                best_by_key[key] = chunk

        return [best_by_key[key] for key in order]

    @classmethod
    def format_retrieved_context(
        cls,
        chunks: List[RetrievedChunk],
        max_context_chars: int,
        max_sources: int,
    ) -> Tuple[str, List[RetrievedChunk]]:
        selected = chunks[:max_sources]
        parts: List[str] = []
        total = 0
        used: List[RetrievedChunk] = []

        for idx, chunk in enumerate(selected, start=1):
            source = chunk.source
            content = cls.limit_text_by_chars(chunk.content, max_context_chars)
            header = (
                f"[Nguồn {idx}] source={source.source}, "
                f"page={source.page}, chunkIndex={source.chunkIndex}"
            )
            block = f"{header}\n{content}"
            if total + len(block) > max_context_chars:
                remaining = max_context_chars - total
                if remaining < 80:
                    break
                block = cls.limit_text_by_chars(block, remaining)
                parts.append(block)
                used.append(chunk)
                break
            parts.append(block)
            used.append(chunk)
            total += len(block)

        if not parts:
            return "(không có context phù hợp)", []
        return "\n\n---\n\n".join(parts), used

    @classmethod
    def build_context(cls, chunks: List[RetrievedChunk], max_chars: int) -> str:
        text, _ = cls.format_retrieved_context(
            chunks, max_context_chars=max_chars, max_sources=settings.MAX_SOURCES
        )
        return text

    @staticmethod
    def _preview(text: str, limit: int = 260) -> str:
        cleaned = " ".join((text or "").split())
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 3] + "..."
