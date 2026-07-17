from .config import settings
from .minio_storage import MinioStorage
from .pdf_processor import PdfProcessor
from .qdrant_store import QdrantStore
from .rabbitmq_status import RabbitMQStatusPublisher
from .schemas import RabbitMQIngestionJob

minio_storage = MinioStorage()
pdf_processor = PdfProcessor()
qdrant_store = QdrantStore()


def process_rabbitmq_job(
    job: RabbitMQIngestionJob,
    status_publisher: RabbitMQStatusPublisher,
) -> None:
    if job.jobType == "DELETE_VECTORS":
        process_delete_vectors_job(job, status_publisher)
        return

    process_ingest_or_reindex_job(job, status_publisher)


def process_delete_vectors_job(
    job: RabbitMQIngestionJob,
    status_publisher: RabbitMQStatusPublisher,
) -> None:
    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=10,
        message="Deleting document vectors from Qdrant.",
    )

    qdrant_store.delete_document_vectors(
        document_id=job.documentId,
        workspace_id=job.workspaceId,
    )

    status_publisher.publish_status(
        job=job,
        status="READY",
        progress=100,
        message="Document vectors deleted.",
    )


def process_ingest_or_reindex_job(
    job: RabbitMQIngestionJob,
    status_publisher: RabbitMQStatusPublisher,
) -> None:
    if not job.objectName:
        raise ValueError("objectName is required for INGEST/REINDEX job.")
    if not job.originalName:
        raise ValueError("originalName is required for INGEST/REINDEX job.")
    if not job.userId:
        raise ValueError("userId is required for INGEST/REINDEX job.")

    bucket = job.bucket or settings.MINIO_BUCKET

    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=5,
        message=f"{job.jobType}: started.",
    )

    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=15,
        message="Downloading PDF from MinIO.",
    )

    local_pdf_path = minio_storage.download_document(
        bucket=bucket,
        object_name=job.objectName,
        document_id=job.documentId,
    )

    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=30,
        message="Parsing and chunking PDF.",
    )

    chunks = pdf_processor.load_and_chunk_pdf(
        file_path=local_pdf_path,
        document_id=job.documentId,
        workspace_id=job.workspaceId,
        user_id=job.userId,
        original_name=job.originalName,
    )

    if not chunks:
        raise ValueError("No text chunks were created from the PDF.")

    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=55,
        message=f"Created {len(chunks)} chunks. Deleting old vectors.",
    )

    qdrant_store.delete_document_vectors(
        document_id=job.documentId,
        workspace_id=job.workspaceId,
    )

    status_publisher.publish_status(
        job=job,
        status="PROCESSING",
        progress=75,
        message="Embedding and upserting chunks to Qdrant.",
    )

    chunk_count = qdrant_store.upsert_documents(chunks)

    status_publisher.publish_status(
        job=job,
        status="READY",
        progress=100,
        message="Document ingestion completed.",
        chunk_count=chunk_count,
    )
