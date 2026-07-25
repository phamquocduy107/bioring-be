from typing import List, Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker

from shared.embeddings import build_openai_embeddings

from .config import settings


class PdfProcessor:
    """Load PDF pages and split them into semantic chunks."""

    def __init__(self) -> None:
        self.embeddings = build_openai_embeddings(
            model=settings.active_embedding_model,
            base_url=settings.active_embedding_base_url,
            api_key=settings.active_embedding_api_key,
        )

        self.text_splitter = SemanticChunker(
            embeddings=self.embeddings,
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=85,
        )

    def load_and_chunk_pdf(
        self,
        file_path: str,
        document_id: str,
        workspace_id: str,
        user_id: str,
        original_name: str,
        document_type: str = "general",
        retrieval_types: Optional[List[str]] = None,
    ) -> List[Document]:
        loader = PyPDFLoader(file_path)
        pages = loader.load()

        chunks = self.text_splitter.split_documents(pages)
        normalized_chunks: List[Document] = []
        retrieval_types = retrieval_types or []

        for index, chunk in enumerate(chunks):
            page = chunk.metadata.get("page")

            metadata = {
                "document_id": document_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "source": original_name,
                "page": page,
                "chunk_index": index,
                # Metadata dùng để Qdrant filter theo chat intent.
                "document_type": document_type,
                "retrieval_types": retrieval_types,
            }

            normalized_chunks.append(
                Document(page_content=chunk.page_content, metadata=metadata)
            )

        return normalized_chunks
