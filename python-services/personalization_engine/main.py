"""Personalization Engine — fingerprint REVIEW/APPROVED workflow."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from shared.nest_log import setup_logging

from .artifact_groups import TEXTURE_OUTPUT_FILES
from .config import settings
from .fingerprint_processor import (
    ProcessOptions,
    find_artifact_input,
    process_fingerprint_file,
)
from .presets import (
    REPROCESS_PARAMETER_GUIDE,
    REPROCESS_PRESETS,
    TEXTURE_PARAMETER_GUIDE,
    TEXTURE_PRESETS,
    resolve_preset,
    resolve_texture_options,
)
from .review_workflow import (
    finalize_process_to_review,
    publish_approved,
    reconvert_to_review,
    reprocess_to_review,
    save_placement,
    textures_to_review,
)
from .schemas import (
    AppliedTextureOptions,
    ApprovedFilesBundle,
    ApprovedViewerAssetsResponse,
    ConfirmPlacementRequest,
    ConfirmPlacementResponse,
    DebugFiles,
    ErrorResponse,
    FingerprintMetadata,
    FingerprintQuality,
    FingerprintReconvertSvgRequest,
    FingerprintReviewResponse,
    FingerprintTextureFiles,
    FingerprintTextureMetadata,
    FingerprintTextureOptions,
    FingerprintTextureResponse,
    FingerprintTuneOptions,
    HealthResponse,
    PlacementTransform,
    PresetListResponse,
    ProductionFiles,
    PublishApprovedRequest,
    PublishApprovedResponse,
    ReviewFilesBundle,
    StorageHealthResponse,
    ViewerFiles,
)
from .storage_client import personalization_storage

logger = setup_logging("PERSONALIZATION")

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
}

APP_DESCRIPTION = """
## Fingerprint workflow (REVIEW → APPROVED)

1. **`POST /fingerprint/process`** — staff upload → local pipeline → **REVIEW** MinIO prefix
2. **`POST /fingerprint/{id}/reprocess|reconvert|textures`** — overwrite **REVIEW** only
3. **`POST /fingerprint/{id}/publish-approved`** — NestJS internal: copy REVIEW → APPROVED, then delete REVIEW prefix
4. **`GET /fingerprint/{id}/approved-viewer-assets`** — mobile: **APPROVED** URLs only
5. **`POST /fingerprint/{id}/confirm-placement`** — save placement to APPROVED
"""

app = FastAPI(
    title="BIORING Personalization Engine",
    description=APP_DESCRIPTION,
    version="0.8.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _default_options() -> ProcessOptions:
    return ProcessOptions(
        canvas_size=settings.FINGERPRINT_CANVAS_SIZE,
        content_ratio=settings.FINGERPRINT_CONTENT_RATIO,
        min_area=settings.FINGERPRINT_MIN_AREA,
        output_svg=True,
        padding=settings.FINGERPRINT_PADDING,
        erode_size=settings.FINGERPRINT_ERODE_SIZE,
        adaptive_block_size=settings.FINGERPRINT_ADAPTIVE_BLOCK_SIZE,
        adaptive_c=settings.FINGERPRINT_ADAPTIVE_C,
        blur_ksize=settings.FINGERPRINT_BLUR_KSIZE,
        clahe_clip=settings.FINGERPRINT_CLAHE_CLIP,
        apply_morphology=settings.FINGERPRINT_APPLY_MORPHOLOGY,
        turdsize=settings.POTRACE_TURDSIZE,
        alphamax=settings.POTRACE_ALPHAMAX,
        opttolerance=settings.POTRACE_OPTTOLERANCE,
        generate_textures=False,
        heightmap_blur=settings.FINGERPRINT_HEIGHTMAP_BLUR,
        normal_strength=settings.FINGERPRINT_NORMAL_STRENGTH,
        roughness_base=settings.FINGERPRINT_ROUGHNESS_BASE,
        roughness_ridge=settings.FINGERPRINT_ROUGHNESS_RIDGE,
        ao_strength=settings.FINGERPRINT_AO_STRENGTH,
        engrave_depth=settings.FINGERPRINT_ENGRAVE_DEPTH,
    )


def _pick(kwargs: Dict[str, Any], key: str, default: Any) -> Any:
    value = kwargs.get(key, None)
    return default if value is None else value


def _merge_options(**kwargs: Any) -> ProcessOptions:
    base = _default_options()
    return ProcessOptions(
        canvas_size=base.canvas_size,
        content_ratio=base.content_ratio,
        min_area=_pick(kwargs, "minArea", base.min_area),
        output_svg=_pick(kwargs, "outputSvg", base.output_svg),
        padding=base.padding,
        erode_size=_pick(kwargs, "erodeSize", base.erode_size),
        adaptive_block_size=base.adaptive_block_size,
        adaptive_c=_pick(kwargs, "adaptiveC", base.adaptive_c),
        blur_ksize=base.blur_ksize,
        clahe_clip=base.clahe_clip,
        apply_morphology=_pick(kwargs, "applyMorphology", base.apply_morphology),
        turdsize=_pick(kwargs, "turdsize", base.turdsize),
        alphamax=base.alphamax,
        opttolerance=_pick(kwargs, "opttolerance", base.opttolerance),
        generate_textures=False,
        heightmap_blur=_pick(kwargs, "heightmapBlur", base.heightmap_blur),
        normal_strength=_pick(kwargs, "normalStrength", base.normal_strength),
        roughness_base=_pick(kwargs, "roughnessBase", base.roughness_base),
        roughness_ridge=_pick(kwargs, "roughnessRidge", base.roughness_ridge),
        ao_strength=_pick(kwargs, "aoStrength", base.ao_strength),
        engrave_depth=_pick(kwargs, "engraveDepth", base.engrave_depth),
    )


def _validate_options(opts: ProcessOptions) -> None:
    if opts.min_area < 1:
        raise HTTPException(status_code=400, detail="minArea must be >= 1.")
    if opts.erode_size < 1:
        raise HTTPException(status_code=400, detail="erodeSize must be >= 1.")
    if opts.turdsize < 0:
        raise HTTPException(status_code=400, detail="turdsize must be >= 0.")


def _public_metadata(
    result: Dict[str, Any], *, preset: Optional[str] = None
) -> FingerprintMetadata:
    meta = result["metadata"]
    return FingerprintMetadata(
        width=int(meta["width"]),
        height=int(meta["height"]),
        minArea=int(meta["minArea"]),
        adaptiveC=int(meta["adaptiveC"]),
        erodeSize=int(meta["erodeSize"]),
        applyMorphology=bool(meta["applyMorphology"]),
        turdsize=int(meta["turdsize"]),
        opttolerance=float(meta["opttolerance"]),
        outputSvg=bool(meta.get("outputSvg", True)),
        preset=preset or meta.get("preset"),
        generateTextures=bool(meta.get("generateTextures", False)),
        heightmapBlur=meta.get("heightmapBlur"),
        normalStrength=meta.get("normalStrength"),
        roughnessBase=meta.get("roughnessBase"),
        roughnessRidge=meta.get("roughnessRidge"),
        aoStrength=meta.get("aoStrength"),
        engraveDepth=meta.get("engraveDepth"),
    )


def _manifest_review_url(artifact_id: str) -> str:
    return personalization_storage.build_public_url(
        personalization_storage.build_review_object_key(
            artifact_id, "artifact_manifest.json"
        )
    )


def _build_review_response(
    artifact_id: str,
    *,
    quality: Optional[Dict[str, Any]] = None,
    metadata: Optional[FingerprintMetadata] = None,
) -> FingerprintReviewResponse:
    files = personalization_storage.build_review_files_response(artifact_id)
    return FingerprintReviewResponse(
        artifactId=artifact_id,
        status="READY_FOR_REVIEW",
        stage="review",
        quality=FingerprintQuality(**quality) if quality else None,
        reviewFiles=ReviewFilesBundle(
            viewerFiles=ViewerFiles(**files["viewerFiles"]),
            productionFiles=ProductionFiles(**files["productionFiles"]),
            debugFiles=DebugFiles(**files["debugFiles"]),
        ),
        manifestUrl=_manifest_review_url(artifact_id),
        metadata=metadata,
    )


def _run_process(
    input_path: Path, artifact_dir: Path, options: ProcessOptions
) -> Dict[str, Any]:
    try:
        return process_fingerprint_file(input_path, artifact_dir, options)
    except FileNotFoundError as exc:
        logger.error("Fingerprint SVG failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Fingerprint process failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Fingerprint processing failed: {exc}",
        ) from exc


def _copy_options_json(src_dir: Path, artifact_id: str) -> None:
    src = src_dir / "options.json"
    if not src.is_file():
        return
    dst = personalization_storage.path_for(artifact_id, "options.json")
    shutil.copy2(src, dst)


def _texture_metadata_from_options(
    prev: Dict[str, Any],
    *,
    applied_preset: Optional[str],
    applied_options: Dict[str, Any],
) -> FingerprintTextureMetadata:
    return FingerprintTextureMetadata(
        appliedTexturePreset=applied_preset or prev.get("appliedTexturePreset"),
        appliedTextureOptions=AppliedTextureOptions(
            heightmapBlur=float(applied_options["heightmapBlur"]),
            normalStrength=float(applied_options["normalStrength"]),
            roughnessBase=int(applied_options["roughnessBase"]),
            roughnessRidge=int(applied_options["roughnessRidge"]),
            aoStrength=float(applied_options["aoStrength"]),
        ),
    )


def _review_texture_urls(artifact_id: str) -> dict[str, str]:
    def url(name: str) -> str:
        return personalization_storage.build_public_url(
            personalization_storage.build_review_object_key(artifact_id, name)
        )

    return {
        "overlay": url("fingerprint_overlay.png"),
        "alpha": url("fingerprint_alpha.png"),
        "heightmap": url("fingerprint_heightmap.png"),
        "normal": url("fingerprint_normal.png"),
        "roughness": url("fingerprint_roughness.png"),
        "ao": url("fingerprint_ao.png"),
    }


def _textures_exist_in_review(artifact_id: str) -> bool:
    return all(
        personalization_storage.review_file_exists(artifact_id, name)
        for name in TEXTURE_OUTPUT_FILES
    )


def _texture_response(
    artifact_id: str,
    metadata: FingerprintTextureMetadata,
) -> FingerprintTextureResponse:
    urls = _review_texture_urls(artifact_id)
    return FingerprintTextureResponse(
        artifactId=artifact_id,
        files=FingerprintTextureFiles(
            overlayPng=urls["overlay"],
            alphaMap=urls["alpha"],
            heightmap=urls["heightmap"],
            normalMap=urls["normal"],
            roughnessMap=urls["roughness"],
            aoMap=urls["ao"],
        ),
        metadata=metadata,
    )


def _load_placement_from_manifest(artifact_id: str) -> Optional[PlacementTransform]:
    manifest = personalization_storage.load_local_manifest(artifact_id)
    raw = manifest.get("placement")
    if not isinstance(raw, dict):
        return None
    try:
        return PlacementTransform(**raw)
    except Exception:
        return None


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="personalization_engine")


@app.get(
    "/storage/health",
    response_model=StorageHealthResponse,
    tags=["Storage"],
    summary="Kiểm tra MinIO REVIEW/APPROVED storage",
)
def storage_health() -> StorageHealthResponse:
    prefix = settings.PERSONALIZATION_MINIO_PREFIX.strip("/")
    ok, message = personalization_storage.check_minio_health()
    if ok:
        return StorageHealthResponse(
            status="ok",
            bucket=settings.PERSONALIZATION_MINIO_BUCKET,
            prefix=prefix,
            reviewPrefixExample=f"{prefix}/review/{{artifactId}}/...",
            approvedPrefixExample=f"{prefix}/approved/{{artifactId}}/...",
            endpoint=settings.MINIO_ENDPOINT,
            publicEndpoint=settings.MINIO_PUBLIC_ENDPOINT,
        )
    return StorageHealthResponse(
        status="error",
        bucket=settings.PERSONALIZATION_MINIO_BUCKET,
        prefix=prefix,
        reviewPrefixExample=f"{prefix}/review/{{artifactId}}/...",
        approvedPrefixExample=f"{prefix}/approved/{{artifactId}}/...",
        endpoint=settings.MINIO_ENDPOINT,
        publicEndpoint=settings.MINIO_PUBLIC_ENDPOINT,
        message=message,
    )


@app.get(
    "/fingerprint/presets",
    response_model=PresetListResponse,
    tags=["Fingerprint"],
)
def list_reprocess_presets() -> PresetListResponse:
    return PresetListResponse(
        presets=REPROCESS_PRESETS,
        parameterGuide=REPROCESS_PARAMETER_GUIDE,
    )


@app.get(
    "/fingerprint/texture-presets",
    response_model=PresetListResponse,
    tags=["Fingerprint"],
)
def list_texture_presets() -> PresetListResponse:
    return PresetListResponse(
        presets=TEXTURE_PRESETS,
        parameterGuide=TEXTURE_PARAMETER_GUIDE,
    )


@app.post(
    "/fingerprint/process",
    response_model=FingerprintReviewResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["Fingerprint"],
    summary="Upload ảnh → pipeline → REVIEW MinIO",
)
async def process_fingerprint(
    file: UploadFile = File(..., description="Ảnh vân tay PNG/JPG"),
) -> FingerprintReviewResponse:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only image/png or image/jpeg are allowed.",
        )

    options = _default_options()
    _validate_options(options)

    artifact_id = personalization_storage.create_artifact_id()
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)

    suffix = Path(file.filename or "input.png").suffix.lower() or ".png"
    if suffix not in {".png", ".jpg", ".jpeg"}:
        suffix = ".png" if "png" in content_type else ".jpg"

    input_path = artifact_dir / f"input{suffix}"
    try:
        with input_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        await file.close()

    if input_path.name != "input.png":
        normalized = artifact_dir / "input.png"
        shutil.move(str(input_path), str(normalized))
        input_path = normalized

    result = _run_process(input_path, artifact_dir, options)
    options_path = artifact_dir / "options.json"
    if options_path.is_file():
        try:
            data = json.loads(options_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
        data["preset"] = "standard"
        options_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        result["metadata"]["preset"] = "standard"

    try:
        finalize_process_to_review(
            personalization_storage,
            artifact_id,
            artifact_dir,
            last_operation="process",
            extra_manifest={"preset": "standard"},
        )
    except Exception as exc:
        logger.exception("Upload to REVIEW failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload artifacts to REVIEW: {exc}",
        ) from exc

    logger.info(
        "fingerprint process artifact=%s score=%s",
        artifact_id,
        result["quality"].get("score"),
    )
    return _build_review_response(
        artifact_id,
        quality=result["quality"],
        metadata=_public_metadata(result, preset="standard"),
    )


@app.post(
    "/fingerprint/{artifact_id}/reprocess",
    response_model=FingerprintReviewResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
)
async def reprocess_fingerprint(
    artifact_id: str,
    body: FingerprintTuneOptions,
) -> FingerprintReviewResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    input_path = find_artifact_input(artifact_dir)
    if input_path is None:
        raise HTTPException(
            status_code=404,
            detail="Artifact has no input image (input.png/jpg). Cannot reprocess.",
        )

    try:
        preset_params = resolve_preset(body.preset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    overrides = body.model_dump(exclude_none=True, exclude={"preset"})
    options = _merge_options(**{**preset_params, **overrides})
    _validate_options(options)

    work_dir = personalization_storage.create_work_dir(artifact_id, "reprocess")
    try:
        reprocess_to_review(
            personalization_storage,
            artifact_id,
            input_path,
            work_dir,
            options,
        )
        _copy_options_json(work_dir, artifact_id)
        if body.preset:
            options_path = personalization_storage.path_for(artifact_id, "options.json")
            try:
                data = json.loads(options_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                data = {}
            data["preset"] = body.preset
            options_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Reprocess failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Reprocess failed: {exc}") from exc

    logger.info("fingerprint reprocess artifact=%s preset=%s", artifact_id, body.preset)
    return _build_review_response(artifact_id)


@app.post(
    "/fingerprint/{artifact_id}/reconvert",
    response_model=FingerprintReviewResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
)
async def reconvert_fingerprint_svg(
    artifact_id: str,
    body: FingerprintReconvertSvgRequest,
) -> FingerprintReviewResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    final_path = artifact_dir / "06_final_clean.png"
    if not final_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Artifact has no 06_final_clean.png. Process fingerprint first.",
        )

    options = _merge_options(
        turdsize=body.turdsize,
        opttolerance=body.opttolerance,
        outputSvg=True,
    )

    work_dir = personalization_storage.create_work_dir(artifact_id, "reconvert")
    try:
        shutil.copy2(final_path, work_dir / "06_final_clean.png")
        reconvert_to_review(personalization_storage, artifact_id, work_dir, options)
        _copy_options_json(work_dir, artifact_id)
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("SVG reconvert failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"SVG reconvert failed: {exc}",
        ) from exc

    logger.info("fingerprint reconvert artifact=%s", artifact_id)
    return _build_review_response(artifact_id)


@app.get(
    "/fingerprint/{artifact_id}/textures",
    response_model=FingerprintTextureResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["Fingerprint"],
)
async def get_fingerprint_textures(artifact_id: str) -> FingerprintTextureResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    if not _textures_exist_in_review(artifact_id):
        raise HTTPException(
            status_code=404,
            detail="Texture maps not found in REVIEW. Call POST /fingerprint/{id}/textures first.",
        )

    options_path = artifact_dir / "options.json"
    prev: Dict[str, Any] = {}
    if options_path.is_file():
        try:
            prev = json.loads(options_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = {}

    applied_options = prev.get("appliedTextureOptions")
    if isinstance(applied_options, dict):
        meta = _texture_metadata_from_options(
            prev,
            applied_preset=prev.get("appliedTexturePreset"),
            applied_options=applied_options,
        )
    else:
        meta = FingerprintTextureMetadata(
            appliedTexturePreset=prev.get("appliedTexturePreset"),
            appliedTextureOptions=AppliedTextureOptions(
                heightmapBlur=float(prev.get("heightmapBlur", settings.FINGERPRINT_HEIGHTMAP_BLUR)),
                normalStrength=float(prev.get("normalStrength", settings.FINGERPRINT_NORMAL_STRENGTH)),
                roughnessBase=int(prev.get("roughnessBase", settings.FINGERPRINT_ROUGHNESS_BASE)),
                roughnessRidge=int(prev.get("roughnessRidge", settings.FINGERPRINT_ROUGHNESS_RIDGE)),
                aoStrength=float(prev.get("aoStrength", settings.FINGERPRINT_AO_STRENGTH)),
            ),
        )

    return _texture_response(artifact_id, meta)


@app.post(
    "/fingerprint/{artifact_id}/textures",
    response_model=FingerprintTextureResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
)
async def regenerate_fingerprint_textures(
    artifact_id: str,
    body: FingerprintTextureOptions = FingerprintTextureOptions(),
) -> FingerprintTextureResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    final_path = artifact_dir / "06_final_clean.png"
    if not final_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Artifact has no 06_final_clean.png. Process fingerprint first.",
        )

    try:
        applied_preset, merged = resolve_texture_options(
            body.preset,
            body.model_dump(exclude_none=True, exclude={"preset"}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    work_dir = personalization_storage.create_work_dir(artifact_id, "textures")
    try:
        textures_to_review(
            personalization_storage,
            artifact_id,
            work_dir,
            blur_radius=float(merged["heightmapBlur"]),
            normal_strength=float(merged["normalStrength"]),
            roughness_base=int(merged["roughnessBase"]),
            roughness_ridge=int(merged["roughnessRidge"]),
            ao_strength=float(merged["aoStrength"]),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Texture regenerate failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Texture regenerate failed: {exc}",
        ) from exc

    options_path = personalization_storage.path_for(artifact_id, "options.json")
    prev: Dict[str, Any] = {}
    if options_path.is_file():
        try:
            prev = json.loads(options_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = {}

    applied_options = {
        "heightmapBlur": float(merged["heightmapBlur"]),
        "normalStrength": float(merged["normalStrength"]),
        "roughnessBase": int(merged["roughnessBase"]),
        "roughnessRidge": int(merged["roughnessRidge"]),
        "aoStrength": float(merged["aoStrength"]),
    }
    texture_meta = _texture_metadata_from_options(
        prev,
        applied_preset=applied_preset,
        applied_options=applied_options,
    )
    merged_options = {
        **prev,
        "generateTextures": True,
        "appliedTexturePreset": applied_preset,
        "appliedTextureOptions": applied_options,
        **applied_options,
    }
    options_path.write_text(json.dumps(merged_options, indent=2), encoding="utf-8")

    logger.info("fingerprint textures artifact=%s preset=%s", artifact_id, applied_preset)
    return _texture_response(artifact_id, texture_meta)


@app.post(
    "/fingerprint/{artifact_id}/publish-approved",
    response_model=PublishApprovedResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
    summary="Internal: copy REVIEW → APPROVED, delete REVIEW (NestJS approve)",
)
async def publish_fingerprint_approved(
    artifact_id: str,
    body: PublishApprovedRequest,
) -> PublishApprovedResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    try:
        result = publish_approved(
            personalization_storage,
            artifact_id,
            approved_by=body.approvedBy,
            approved_at=body.approvedAt,
            approval_note=body.approvalNote,
            copy_debug_files=body.copyDebugFiles,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("publish-approved failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"publish-approved failed: {exc}",
        ) from exc

    approved = result["approvedFiles"]
    return PublishApprovedResponse(
        artifactId=artifact_id,
        approvedFiles=ApprovedFilesBundle(
            viewerFiles=ViewerFiles(**approved["viewerFiles"]),
            productionFiles=ProductionFiles(**approved["productionFiles"]),
        ),
        manifestUrl=result["manifestUrl"],
    )


@app.get(
    "/fingerprint/{artifact_id}/approved-viewer-assets",
    response_model=ApprovedViewerAssetsResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["Fingerprint"],
    summary="Mobile: APPROVED viewer URLs only",
)
async def get_approved_viewer_assets(
    artifact_id: str,
) -> ApprovedViewerAssetsResponse:
    has_manifest = personalization_storage.approved_file_exists(
        artifact_id, "artifact_manifest.json"
    )
    required = [
        "fingerprint_overlay.png",
        "fingerprint_alpha.png",
        "fingerprint_heightmap.png",
        "fingerprint_normal.png",
        "fingerprint_roughness.png",
        "fingerprint_ao.png",
    ]
    has_files = all(
        personalization_storage.approved_file_exists(artifact_id, name)
        for name in required
    )

    if not has_manifest and not has_files:
        raise HTTPException(
            status_code=404,
            detail="Approved assets not found.",
        )

    manifest = personalization_storage.load_approved_manifest(artifact_id)
    status = manifest.get("status")
    if status not in {"ASSET_APPROVED", "PLACEMENT_CONFIRMED"}:
        status = (
            "PLACEMENT_CONFIRMED"
            if personalization_storage.approved_file_exists(
                artifact_id, "placement.json"
            )
            else "ASSET_APPROVED"
        )

    placement_raw = personalization_storage.load_approved_placement(artifact_id)
    if not placement_raw:
        placement_raw = {
            "offsetX": 0,
            "offsetY": 0,
            "scaleX": 1,
            "scaleY": 1,
            "rotation": 0,
            "flipX": False,
            "flipY": False,
            "opacity": 0.75,
        }

    viewer = personalization_storage.build_approved_viewer_response(artifact_id)
    return ApprovedViewerAssetsResponse(
        artifactId=artifact_id,
        status=status,
        stage="approved",
        viewerFiles=ViewerFiles(**viewer["viewerFiles"]),
        placement=PlacementTransform(**placement_raw),
    )


@app.post(
    "/fingerprint/{artifact_id}/confirm-placement",
    response_model=ConfirmPlacementResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
)
async def confirm_fingerprint_placement(
    artifact_id: str,
    body: ConfirmPlacementRequest,
) -> ConfirmPlacementResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    if not artifact_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Artifact not found: {artifact_id}")

    if not personalization_storage.approved_file_exists(
        artifact_id, "fingerprint_overlay.png"
    ):
        raise HTTPException(
            status_code=404,
            detail="Approved assets not found. Publish approved first.",
        )

    confirmed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "modelCode": body.modelCode,
        "surface": body.surface,
        "placement": body.placement.model_dump(),
        "confirmedBy": body.confirmedBy,
        "confirmedAt": confirmed_at,
    }

    try:
        result = save_placement(personalization_storage, artifact_id, payload)
    except Exception as exc:
        logger.exception("confirm-placement failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"confirm-placement failed: {exc}",
        ) from exc

    return ConfirmPlacementResponse(
        artifactId=artifact_id,
        placementUrl=result["placementUrl"],
        manifestUrl=result["manifestUrl"],
    )


settings.temp_dir_path.mkdir(parents=True, exist_ok=True)
