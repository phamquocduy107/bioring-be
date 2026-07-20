import os

from shared.minio_client import MinioObjectStore, MinioSettings

from .config import settings


class MinioStorage:
    """Download PDF files from MinIO to a temporary local path."""

    def __init__(self) -> None:
        self._store = MinioObjectStore(
            MinioSettings(
                endpoint=settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
        )

    @property
    def client(self):
        return self._store.client

    def download_document(self, bucket: str, object_name: str, document_id: str) -> str:
        os.makedirs(settings.TEMP_DIR, exist_ok=True)
        local_path = os.path.join(settings.TEMP_DIR, f"{document_id}.pdf")
        self._store.download_file(bucket, object_name, local_path)
        return local_path
