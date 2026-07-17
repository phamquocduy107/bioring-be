from typing import List, Optional

from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http import models

from .config import settings
from .schemas import RetrievedChunk, Source


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
        top_k: int = 5,
        score_threshold: float = 0.45,
    ) -> List[RetrievedChunk]:
        query_vector = self.embeddings.embed_query(query)
        query_filter = self._build_filter(
            workspace_id=workspace_id,
            document_ids=document_ids or [],
            document_types=document_types or [],
        )

        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=top_k,
            score_threshold=score_threshold,
            with_payload=True,
        )

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
                    metadata=metadata,
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
    def build_context(chunks: List[RetrievedChunk], max_chars: int) -> str:
        parts: List[str] = []
        total = 0
        for idx, chunk in enumerate(chunks, start=1):
            source = chunk.source
            header = (
                f"[Nguồn {idx}] file={source.source}, "
                f"documentId={source.documentId}, page={source.page}, "
                f"chunkIndex={source.chunkIndex}, score={source.score}"
            )
            block = f"{header}\n{chunk.content.strip()}"
            if total + len(block) > max_chars:
                break
            parts.append(block)
            total += len(block)
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _preview(text: str, limit: int = 260) -> str:
        cleaned = " ".join((text or "").split())
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 3] + "..."
