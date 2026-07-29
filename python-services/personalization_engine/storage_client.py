"""MinIO REVIEW/APPROVED storage — stage + artifactType paths.

Object key:
  {prefix}/{stage}/{artifactType}/{artifactId}/{filename}

Local `.tmp/personalization/{artifactId}/` (+ `.work/`) is temporary only.
"""

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
    MANIFEST_FILENAME,
    PLACEMENT_FILENAME,
    STAGE_APPROVED,
    STAGE_REVIEW,
    TYPE_FINGERPRINT,
    TYPE_HEARTBEAT,
    TYPE_SOUNDWAVE,
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
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
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
    """Local temp work dirs + MinIO stage/type prefixes."""

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
            self._store.ensure_bucket(self.bucket, public_read=True)
        except Exception as exc:
            logger.warning("MinIO ensure_bucket deferred: %s", exc)

    # --- IDs / local dirs ---

    def create_artifact_id(self, artifact_type: str = TYPE_FINGERPRINT) -> str:
        from .artifact_groups import ARTIFACT_ID_PREFIX, SUPPORTED_ARTIFACT_TYPES

        if artifact_type not in SUPPORTED_ARTIFACT_TYPES:
            raise ValueError(f"Unsupported artifact type: {artifact_type}")
        prefix = ARTIFACT_ID_PREFIX.get(artifact_type, artifact_type[:2])
        return f"{prefix}_{uuid.uuid4()}"

    def build_artifact_dir(self, artifact_id: str) -> Path:
        path = self.base_dir / artifact_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def artifact_dir(self, artifact_id: str) -> Path:
        return self.build_artifact_dir(artifact_id)

    def create_work_dir(self, artifact_id: str, operation: str) -> Path:
        work = (
            self.build_artifact_dir(artifact_id)
            / ".work"
            / f"{operation}_{uuid.uuid4().hex[:8]}"
        )
        work.mkdir(parents=True, exist_ok=True)
        return work

    def cleanup_work_dir(self, work_dir: Path) -> None:
        if work_dir.is_dir():
            shutil.rmtree(work_dir, ignore_errors=True)

    def cleanup_local_artifact(self, artifact_id: str) -> bool:
        """
        Best-effort remove `.tmp/personalization/{artifactId}/` (incl. `.work/`).
        Does not create the directory. Returns True if removed or already absent.
        """
        path = self.base_dir / artifact_id
        if not path.exists():
            return True
        try:
            shutil.rmtree(path)
            return True
        except Exception as exc:
            logger.warning(
                "Failed to remove local tmp for artifact=%s path=%s: %s",
                artifact_id,
                path,
                exc,
            )
            return False

    def path_for(self, artifact_id: str, filename: str) -> Path:
        return self.build_artifact_dir(artifact_id) / filename

    # --- Key builders ---

    def build_object_key(
        self,
        stage: str,
        artifact_type: str,
        artifact_id: str,
        filename: str,
    ) -> str:
        return f"{self.prefix}/{stage}/{artifact_type}/{artifact_id}/{filename}"

    def stage_prefix(
        self, stage: str, artifact_type: str, artifact_id: str
    ) -> str:
        return f"{self.prefix}/{stage}/{artifact_type}/{artifact_id}/"

    def build_review_object_key(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> str:
        return self.build_object_key(
            STAGE_REVIEW, artifact_type, artifact_id, filename
        )

    def build_approved_object_key(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> str:
        return self.build_object_key(
            STAGE_APPROVED, artifact_type, artifact_id, filename
        )

    def build_public_url(self, object_key: str) -> str:
        return build_public_object_url(self.public_endpoint, self.bucket, object_key)

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

    # --- Stage upload / sync ---

    def upload_file_to_stage(
        self,
        local_path: Path,
        stage: str,
        artifact_type: str,
        artifact_id: str,
        filename: Optional[str] = None,
    ) -> dict[str, Any]:
        local_path = Path(local_path)
        name = filename or local_path.name
        if not local_path.is_file():
            raise FileNotFoundError(f"Local file not found: {local_path}")
        key = self.build_object_key(stage, artifact_type, artifact_id, name)
        return self._upload_local_file(local_path, key)

    def sync_dir_to_stage(
        self,
        dir_path: Path,
        stage: str,
        artifact_type: str,
        artifact_id: str,
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
                results[name] = self.upload_file_to_stage(
                    src, stage, artifact_type, artifact_id, name
                )
        return results

    def upload_review_file(
        self,
        local_path: Path,
        artifact_id: str,
        filename: Optional[str] = None,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        return self.upload_file_to_stage(
            local_path,
            STAGE_REVIEW,
            artifact_type,
            artifact_id,
            filename,
        )

    def upload_approved_file(
        self,
        local_path: Path,
        artifact_id: str,
        filename: Optional[str] = None,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        return self.upload_file_to_stage(
            local_path,
            STAGE_APPROVED,
            artifact_type,
            artifact_id,
            filename,
        )

    def sync_review_dir(
        self,
        artifact_id: str,
        dir_path: Path,
        only_filenames: Optional[list[str]] = None,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, dict[str, Any]]:
        return self.sync_dir_to_stage(
            dir_path,
            STAGE_REVIEW,
            artifact_type,
            artifact_id,
            only_filenames,
        )

    def delete_stage_files(
        self,
        stage: str,
        artifact_type: str,
        artifact_id: str,
        filenames: list[str],
    ) -> None:
        for filename in filenames:
            key = self.build_object_key(stage, artifact_type, artifact_id, filename)
            self._store.delete_file(self.bucket, key, ignore_missing=True)

    def delete_stage_prefix(
        self,
        stage: str,
        artifact_type: str,
        artifact_id: str,
    ) -> int:
        prefix = self.stage_prefix(stage, artifact_type, artifact_id)
        return self._store.delete_prefix(self.bucket, prefix)

    def delete_review_files(
        self,
        artifact_id: str,
        filenames: list[str],
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> None:
        self.delete_stage_files(
            STAGE_REVIEW, artifact_type, artifact_id, filenames
        )

    def delete_review_artifact(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> int:
        return self.delete_stage_prefix(STAGE_REVIEW, artifact_type, artifact_id)

    def delete_approved_artifact(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> int:
        return self.delete_stage_prefix(
            STAGE_APPROVED, artifact_type, artifact_id
        )

    def stage_file_exists(
        self,
        stage: str,
        artifact_type: str,
        artifact_id: str,
        filename: str,
    ) -> bool:
        return self._store.file_exists(
            self.bucket,
            self.build_object_key(stage, artifact_type, artifact_id, filename),
        )

    def review_file_exists(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> bool:
        return self.stage_file_exists(
            STAGE_REVIEW, artifact_type, artifact_id, filename
        )

    def approved_file_exists(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> bool:
        return self.stage_file_exists(
            STAGE_APPROVED, artifact_type, artifact_id, filename
        )

    def copy_review_to_approved(
        self,
        artifact_type: str,
        artifact_id: str,
        filenames: Optional[list[str]] = None,
    ) -> dict[str, dict[str, Any]]:
        if filenames is None:
            prefix = self.stage_prefix(STAGE_REVIEW, artifact_type, artifact_id)
            keys = self._store.list_files(self.bucket, prefix)
            filenames = list(dict.fromkeys(Path(k).name for k in keys))

        results: dict[str, dict[str, Any]] = {}
        for filename in filenames:
            src_key = self.build_object_key(
                STAGE_REVIEW, artifact_type, artifact_id, filename
            )
            if not self._store.file_exists(self.bucket, src_key):
                raise FileNotFoundError(f"Review object missing: {src_key}")
            dst_key = self.build_object_key(
                STAGE_APPROVED, artifact_type, artifact_id, filename
            )
            self._store.copy_file(self.bucket, src_key, dst_key)
            results[filename] = {
                "filename": filename,
                "objectKey": dst_key,
                "url": self.build_public_url(dst_key),
            }
        return results

    # --- Download helpers ---

    def ensure_local_from_stage(
        self,
        stage: str,
        artifact_type: str,
        artifact_id: str,
        filename: str,
    ) -> None:
        local_path = self.path_for(artifact_id, filename)
        if local_path.is_file():
            return
        if not self.stage_file_exists(stage, artifact_type, artifact_id, filename):
            return
        object_key = self.build_object_key(
            stage, artifact_type, artifact_id, filename
        )
        self._store.download_file(self.bucket, object_key, local_path)

    def ensure_local_from_review(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> None:
        self.ensure_local_from_stage(
            STAGE_REVIEW, artifact_type, artifact_id, filename
        )

    def ensure_local_from_approved(
        self,
        artifact_id: str,
        filename: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> None:
        self.ensure_local_from_stage(
            STAGE_APPROVED, artifact_type, artifact_id, filename
        )

    def download_review_file(
        self,
        artifact_id: str,
        filename: str,
        dest: Path,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> Path:
        key = self.build_review_object_key(
            artifact_id, filename, artifact_type=artifact_type
        )
        return self._store.download_file(self.bucket, key, dest)

    # --- Manifest ---

    def load_local_manifest(self, artifact_id: str) -> dict[str, Any]:
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        if not path.is_file():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def load_approved_manifest(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        self.ensure_local_from_approved(
            artifact_id, MANIFEST_FILENAME, artifact_type=artifact_type
        )
        return self.load_local_manifest(artifact_id)

    def load_review_manifest(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        self.ensure_local_from_review(
            artifact_id, MANIFEST_FILENAME, artifact_type=artifact_type
        )
        return self.load_local_manifest(artifact_id)

    def load_approved_placement(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> Optional[dict[str, Any]]:
        self.ensure_local_from_approved(
            artifact_id, PLACEMENT_FILENAME, artifact_type=artifact_type
        )
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

    def build_manifest(
        self,
        artifact_type: str,
        artifact_id: str,
        stage: str,
        status: str,
        files: dict[str, Any],
        extra: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        manifest: dict[str, Any] = {
            "artifactId": artifact_id,
            "artifactType": artifact_type,
            "type": artifact_type,
            "stage": stage,
            "status": status,
            "files": files,
            "reviewPrefix": self.stage_prefix(
                STAGE_REVIEW, artifact_type, artifact_id
            ).rstrip("/"),
            "approvedPrefix": self.stage_prefix(
                STAGE_APPROVED, artifact_type, artifact_id
            ).rstrip("/"),
            "updatedAt": _utc_now_iso(),
        }
        if extra:
            manifest.update(extra)
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return manifest

    def upload_manifest(
        self,
        artifact_type: str,
        artifact_id: str,
        stage: str,
        manifest: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        path = self.path_for(artifact_id, MANIFEST_FILENAME)
        if manifest is not None:
            path.write_text(
                json.dumps(manifest, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        if not path.is_file():
            raise FileNotFoundError(f"Manifest not found locally: {path}")
        return self.upload_file_to_stage(
            path, stage, artifact_type, artifact_id, MANIFEST_FILENAME
        )

    def upload_manifest_to_review(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        return self.upload_manifest(
            artifact_type, artifact_id, STAGE_REVIEW
        )

    def upload_manifest_to_approved(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        return self.upload_manifest(
            artifact_type, artifact_id, STAGE_APPROVED
        )

    def check_minio_health(self) -> tuple[bool, Optional[str]]:
        ok, message = self._store.check_health(self.bucket)
        if not ok:
            return ok, message
        try:
            self._store.ensure_public_read(self.bucket)
        except Exception as exc:
            logger.warning("MinIO public-read policy failed: %s", exc)
            return False, f"bucket ok but public-read failed: {exc}"
        return True, None

    def find_audio_original_filename(
        self,
        artifact_id: str,
        *,
        stage: str = STAGE_REVIEW,
        artifact_type: str = TYPE_SOUNDWAVE,
    ) -> Optional[str]:
        """Return `audio_original.<ext>` name if present under stage prefix."""
        prefix = self.stage_prefix(stage, artifact_type, artifact_id)
        for key in self._store.list_files(self.bucket, prefix):
            name = Path(key).name
            if name.startswith("audio_original."):
                return name
        # Local fallback (hydrate before MinIO list in some paths)
        artifact_dir = self.build_artifact_dir(artifact_id)
        for path in sorted(artifact_dir.glob("audio_original.*")):
            if path.is_file():
                return path.name
        return None

    def find_source_raw_filename(
        self,
        artifact_id: str,
        *,
        stage: str = STAGE_APPROVED,
        artifact_type: str = TYPE_HEARTBEAT,
    ) -> Optional[str]:
        """Return `source_raw.<ext>` name if present under stage prefix."""
        prefix = self.stage_prefix(stage, artifact_type, artifact_id)
        for key in self._store.list_files(self.bucket, prefix):
            name = Path(key).name
            if name.startswith("source_raw."):
                return name
        artifact_dir = self.build_artifact_dir(artifact_id)
        for path in sorted(artifact_dir.glob("source_raw.*")):
            if path.is_file():
                return path.name
        return None

    def build_review_files_response(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        def url(filename: str) -> str:
            return self.build_public_url(
                self.build_review_object_key(
                    artifact_id, filename, artifact_type=artifact_type
                )
            )

        if artifact_type == TYPE_SOUNDWAVE:
            audio_original = self.find_audio_original_filename(
                artifact_id, stage=STAGE_REVIEW, artifact_type=TYPE_SOUNDWAVE
            )
            production: dict[str, Any] = {
                "svg": url("soundwave.svg"),
                "waveformPoints": url("waveform_points.json"),
                "audioSegment": url("audio_segment.wav"),
            }
            raw_url = ""
            if audio_original:
                raw_url = url(audio_original)
                production["audioOriginal"] = raw_url
            return {
                "viewerFiles": {
                    "overlayPng": url("soundwave_overlay.png"),
                    "alphaMap": url("soundwave_alpha.png"),
                    "heightmap": url("soundwave_heightmap.png"),
                    "normalMap": url("soundwave_normal.png"),
                    "roughnessMap": url("soundwave_roughness.png"),
                    "aoMap": url("soundwave_ao.png"),
                },
                "productionFiles": production,
                "sourceFiles": {"raw": raw_url},
                "debugFiles": {
                    "previewPng": url("soundwave_preview.png"),
                    "segmentWav": url("audio_segment.wav"),
                },
            }

        input_url = url("input.png")
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
            "sourceFiles": {"raw": input_url},
            "debugFiles": {
                "inputPng": input_url,
                "finalCleanPng": url("06_final_clean.png"),
            },
        }

    def build_approved_viewer_response(
        self,
        artifact_id: str,
        *,
        artifact_type: str = TYPE_FINGERPRINT,
    ) -> dict[str, Any]:
        def url(filename: str) -> str:
            return self.build_public_url(
                self.build_approved_object_key(
                    artifact_id, filename, artifact_type=artifact_type
                )
            )

        if artifact_type == TYPE_SOUNDWAVE:
            audio_original = self.find_audio_original_filename(
                artifact_id, stage=STAGE_APPROVED, artifact_type=TYPE_SOUNDWAVE
            )
            production: dict[str, Any] = {
                "svg": url("soundwave.svg"),
                "waveformPoints": url("waveform_points.json"),
                "audioSegment": url("audio_segment.wav"),
            }
            raw_url = ""
            if audio_original:
                raw_url = url(audio_original)
                production["audioOriginal"] = raw_url
            return {
                "viewerFiles": {
                    "overlayPng": url("soundwave_overlay.png"),
                    "alphaMap": url("soundwave_alpha.png"),
                    "heightmap": url("soundwave_heightmap.png"),
                    "normalMap": url("soundwave_normal.png"),
                    "roughnessMap": url("soundwave_roughness.png"),
                    "aoMap": url("soundwave_ao.png"),
                },
                "productionFiles": production,
                "sourceFiles": {"raw": raw_url},
                "audioOriginal": production.get("audioOriginal"),
                "audioSegment": production["audioSegment"],
            }

        # Prefer original upload when published with copyDebugFiles; else empty raw.
        raw_url = ""
        if self.stage_file_exists(
            STAGE_APPROVED, artifact_type, artifact_id, "input.png"
        ):
            raw_url = url("input.png")
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
            "sourceFiles": {"raw": raw_url},
        }


def replace_and_sync_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    work_dir: Path,
    output_filenames: list[str],
    replace_filenames: list[str],
    *,
    last_operation: str,
    artifact_type: str = TYPE_FINGERPRINT,
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
        # Do not delete stale remote files until all uploads succeed.
        uploaded = storage.sync_review_dir(
            artifact_id,
            artifact_dir,
            output_filenames,
            artifact_type=artifact_type,
        )

        stale = [fn for fn in unique_replace if fn not in output_set]
        if stale:
            storage.delete_review_files(
                artifact_id, stale, artifact_type=artifact_type
            )

        patch = {
            "artifactId": artifact_id,
            "artifactType": artifact_type,
            "type": artifact_type,
            "status": "READY_FOR_REVIEW",
            "stage": STAGE_REVIEW,
            "lastOperation": last_operation,
            "reviewPrefix": storage.stage_prefix(
                STAGE_REVIEW, artifact_type, artifact_id
            ).rstrip("/"),
        }
        if manifest_patch:
            patch.update(manifest_patch)
        storage.update_local_manifest(artifact_id, patch)
        manifest_entry = storage.upload_manifest_to_review(
            artifact_id, artifact_type=artifact_type
        )
        uploaded[MANIFEST_FILENAME] = manifest_entry
        return uploaded
    finally:
        storage.cleanup_work_dir(work_dir)


personalization_storage = PersonalizationStorage()
storage_client = personalization_storage
