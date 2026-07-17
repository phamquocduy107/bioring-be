from typing import List

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

from .config import settings


class PdfProcessor:
    """Load PDF pages and split them into semantic chunks."""

    def __init__(self) -> None:
        self.embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            base_url=settings.OPENAI_BASE_URL,
            api_key=settings.OPENAI_API_KEY,
            check_embedding_ctx_length=False,
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
    ) -> List[Document]:
        loader = PyPDFLoader(file_path)
        pages = loader.load()

        chunks = self.text_splitter.split_documents(pages)
        normalized_chunks: List[Document] = []

        for index, chunk in enumerate(chunks):
            page = chunk.metadata.get("page")

            metadata = {
                "document_id": document_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "source": original_name,
                "page": page,
                "chunk_index": index,
            }

            normalized_chunks.append(
                Document(page_content=chunk.page_content, metadata=metadata)
            )

        return normalized_chunks
