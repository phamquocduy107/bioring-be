"""REVIEW/APPROVED workflow helpers for soundwave artifacts."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any, Optional

from .artifact_groups import (
    MANIFEST_FILENAME,
    SOUNDWAVE_APPROVED_DEBUG_FILES,
    SOUNDWAVE_APPROVED_PUBLISH_FILES,
    SOUNDWAVE_PROCESS_OUTPUT_FILES,
    SOUNDWAVE_REPROCESS_REPLACE_FILES,
    SOUNDWAVE_REQUIRED_APPROVAL_FILES,
    SOUNDWAVE_TEXTURE_REPLACE_FILES,
    SOUNDWAVE_VIEWER_FILES,
    STAGE_APPROVED,
    STAGE_REVIEW,
    TYPE_SOUNDWAVE,
)
from .soundwave_processor import (
    SoundwaveOptions,
    process_soundwave_file,
)
from .storage_client import PersonalizationStorage, replace_and_sync_review
from .texture_processor import generate_texture_maps

logger = logging.getLogger("personalization.soundwave")


def _find_original_audio(artifact_dir: Path) -> Optional[Path]:
    for path in sorted(artifact_dir.glob("audio_original.*")):
        if path.is_file():
            return path
    return None


def finalize_soundwave_process_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    input_path: Path,
    work_dir: Path,
    options: SoundwaveOptions,
    *,
    original_name: Optional[str] = None,
) -> dict[str, Any]:
    result = process_soundwave_file(
        Path(input_path),
        work_dir,
        options,
        original_name=original_name,
    )
    output_files = [
        n for n in SOUNDWAVE_PROCESS_OUTPUT_FILES if (work_dir / n).is_file()
    ]
    for path in work_dir.glob("audio_original.*"):
        if path.name not in output_files:
            output_files.append(path.name)

    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=list(
            dict.fromkeys(
                SOUNDWAVE_REPROCESS_REPLACE_FILES
                + [p.name for p in work_dir.glob("audio_original.*")]
            )
        ),
        last_operation="process",
        artifact_type=TYPE_SOUNDWAVE,
        manifest_patch={"style": options.style, **result.get("metadata", {})},
    )
    return result


def reprocess_soundwave_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    work_dir: Path,
    options: SoundwaveOptions,
) -> dict[str, Any]:
    artifact_dir = storage.build_artifact_dir(artifact_id)
    original = _find_original_audio(artifact_dir)
    if original is None:
        # Try download from REVIEW
        for key in storage._store.list_files(
            storage.bucket,
            storage.stage_prefix(STAGE_REVIEW, TYPE_SOUNDWAVE, artifact_id),
        ):
            name = Path(key).name
            if name.startswith("audio_original."):
                dest = artifact_dir / name
                storage.download_review_file(
                    artifact_id, name, dest, artifact_type=TYPE_SOUNDWAVE
                )
                original = dest
                break
    if original is None or not original.is_file():
        raise FileNotFoundError(
            "audio_original.* not found in REVIEW. Process soundwave first."
        )

    input_copy = work_dir / "input_audio"
    shutil.copy2(original, input_copy)
    result = process_soundwave_file(
        input_copy,
        work_dir,
        options,
        original_name=original.name,
    )
    output_files = [
        n for n in SOUNDWAVE_PROCESS_OUTPUT_FILES if (work_dir / n).is_file()
    ]
    for path in work_dir.glob("audio_original.*"):
        if path.name not in output_files:
            output_files.append(path.name)

    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=SOUNDWAVE_REPROCESS_REPLACE_FILES
        + [p.name for p in work_dir.glob("audio_original.*")],
        last_operation="reprocess",
        artifact_type=TYPE_SOUNDWAVE,
        manifest_patch={"style": options.style, **result.get("metadata", {})},
    )
    return result


def textures_soundwave_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    work_dir: Path,
    *,
    blur_radius: float,
    normal_strength: float,
    roughness_base: int,
    roughness_ridge: int,
    ao_strength: float,
) -> None:
    storage.ensure_local_from_review(
        artifact_id, "soundwave_preview.png", artifact_type=TYPE_SOUNDWAVE
    )
    preview = storage.path_for(artifact_id, "soundwave_preview.png")
    if not preview.is_file():
        raise FileNotFoundError("soundwave_preview.png not found in REVIEW")

    generate_texture_maps(
        preview,
        work_dir,
        name_prefix="soundwave",
        blur_radius=blur_radius,
        normal_strength=normal_strength,
        roughness_base=roughness_base,
        roughness_ridge=roughness_ridge,
        ao_strength=ao_strength,
    )
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=list(SOUNDWAVE_VIEWER_FILES),
        replace_filenames=SOUNDWAVE_TEXTURE_REPLACE_FILES,
        last_operation="textures",
        artifact_type=TYPE_SOUNDWAVE,
    )


def publish_soundwave_approved(
    storage: PersonalizationStorage,
    artifact_id: str,
    *,
    approved_by: str,
    approved_at: str,
    approval_note: Optional[str],
    copy_debug_files: bool,
) -> dict[str, Any]:
    """Copy REVIEW → APPROVED. Does NOT delete REVIEW (use cleanup_review)."""
    for filename in SOUNDWAVE_REQUIRED_APPROVAL_FILES:
        if not storage.review_file_exists(
            artifact_id, filename, artifact_type=TYPE_SOUNDWAVE
        ):
            raise FileNotFoundError(f"Missing required review file: {filename}")

    to_copy = list(SOUNDWAVE_APPROVED_PUBLISH_FILES) + [MANIFEST_FILENAME]

    # Always keep raw upload for memory-card / playback (extension varies).
    prefix = storage.stage_prefix(STAGE_REVIEW, TYPE_SOUNDWAVE, artifact_id)
    audio_original_name: Optional[str] = None
    for key in storage._store.list_files(storage.bucket, prefix):
        name = Path(key).name
        if name.startswith("audio_original."):
            audio_original_name = name
            if name not in to_copy:
                to_copy.append(name)
            break
    if audio_original_name is None:
        raise FileNotFoundError(
            "Missing required review file: audio_original.* (raw upload)"
        )

    if copy_debug_files:
        to_copy.extend(SOUNDWAVE_APPROVED_DEBUG_FILES)

    storage.copy_review_to_approved(TYPE_SOUNDWAVE, artifact_id, to_copy)

    patch = {
        "artifactType": TYPE_SOUNDWAVE,
        "type": TYPE_SOUNDWAVE,
        "status": "ASSET_APPROVED",
        "stage": STAGE_APPROVED,
        "approvedAt": approved_at,
        "approvedBy": approved_by,
        "approvalNote": approval_note,
        "audioOriginal": audio_original_name,
        "reviewPrefix": storage.stage_prefix(
            STAGE_REVIEW, TYPE_SOUNDWAVE, artifact_id
        ).rstrip("/"),
        "approvedPrefix": storage.stage_prefix(
            STAGE_APPROVED, TYPE_SOUNDWAVE, artifact_id
        ).rstrip("/"),
        "lastOperation": "publish-approved",
    }
    storage.update_local_manifest(artifact_id, patch)
    manifest_approved = storage.upload_manifest_to_approved(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    approved_files = storage.build_approved_viewer_response(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    logger.info(
        "publish-approved soundwave=%s copied=%d audio=%s (review kept until cleanup)",
        artifact_id,
        len(to_copy),
        audio_original_name,
    )
    return {
        "approvedFiles": approved_files,
        "manifestUrl": manifest_approved["url"],
    }
