from fastapi import FastAPI

from .config import settings
from .schemas import HealthResponse

app = FastAPI(
    title="BIORING Ingestion Worker Health API",
    description="Health endpoint for the RabbitMQ-based PDF ingestion worker.",
    version="1.0.0",
)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        service="ingestion-worker",
        qdrantCollection=settings.QDRANT_COLLECTION,
    )
