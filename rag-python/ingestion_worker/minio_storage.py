import os
from minio import Minio

from .config import settings


class MinioStorage:
    """Download PDF files from MinIO to a temporary local path."""

    def __init__(self) -> None:
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )

    def download_document(self, bucket: str, object_name: str, document_id: str) -> str:
        os.makedirs(settings.TEMP_DIR, exist_ok=True)
        local_path = os.path.join(settings.TEMP_DIR, f"{document_id}.pdf")

        self.client.fget_object(
            bucket_name=bucket,
            object_name=object_name,
            file_path=local_path,
        )

        return local_path
