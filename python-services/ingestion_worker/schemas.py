from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from .document_types import normalize_document_type, normalize_retrieval_types


class RabbitMQIngestionJob(BaseModel):
    jobId: str = Field(..., examples=["job_123"])
    jobType: Literal["INGEST", "REINDEX", "DELETE_VECTORS"]

    documentId: str = Field(..., examples=["doc_123"])
    workspaceId: str = Field(..., examples=["ws_001"])
    userId: Optional[str] = Field(None, examples=["user_001"])

    bucket: Optional[str] = Field(None, examples=["knowledge-documents"])
    objectName: Optional[str] = Field(
        None, examples=["workspaces/ws_001/documents/doc_123/original.pdf"]
    )
    originalName: Optional[str] = Field(None, examples=["research.pdf"])

    # Metadata filter Qdrant. Job cũ thiếu field -> default general / auto-map.
    documentType: Optional[str] = Field(default="general", examples=["policy"])
    retrievalTypes: Optional[List[str]] = Field(default=None, examples=[["policy"]])

    createdAt: Optional[str] = None

    def normalized_document_type(self) -> str:
        return normalize_document_type(self.documentType)

    def normalized_retrieval_types(self) -> List[str]:
        return normalize_retrieval_types(
            self.retrievalTypes, self.normalized_document_type()
        )


class IngestionStatusEvent(BaseModel):
    jobId: Optional[str] = None
    jobType: Optional[str] = None

    documentId: str
    workspaceId: Optional[str] = None

    status: Literal["UPLOADED", "PROCESSING", "READY", "FAILED"]
    progress: Optional[int] = None
    message: Optional[str] = None
    errorMessage: Optional[str] = None
    chunkCount: Optional[int] = None

    updatedAt: str


class HealthResponse(BaseModel):
    status: str
    service: str
    qdrantCollection: str
