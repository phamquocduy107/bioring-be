"""Helpers for REVIEW/APPROVED fingerprint workflow."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("personalization.review")

from .artifact_groups import (
    APPROVED_DEBUG_FILES,
    APPROVED_PUBLISH_FILES,
    FINGERPRINT_REQUIRED_APPROVAL_FILES,
    MANIFEST_FILENAME,
    PLACEMENT_FILENAME,
    PROCESS_OUTPUT_FILES,
    RECONVERT_REPLACE_FILES,
    REPROCESS_OUTPUT_FILES,
    REPROCESS_REPLACE_FILES,
    TEXTURE_OUTPUT_FILES,
    TEXTURE_REPLACE_FILES,
)
from .config import settings
from .fingerprint_processor import ProcessOptions, process_fingerprint_file, reconvert_svg_from_final
from .storage_client import PersonalizationStorage, replace_and_sync_review
from .texture_processor import generate_fingerprint_texture_maps


def generate_textures_for_dir(
    artifact_dir: Path,
    *,
    blur_radius: Optional[float] = None,
    normal_strength: Optional[float] = None,
    roughness_base: Optional[int] = None,
    roughness_ridge: Optional[int] = None,
    ao_strength: Optional[float] = None,
) -> dict[str, str]:
    final_path = artifact_dir / "06_final_clean.png"
    return generate_fingerprint_texture_maps(
        final_path,
        artifact_dir,
        blur_radius=blur_radius or settings.FINGERPRINT_HEIGHTMAP_BLUR,
        normal_strength=normal_strength or settings.FINGERPRINT_NORMAL_STRENGTH,
        roughness_base=roughness_base or settings.FINGERPRINT_ROUGHNESS_BASE,
        roughness_ridge=roughness_ridge or settings.FINGERPRINT_ROUGHNESS_RIDGE,
        ao_strength=ao_strength or settings.FINGERPRINT_AO_STRENGTH,
    )


def finalize_process_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    artifact_dir: Path,
    *,
    last_operation: str = "process",
    extra_manifest: Optional[dict[str, Any]] = None,
) -> None:
    generate_textures_for_dir(artifact_dir)
    names = [n for n in PROCESS_OUTPUT_FILES if (artifact_dir / n).is_file()]
    storage.sync_review_dir(artifact_id, artifact_dir, names)
    patch: dict[str, Any] = {
        "status": "READY_FOR_REVIEW",
        "stage": "review",
        "lastOperation": last_operation,
        "reviewPrefix": f"{storage.prefix}/review/{artifact_id}",
    }
    if extra_manifest:
        patch.update(extra_manifest)
    storage.update_local_manifest(artifact_id, patch)
    storage.upload_manifest_to_review(artifact_id)


def reprocess_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    input_path: Path,
    work_dir: Path,
    options: ProcessOptions,
) -> None:
    result = process_fingerprint_file(input_path, work_dir, options)
    generate_textures_for_dir(work_dir)
    output_files = [n for n in REPROCESS_OUTPUT_FILES if (work_dir / n).is_file()]
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=REPROCESS_REPLACE_FILES,
        last_operation="reprocess",
        manifest_patch={"preset": result.get("metadata", {}).get("preset")},
    )


def reconvert_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    work_dir: Path,
    options: ProcessOptions,
) -> None:
    reconvert_svg_from_final(work_dir, options)
    output_files = ["fingerprint.svg"]
    if (work_dir / "fingerprint.pbm").is_file():
        output_files.append("fingerprint.pbm")
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=RECONVERT_REPLACE_FILES,
        last_operation="reconvert",
    )


def textures_to_review(
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
    final_path = storage.path_for(artifact_id, "06_final_clean.png")
    generate_fingerprint_texture_maps(
        final_path,
        work_dir,
        blur_radius=blur_radius,
        normal_strength=normal_strength,
        roughness_base=roughness_base,
        roughness_ridge=roughness_ridge,
        ao_strength=ao_strength,
    )
    output_files = list(TEXTURE_OUTPUT_FILES)
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=TEXTURE_REPLACE_FILES,
        last_operation="textures",
    )


def publish_approved(
    storage: PersonalizationStorage,
    artifact_id: str,
    *,
    approved_by: str,
    approved_at: str,
    approval_note: Optional[str],
    copy_debug_files: bool,
) -> dict[str, Any]:
    for filename in FINGERPRINT_REQUIRED_APPROVAL_FILES:
        if not storage.review_file_exists(artifact_id, filename):
            raise FileNotFoundError(
                f"Missing required review file: {filename}"
            )

    to_copy = list(APPROVED_PUBLISH_FILES) + [MANIFEST_FILENAME]
    if copy_debug_files:
        to_copy.extend(APPROVED_DEBUG_FILES)

    storage.copy_review_to_approved(artifact_id, to_copy)

    patch = {
        "status": "ASSET_APPROVED",
        "stage": "approved",
        "approvedAt": approved_at,
        "approvedBy": approved_by,
        "approvalNote": approval_note,
        "approvedPrefix": f"{storage.prefix}/approved/{artifact_id}",
        "lastOperation": "publish-approved",
    }
    storage.update_local_manifest(
        artifact_id,
        patch,
        remove_keys=["reviewPrefix"],
    )
    manifest_approved = storage.upload_manifest_to_approved(artifact_id)
    deleted = storage.delete_review_artifact(artifact_id)
    logger.info(
        "publish-approved artifact=%s copied=%d deleted_review_objects=%d",
        artifact_id,
        len(to_copy),
        deleted,
    )

    approved_files = storage.build_approved_viewer_response(artifact_id)
    return {
        "approvedFiles": approved_files,
        "manifestUrl": manifest_approved["url"],
        "reviewObjectsDeleted": deleted,
    }


def save_placement(
    storage: PersonalizationStorage,
    artifact_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    # Preserve existing manifest content (in case local `.tmp/...` was cleaned).
    storage.load_approved_manifest(artifact_id)

    placement_path = storage.path_for(artifact_id, PLACEMENT_FILENAME)
    placement_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    placement_upload = storage.upload_approved_file(
        placement_path, artifact_id, PLACEMENT_FILENAME
    )

    patch = {
        "status": "PLACEMENT_CONFIRMED",
        "placementConfirmedAt": payload.get("confirmedAt"),
        "confirmedBy": payload.get("confirmedBy"),
        "modelCode": payload.get("modelCode"),
        "surface": payload.get("surface"),
        "placement": payload.get("placement"),
        "lastOperation": "confirm-placement",
    }
    storage.update_local_manifest(artifact_id, patch)
    manifest = storage.upload_manifest_to_approved(artifact_id)
    return {
        "placementUrl": placement_upload["url"],
        "manifestUrl": manifest["url"],
    }
