import uuid
from typing import List, Optional

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http import models

from .config import settings


class QdrantStore:
    """Store and delete document chunk vectors in Qdrant."""

    def __init__(self) -> None:
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            check_compatibility=False,
        )
        self.collection_name = settings.QDRANT_COLLECTION
        self.embeddings = OpenAIEmbeddings(
            model=settings.active_embedding_model,
            base_url=settings.active_embedding_base_url,
            api_key=settings.active_embedding_api_key,
            check_embedding_ctx_length=False,
        )

    def collection_exists(self) -> bool:
        collections = self.client.get_collections().collections
        return any(collection.name == self.collection_name for collection in collections)

    def ensure_collection(self, vector_size: int) -> None:
        if self.collection_exists():
            self._create_payload_indexes()
            return

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE,
            ),
        )
        self._create_payload_indexes()

    def _create_payload_indexes(self) -> None:
        # Ưu tiên filter bằng top-level field; giữ nested metabase.* cho tương thích cũ.
        index_fields = [
            "document_id",
            "workspace_id",
            "user_id",
            "document_type",
            "retrieval_types",
            "metadata.document_id",
            "metadata.workspace_id",
            "metadata.user_id",
            "metadata.document_type",
            "metadata.retrieval_types",
        ]

        for field in index_fields:
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception:
                # Ignore if index already exists or collection is being initialized.
                pass

    def delete_document_vectors(
        self,
        document_id: str,
        workspace_id: Optional[str] = None,
    ) -> bool:
        if not self.collection_exists():
            return True

        filter_conditions: list[models.FieldCondition] = [
            models.FieldCondition(
                key="document_id",
                match=models.MatchValue(value=document_id),
            )
        ]

        if workspace_id:
            filter_conditions.append(
                models.FieldCondition(
                    key="workspace_id",
                    match=models.MatchValue(value=workspace_id),
                )
            )

        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(must=filter_conditions)
            ),
            wait=True,
        )
        return True

    def upsert_documents(self, documents: List[Document]) -> int:
        if not documents:
            return 0

        texts = [doc.page_content for doc in documents]
        vectors = self.embeddings.embed_documents(texts)

        if not vectors:
            return 0

        self.ensure_collection(vector_size=len(vectors[0]))

        points: list[models.PointStruct] = []

        for index, doc in enumerate(documents):
            metadata = doc.metadata
            document_id = metadata["document_id"]
            chunk_index = metadata["chunk_index"]

            # Stable id: reindexing the same chunk overwrites instead of creating duplicates.
            point_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"{self.collection_name}:{document_id}:{chunk_index}",
                )
            )

            payload = {
                # Compatible with LangChain/Qdrant style payload.
                "page_content": doc.page_content,
                "metadata": metadata,

                # Flattened fields make Qdrant filtering easier and faster.
                "document_id": metadata["document_id"],
                "workspace_id": metadata["workspace_id"],
                "user_id": metadata["user_id"],
                "source": metadata["source"],
                "page": metadata["page"],
                "chunk_index": metadata["chunk_index"],
                # Flatten type để filter theo chat intent (MatchAny trên retrieval_types).
                "document_type": metadata.get("document_type", "general"),
                "retrieval_types": metadata.get("retrieval_types", []),
            }

            points.append(
                models.PointStruct(id=point_id, vector=vectors[index], payload=payload)
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )

        return len(points)
