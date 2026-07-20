"""MinIO REVIEW/APPROVED storage for fingerprint personalization artifacts."""

from __future__ import annotations

import json
import logging
import mimetypes
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from shared.minio_client import MinioObjectStore, MinioSettings, build_public_object_url

from .artifact_groups import (
    APPROVED_DEBUG_FILES,
    APPROVED_PUBLISH_FILES,
    FINGERPRINT_DEBUG_FILES,
    FINGERPRINT_PRODUCTION_FILES,
    FINGERPRINT_REQUIRED_APPROVAL_FILES,
    FINGERPRINT_VIEWER_FILES,
    MANIFEST_FILENAME,
    PLACEMENT_FILENAME,
)
from .config import Settings, settings

logger = logging.getLogger("personalization.storage")

CONTENT_TYPES: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".pbm": "image/x-portable-bitmap",
}


def _guess_content_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in CONTENT_TYPES:
        return CONTENT_TYPES[suffix]
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class PersonalizationStorage:
    """Local processing dir + MinIO review/approved prefixes."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.settings = cfg
        self.bucket = cfg.PERSONALIZATION_MINIO_BUCKET
        self.prefix = cfg.PERSONALIZATION_MINIO_PREFIX.strip("/")
        self.public_endpoint = cfg.MINIO_PUBLIC_ENDPOINT
        self.base_dir = cfg.temp_dir_path
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._store = MinioObjectStore(
            MinioSettings(
                endpoint=cfg.MINIO_ENDPOINT,
                access_key=cfg.MINIO_ACCESS_KEY,
                secret_key=cfg.MINIO_SECRET_KEY,
                secure=cfg.MINIO_SECURE,
            )
        )
        try:
            self._store.ensure_bucket(self.bucket)
        except Exception as exc:
            logger.warning("MinIO ensure_bucket deferred: %s", exc)

    def create_artifact_id(self) -> str:
        return str(uuid.uuid4())

    def build_artifact_dir(self, artifact_id: str) -> Path:
        path = self.base_dir / artifact_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def artifact_dir(self, artifact_id: str) -> Path:
        return self.build_artifact_dir(artifact_id)

    def create_work_dir(self, artifact_id: str, operation: str) -> Path:
        work = self.build_artifact_dir(artifact_id) / ".work" / f"{operation}_{uuid.uuid4().hex[:8]}"
        work.mkdir(parents=True, exist_ok=True)
        return work

    def cleanup_work_dir(self, work_dir: Path) -> None:
        if work_dir.is_dir():
            shutil.rmtree(work_dir, ignore_errors=True)

    def build_review_object_key(self, artifact_id: str, filename: str) -> str:
        return f"{self.prefix}/review/{artifact_id}/{filename}"

    def build_approved_object_key(self, artifact_id: str, filename: str) -> str:
        return f"{self.prefix}/approved/{artifact_id}/{filename}"

    def build_public_url(self, object_key: str) -> str:
        return build_public_object_url(self.public_endpoint, self.bucket, object_key)

    def path_for(self, artifact_id: str, filename: str) -> Path:
        return self.build_artifact_dir(artifact_id) / filename

    def _upload_local_file(self, local_path: Path, object_key: str) -> dict[str, Any]:
        self._store.ensure_bucket(self.bucket)
        self._store.upload_file(
            self.bucket,
            object_key,
            local_path,
            content_type=_guess_content_type(local_path.name),
        )
        size = local_path.stat().st_size if local_path.is_file() else None
        return {
            "filename": local_path.name,
            "objectKey": object_key,
            "url": self.build_public_url(object_key),
            "sizeBytes": size,
            "contentType": _guess_content_type(local_path.name),
        }

    def upload_review_file(
        self,
        local_path: Path,
        artifact_id: str,
        filename: Optional[str] = None,
    ) -> dict[str, Any]:
        local_path = Path(local_path)
        name = filename or local_path.name
        if not local_path.is_file():
            raise FileNotFoundError(f"Local file not found: {local_path}")
        key = self.build_review_object_key(artifact_id, name)
        return self._upload_local_file(local_path, key)

    def upload_approved_file(
        self,
        local_path: Path,
        artifact_id: str,
        filename: Optional[str] = None,
    ) -> dict[str, Any]:
        local_path = Path(local_path)
        name = filename or local_path.name
        if not local_path.is_file():
            raise FileNotFoundError(f"Local file not found: {local_path}")
        key = self.build_approved_object_key(artifact_id, name)
        return self._upload_local_file(local_path, key)

    def sync_review_dir(
        self,
        artifact_id: str,
        dir_path: Path,
        only_filenames: Optional[list[str]] = None,
    ) -> dict[str, dict[str, Any]]:
        dir_path = Path(dir_path)
        if only_filenames:
            names = only_filenames
        else:
            names = [
                p.name
                for p in dir_path.iterdir()
                if p.is_file() and not p.name.startswith(".")
            ]
        results: dict[str, dict[str, Any]] = {}
        for name in names:
            src = dir_path / name
            if src.is_file():
                results[name] = self.upload_review_file(src, artifact_id, name)
        return results

    def delete_review_files(self, artifact_id: str, filenames: list[str]) -> None:
        for filename in filenames:
            key = self.build_review_object_key(artifact_id, filename)
            self._store.delete_object(self.bucket, key, ignore_missing=True)

    def delete_review_artifact(self, artifact_id: str) -> int:
        """Remove all objects under review/{artifact_id}/ after publish-approved."""
        prefix = f"{self.prefix}/review/{artifact_id}/"
        return self._store.delete_objects_with_prefix(self.bucket, prefix)

    def review_file_exists(self, artifact_id: str, filename: str) -> bool:
        return self._store.file_exists(
            self.bucket, self.build_review_object_key(artifact_id, filename)
        )

    def approved_file_exists(self, artifact_id: str, filename: str) -> bool:
        return self._store.file_exists(
            self.bucket, self.build_approved_object_key(artifact_id, filename)
        )

    def copy_review_to_approved(
        self,
        artifact_id: str,
        filenames: Optional[list[str]] = None,
    ) -> dict[str, dict[str, Any]]:
        if filenames is None:
            prefix = f"{self.prefix}/review/{artifact_id}/"
            keys = self._store.list_files(self.bucket, prefix)
            filenames = list(dict.fromkeys(Path(k).name for k in keys))

        results: dict[str, dict[str, Any]] = {}
        for filename in filenames:
            src_key = self.build_review_object_key(artifact_id, filename)
            if not self._store.file_exists(self.bucket, src_key):
                raise FileNotFoundError(f"Review object missing: {src_key}")
            dst_key = self.build_approved_object_key(artifact_id, filename)
            self._store.copy_file(self.bucket, src_key, dst_key)
            results[filename] = {
                "filename": filename,
                "objectKey": dst_key,
                "url": self.build_public_url(dst_key),
            }
        return results

    def load_local_manifest(self, artifact_id: str) -> dict[str, Any]:
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        if not path.is_file():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def ensure_local_from_approved(self, artifact_id: str, filename: str) -> None:
        """
        Download APPROVED artifact files into local `.tmp/personalization/{artifactId}/`
        when they are missing locally.

        This keeps Python endpoints resilient even if local processing artifacts were cleaned.
        """
        local_path = self.path_for(artifact_id, filename)
        if local_path.is_file():
            return
        if not self.approved_file_exists(artifact_id, filename):
            return
        object_key = self.build_approved_object_key(artifact_id, filename)
        self._store.download_file(self.bucket, object_key, local_path)

    def load_approved_manifest(self, artifact_id: str) -> dict[str, Any]:
        self.ensure_local_from_approved(artifact_id, MANIFEST_FILENAME)
        return self.load_local_manifest(artifact_id)

    def load_approved_placement(self, artifact_id: str) -> Optional[dict[str, Any]]:
        self.ensure_local_from_approved(artifact_id, PLACEMENT_FILENAME)
        local_path = self.path_for(artifact_id, PLACEMENT_FILENAME)
        if not local_path.is_file():
            return None
        try:
            return json.loads(local_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None

    def update_local_manifest(
        self,
        artifact_id: str,
        patch: dict[str, Any],
        *,
        remove_keys: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        manifest = self.load_local_manifest(artifact_id)
        if remove_keys:
            for key in remove_keys:
                manifest.pop(key, None)
        manifest.update(patch)
        manifest.setdefault("artifactId", artifact_id)
        manifest["updatedAt"] = _utc_now_iso()
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return manifest

    def upload_manifest_to_review(self, artifact_id: str) -> dict[str, Any]:
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        if not path.is_file():
            raise FileNotFoundError(f"Manifest not found locally: {path}")
        return self.upload_review_file(path, artifact_id, MANIFEST_FILENAME)

    def upload_manifest_to_approved(self, artifact_id: str) -> dict[str, Any]:
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        if not path.is_file():
            raise FileNotFoundError(f"Manifest not found locally: {path}")
        return self.upload_approved_file(path, artifact_id, MANIFEST_FILENAME)

    def check_minio_health(self) -> tuple[bool, Optional[str]]:
        return self._store.check_health(self.bucket)

    def build_review_files_response(self, artifact_id: str) -> dict[str, Any]:
        def url(filename: str) -> str:
            return self.build_public_url(
                self.build_review_object_key(artifact_id, filename)
            )

        return {
            "viewerFiles": {
                "overlayPng": url("fingerprint_overlay.png"),
                "alphaMap": url("fingerprint_alpha.png"),
                "heightmap": url("fingerprint_heightmap.png"),
                "normalMap": url("fingerprint_normal.png"),
                "roughnessMap": url("fingerprint_roughness.png"),
                "aoMap": url("fingerprint_ao.png"),
            },
            "productionFiles": {
                "svg": url("fingerprint.svg"),
            },
            "debugFiles": {
                "inputPng": url("input.png"),
                "finalCleanPng": url("06_final_clean.png"),
            },
        }

    def build_approved_viewer_response(self, artifact_id: str) -> dict[str, Any]:
        def url(filename: str) -> str:
            return self.build_public_url(
                self.build_approved_object_key(artifact_id, filename)
            )

        return {
            "viewerFiles": {
                "overlayPng": url("fingerprint_overlay.png"),
                "alphaMap": url("fingerprint_alpha.png"),
                "heightmap": url("fingerprint_heightmap.png"),
                "normalMap": url("fingerprint_normal.png"),
                "roughnessMap": url("fingerprint_roughness.png"),
                "aoMap": url("fingerprint_ao.png"),
            },
            "productionFiles": {
                "svg": url("fingerprint.svg"),
            },
        }


def replace_and_sync_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    work_dir: Path,
    output_filenames: list[str],
    replace_filenames: list[str],
    *,
    last_operation: str,
    manifest_patch: Optional[dict[str, Any]] = None,
) -> dict[str, dict[str, Any]]:
    """Atomic: validate work → move local → sync REVIEW (overwrite)."""
    work_dir = Path(work_dir)
    missing = [fn for fn in output_filenames if not (work_dir / fn).is_file()]
    if missing:
        raise ValueError(
            f"Missing outputs in work_dir {work_dir}: {', '.join(missing)}"
        )

    artifact_dir = storage.build_artifact_dir(artifact_id)
    output_set = set(output_filenames)
    unique_replace = list(dict.fromkeys(replace_filenames))

    try:
        for filename in output_filenames:
            src = work_dir / filename
            dst = artifact_dir / filename
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
        # Important: do not delete stale remote files until all uploads succeed.
        # This keeps the previous REVIEW snapshot intact on failures.
        uploaded = storage.sync_review_dir(artifact_id, artifact_dir, output_filenames)

        stale = [fn for fn in unique_replace if fn not in output_set]
        if stale:
            storage.delete_review_files(artifact_id, stale)

        patch = {
            "artifactId": artifact_id,
            "type": "fingerprint",
            "status": "READY_FOR_REVIEW",
            "stage": "review",
            "lastOperation": last_operation,
            "reviewPrefix": f"{storage.prefix}/review/{artifact_id}",
        }
        if manifest_patch:
            patch.update(manifest_patch)
        storage.update_local_manifest(artifact_id, patch)
        manifest_entry = storage.upload_manifest_to_review(artifact_id)
        uploaded[MANIFEST_FILENAME] = manifest_entry
        return uploaded
    finally:
        storage.cleanup_work_dir(work_dir)


personalization_storage = PersonalizationStorage()
storage_client = personalization_storage
