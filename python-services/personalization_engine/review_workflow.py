"""Helpers for REVIEW/APPROVED fingerprint workflow."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

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
    STAGE_APPROVED,
    STAGE_REVIEW,
    TEXTURE_OUTPUT_FILES,
    TEXTURE_REPLACE_FILES,
    TYPE_FINGERPRINT,
)
from .config import settings
from .fingerprint_processor import ProcessOptions, process_fingerprint_file, reconvert_svg_from_final
from .storage_client import PersonalizationStorage, replace_and_sync_review
from .texture_processor import generate_fingerprint_texture_maps

logger = logging.getLogger("personalization.review")


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
    work_dir: Path,
    *,
    last_operation: str = "process",
    extra_manifest: Optional[dict[str, Any]] = None,
) -> None:
    """
    Process outputs already in work_dir → atomic sync to REVIEW → cleanup .work.

    Same pattern as soundwave / reprocess: local .work is temporary only.
    """
    generate_textures_for_dir(work_dir)
    output_files = [n for n in PROCESS_OUTPUT_FILES if (work_dir / n).is_file()]
    if "input.png" not in output_files and (work_dir / "input.png").is_file():
        output_files.insert(0, "input.png")
    if (work_dir / "options.json").is_file() and "options.json" not in output_files:
        output_files.append("options.json")
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=list(PROCESS_OUTPUT_FILES) + list(REPROCESS_REPLACE_FILES),
        last_operation=last_operation,
        artifact_type=TYPE_FINGERPRINT,
        manifest_patch=extra_manifest,
    )


def reprocess_to_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    input_path: Path,
    work_dir: Path,
    options: ProcessOptions,
    *,
    preset: Optional[str] = None,
) -> None:
    result = process_fingerprint_file(input_path, work_dir, options)
    generate_textures_for_dir(work_dir)
    options_path = work_dir / "options.json"
    if options_path.is_file() and preset:
        try:
            data = json.loads(options_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
        data["preset"] = preset
        options_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    output_files = [n for n in REPROCESS_OUTPUT_FILES if (work_dir / n).is_file()]
    if (work_dir / "options.json").is_file():
        output_files.append("options.json")
    replace_and_sync_review(
        storage,
        artifact_id,
        work_dir,
        output_filenames=output_files,
        replace_filenames=REPROCESS_REPLACE_FILES,
        last_operation="reprocess",
        artifact_type=TYPE_FINGERPRINT,
        manifest_patch={
            "preset": preset or result.get("metadata", {}).get("preset")
        },
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
        artifact_type=TYPE_FINGERPRINT,
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
    if not final_path.is_file():
        storage.ensure_local_from_review(
            artifact_id, "06_final_clean.png", artifact_type=TYPE_FINGERPRINT
        )
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
        artifact_type=TYPE_FINGERPRINT,
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
    """Copy REVIEW → APPROVED. Does NOT delete REVIEW (use cleanup_review)."""
    for filename in FINGERPRINT_REQUIRED_APPROVAL_FILES:
        if not storage.review_file_exists(
            artifact_id, filename, artifact_type=TYPE_FINGERPRINT
        ):
            raise FileNotFoundError(f"Missing required review file: {filename}")

    to_copy = list(APPROVED_PUBLISH_FILES) + [MANIFEST_FILENAME]
    if copy_debug_files:
        to_copy.extend(APPROVED_DEBUG_FILES)

    storage.copy_review_to_approved(TYPE_FINGERPRINT, artifact_id, to_copy)

    patch = {
        "artifactType": TYPE_FINGERPRINT,
        "type": TYPE_FINGERPRINT,
        "status": "ASSET_APPROVED",
        "stage": STAGE_APPROVED,
        "approvedAt": approved_at,
        "approvedBy": approved_by,
        "approvalNote": approval_note,
        "reviewPrefix": storage.stage_prefix(
            STAGE_REVIEW, TYPE_FINGERPRINT, artifact_id
        ).rstrip("/"),
        "approvedPrefix": storage.stage_prefix(
            STAGE_APPROVED, TYPE_FINGERPRINT, artifact_id
        ).rstrip("/"),
        "lastOperation": "publish-approved",
    }
    storage.update_local_manifest(artifact_id, patch)
    manifest_approved = storage.upload_manifest_to_approved(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )

    logger.info(
        "publish-approved fingerprint=%s copied=%d (review kept until cleanup)",
        artifact_id,
        len(to_copy),
    )

    approved_files = storage.build_approved_viewer_response(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )
    return {
        "approvedFiles": approved_files,
        "manifestUrl": manifest_approved["url"],
    }


def cleanup_review(
    storage: PersonalizationStorage,
    artifact_id: str,
    *,
    artifact_type: str = TYPE_FINGERPRINT,
    reason: str = "approved",
) -> dict[str, Any]:
    """Delete REVIEW prefix (and local .tmp) only if APPROVED assets exist."""
    marker = (
        "fingerprint_overlay.png"
        if artifact_type == TYPE_FINGERPRINT
        else "soundwave_overlay.png"
    )
    if not storage.approved_file_exists(
        artifact_id, marker, artifact_type=artifact_type
    ):
        raise FileNotFoundError(
            "Approved assets not found. Cannot cleanup review."
        )

    deleted = storage.delete_review_artifact(
        artifact_id, artifact_type=artifact_type
    )
    local_tmp_deleted = storage.cleanup_local_artifact(artifact_id)
    logger.info(
        "cleanup-review type=%s artifact=%s reason=%s deleted=%d localTmp=%s",
        artifact_type,
        artifact_id,
        reason,
        deleted,
        local_tmp_deleted,
    )
    return {
        "deletedObjects": deleted,
        "reason": reason,
        "localTmpDeleted": local_tmp_deleted,
    }


def save_placement(
    storage: PersonalizationStorage,
    artifact_id: str,
    payload: dict[str, Any],
    *,
    artifact_type: str = TYPE_FINGERPRINT,
) -> dict[str, Any]:
    storage.load_approved_manifest(artifact_id, artifact_type=artifact_type)

    placement_path = storage.path_for(artifact_id, PLACEMENT_FILENAME)
    placement_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    placement_upload = storage.upload_approved_file(
        placement_path,
        artifact_id,
        PLACEMENT_FILENAME,
        artifact_type=artifact_type,
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
    manifest = storage.upload_manifest_to_approved(
        artifact_id, artifact_type=artifact_type
    )
    return {
        "placementUrl": placement_upload["url"],
        "manifestUrl": manifest["url"],
    }
