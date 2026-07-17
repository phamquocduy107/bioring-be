from typing import Literal, Optional
from pydantic import BaseModel, Field


class RabbitMQIngestionJob(BaseModel):
    jobId: str = Field(..., examples=["job_123"])
    jobType: Literal["INGEST", "REINDEX", "DELETE_VECTORS"]

    documentId: str = Field(..., examples=["doc_123"])
    workspaceId: str = Field(..., examples=["ws_001"])
    userId: Optional[str] = Field(None, examples=["user_001"])

    bucket: Optional[str] = Field(None, examples=["rag-documents"])
    objectName: Optional[str] = Field(
        None, examples=["workspaces/ws_001/documents/doc_123/original.pdf"]
    )
    originalName: Optional[str] = Field(None, examples=["research.pdf"])

    createdAt: Optional[str] = None


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
