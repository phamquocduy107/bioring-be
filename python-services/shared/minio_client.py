"""Thin MinIO client wrapper shared by Python services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Optional

logger = logging.getLogger("shared.minio")


@dataclass(frozen=True)
class MinioSettings:
    endpoint: str
    access_key: str
    secret_key: str
    secure: bool = False


def create_minio_client(cfg: MinioSettings) -> Any:
    from minio import Minio

    return Minio(
        endpoint=cfg.endpoint,
        access_key=cfg.access_key,
        secret_key=cfg.secret_key,
        secure=cfg.secure,
    )


def build_public_object_url(
    public_endpoint: str,
    bucket: str,
    object_key: str,
) -> str:
    return f"{public_endpoint.rstrip('/')}/{bucket}/{object_key}"


def public_read_bucket_policy(bucket: str) -> str:
    """Anonymous GET for all objects in the bucket (permanent public URLs)."""
    return json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
    )


class MinioObjectStore:
    """Lazy MinIO client with common upload/download/delete helpers."""

    def __init__(self, cfg: MinioSettings) -> None:
        self.cfg = cfg
        self._client: Any = None

    @property
    def client(self) -> Any:
        if self._client is None:
            self._client = create_minio_client(self.cfg)
        return self._client

    def bucket_exists(self, bucket: str) -> bool:
        return bool(self.client.bucket_exists(bucket))

    def ensure_bucket(self, bucket: str, *, public_read: bool = False) -> None:
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)
            logger.info("Created MinIO bucket %s", bucket)
        if public_read:
            self.ensure_public_read(bucket)

    def ensure_public_read(self, bucket: str) -> None:
        """Allow anonymous GetObject so permanent public URLs work in browser."""
        policy = public_read_bucket_policy(bucket)
        self.client.set_bucket_policy(bucket, policy)
        logger.info("MinIO bucket %s public-read policy applied", bucket)

    def upload_file(
        self,
        bucket: str,
        object_key: str,
        local_path: str | Path,
        *,
        content_type: Optional[str] = None,
    ) -> None:
        path = Path(local_path)
        if not path.is_file():
            raise FileNotFoundError(f"Local file not found: {path}")
        kwargs: dict[str, Any] = {}
        if content_type:
            kwargs["content_type"] = content_type
        self.client.fput_object(
            bucket_name=bucket,
            object_name=object_key,
            file_path=str(path),
            **kwargs,
        )

    def download_file(
        self,
        bucket: str,
        object_key: str,
        local_path: str | Path,
    ) -> Path:
        path = Path(local_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.client.fget_object(
            bucket_name=bucket,
            object_name=object_key,
            file_path=str(path),
        )
        return path

    def delete_object(
        self,
        bucket: str,
        object_key: str,
        *,
        ignore_missing: bool = True,
    ) -> None:
        try:
            self.client.remove_object(bucket, object_key)
        except Exception as exc:
            if ignore_missing and (
                type(exc).__name__ in {"S3Error", "NoSuchKey"}
                or "NoSuchKey" in str(exc)
            ):
                return
            raise

    def iter_objects(
        self,
        bucket: str,
        prefix: str,
        *,
        recursive: bool = True,
    ) -> Iterator[Any]:
        return self.client.list_objects(
            bucket_name=bucket,
            prefix=prefix,
            recursive=recursive,
        )

    def delete_objects_with_prefix(self, bucket: str, prefix: str) -> int:
        removed = 0
        for obj in self.iter_objects(bucket, prefix, recursive=True):
            if not obj.object_name:
                continue
            self.client.remove_object(bucket, obj.object_name)
            removed += 1
        return removed

    def delete_file(
        self,
        bucket: str,
        object_key: str,
        *,
        ignore_missing: bool = True,
    ) -> None:
        """Alias for delete_object (spec-compatible name)."""
        self.delete_object(bucket, object_key, ignore_missing=ignore_missing)

    def delete_prefix(self, bucket: str, prefix: str) -> int:
        """Alias for delete_objects_with_prefix (spec-compatible name)."""
        return self.delete_objects_with_prefix(bucket, prefix)

    def copy_file(
        self,
        bucket: str,
        source_object_key: str,
        target_object_key: str,
    ) -> None:
        from minio.commonconfig import CopySource

        self.ensure_bucket(bucket)
        self.client.copy_object(
            bucket_name=bucket,
            object_name=target_object_key,
            source=CopySource(bucket, source_object_key),
        )

    def file_exists(self, bucket: str, object_key: str) -> bool:
        try:
            self.client.stat_object(bucket, object_key)
            return True
        except Exception as exc:
            if type(exc).__name__ in {"S3Error", "NoSuchKey"} or "NoSuchKey" in str(exc):
                return False
            raise

    def list_files(self, bucket: str, prefix: str) -> list[str]:
        names: list[str] = []
        for obj in self.iter_objects(bucket, prefix, recursive=True):
            if obj.object_name:
                names.append(obj.object_name)
        return names

    def check_health(self, bucket: Optional[str] = None) -> tuple[bool, Optional[str]]:
        try:
            if bucket is not None:
                self.ensure_bucket(bucket)
            else:
                _ = self.client.list_buckets()
            return True, None
        except Exception as exc:
            return False, str(exc)
