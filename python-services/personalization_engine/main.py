"""Personalization Engine — fingerprint REVIEW/APPROVED workflow."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from shared.nest_log import setup_logging

from .artifact_groups import (
    SUPPORTED_ARTIFACT_TYPES,
    TEXTURE_OUTPUT_FILES,
    TYPE_FINGERPRINT,
    TYPE_SOUNDWAVE,
)
from .config import settings
from .fingerprint_processor import (
    ProcessOptions,
    find_artifact_input,
    process_fingerprint_file,
)
from .placement import default_placement_dict, placement_from_raw
from .ffmpeg_util import AudioDecodeError, probe_ffmpeg
from .presets import (
    REPROCESS_PARAMETER_GUIDE,
    REPROCESS_PRESETS,
    SOUNDWAVE_PARAMETER_GUIDE,
    SOUNDWAVE_REPROCESS_PRESETS,
    default_soundwave_options_dict,
    resolve_preset,
    resolve_soundwave_preset,
    resolve_texture_options,
    texture_presets_options_map,
)
from .review_workflow import (
    cleanup_review,
    finalize_process_to_review,
    publish_approved,
    reprocess_to_review,
    textures_to_review,
)
from .schemas import (
    AppliedTextureOptions,
    ApprovedFilesBundle,
    ApprovedViewerAssetsResponse,
    CleanupReviewRequest,
    CleanupReviewResponse,
    DebugFiles,
    ErrorResponse,
    FingerprintMetadata,
    FingerprintQuality,
    FingerprintReviewResponse,
    FFmpegHealthInfo,
    FFmpegHealthResponse,
    FingerprintTextureFiles,
    FingerprintTextureMetadata,
    FingerprintTextureResponse,
    FingerprintTuneOptions,
    HealthResponse,
    PlacementTransform,
    PresetListResponse,
    ProductionFiles,
    PublishApprovedRequest,
    PublishApprovedResponse,
    ReviewFilesBundle,
    SharedTexturePresetsResponse,
    SoundwaveApprovedFilesBundle,
    SoundwaveDebugFiles,
    SoundwaveProductionFiles,
    SoundwavePublishApprovedResponse,
    SoundwaveReviewFilesBundle,
    SoundwaveReviewResponse,
    SoundwaveTuneOptions,
    StorageHealthResponse,
    StoragePathsInfo,
    TexturePresetOptions,
    TexturePresetRequest,
    ViewerFiles,
)
from .soundwave_processor import MAX_SEGMENT_MS, SOUNDWAVE_STYLES, SoundwaveOptions
from .soundwave_workflow import (
    finalize_soundwave_process_to_review,
    publish_soundwave_approved,
    reprocess_soundwave_to_review,
    textures_soundwave_to_review,
)
from .storage_client import personalization_storage

logger = setup_logging("PERSONALIZATION")

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
}

ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/flac",
    "application/octet-stream",
}

APP_DESCRIPTION = """
## Storage model

**MinIO is the source of truth** for all public artifact files:

```text
personalization/{stage}/{artifactType}/{artifactId}/{filename}
```

| stage | artifactType | artifactId |
|-------|--------------|------------|
| `review` \\| `approved` | `fingerprint` \\| `soundwave` | `fp_…` \\| `sw_…` |

Local `.tmp/personalization/{artifactId}/.work/{operation}_*/` is **temporary only**.
Fingerprint and soundwave use the **same** pattern:

1. Process in `.work`
2. Upload/overwrite MinIO REVIEW
3. Delete `.work`
4. On failure → previous REVIEW/APPROVED kept

PostgreSQL / NestJS owns status, user, order, role. This service does **not**.

---

## Fingerprint — staff REVIEW → publish APPROVED → mobile

| Step | Endpoint | MinIO |
|------|----------|-------|
| 1 Upload | `POST /fingerprint/process` | → `review/fingerprint/{fp_…}/` |
| 2 Tune | `POST …/reprocess` \\| `reprocess-texture` | overwrite REVIEW only |
| 3 Approve | `POST …/publish-approved` | copy REVIEW → APPROVED |
| 4 Cleanup | `POST …/cleanup-review` | delete REVIEW (after NestJS DB ok) |
| 5 Mobile | `GET …/approved-viewer-assets` | APPROVED URLs only |

---

## Soundwave — same REVIEW / APPROVED pattern

| Step | Endpoint | MinIO |
|------|----------|-------|
| 1 Upload | `POST /soundwave/process` | → `review/soundwave/{sw_…}/` (segment ≤ 3s) |
| 2 Tune | `POST …/reprocess` (+ presets) \\| `reprocess-texture` | overwrite REVIEW only |
| 3 Approve | `POST …/publish-approved` | copy REVIEW → APPROVED |
| 4 Cleanup | `POST …/cleanup-review` | delete REVIEW (after NestJS DB ok) |
| 5 Mobile | `GET …/approved-viewer-assets` | APPROVED URLs only |

## Local tmp (.work) — fingerprint & soundwave giống nhau

```text
.tmp/personalization/{artifactId}/.work/{operation}_{hex}/
```

1. Ghi input + chạy pipeline trong `.work`
2. Thành công → upload/overwrite MinIO **REVIEW**
3. Xóa `.work`
4. Fail → bản REVIEW/APPROVED cũ **không** mất

Không dùng local làm storage chính.
"""

OPENAPI_TAGS = [
    {
        "name": "Health",
        "description": (
            "Liveness của personalization_engine + probe FFmpeg (`GET /ffmpeg/health`)."
        ),
    },
    {
        "name": "Storage",
        "description": (
            "MinIO bucket/prefix health + FFmpeg probe. "
            "Paths: `personalization/{review|approved}/{fingerprint|soundwave}/{artifactId}/…`"
        ),
    },
    {
        "name": "Texture",
        "description": (
            "Shared texture presets for fingerprint + soundwave. "
            "`GET /texture-presets` — dùng chung cho `reprocess-texture`."
        ),
    },
    {
        "name": "Fingerprint",
        "description": (
            "Staff fingerprint pipeline. "
            "Process/reprocess/reprocess-texture → **REVIEW** only. "
            "publish-approved → **APPROVED**. "
            "Mobile chỉ dùng approved-viewer-assets. "
            "Local xử lý trong `.tmp/…/.work/`, không phải storage chính."
        ),
    },
    {
        "name": "Soundwave",
        "description": (
            "Staff soundwave pipeline (audio ≤ 3s segment). "
            "Process dùng preset `standard`; tinh chỉnh qua reprocess + "
            "`GET /soundwave/presets`. "
            "Compressed audio cần FFmpeg (system binary, không pip). "
            "publish-approved → **APPROVED**. "
            "Mobile dùng approved-viewer-assets. "
            "Local xử lý trong `.tmp/…/.work/`, giống fingerprint."
        ),
    },
]

app = FastAPI(
    title="BIORING Personalization Engine",
    description=APP_DESCRIPTION,
    version="0.9.2",
    openapi_tags=OPENAPI_TAGS,
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


def _soundwave_options_from_dict(
    opts: Dict[str, Any],
    *,
    segment_start_ms: int,
    segment_duration_ms: int,
    preset: Optional[str] = None,
) -> SoundwaveOptions:
    style = str(opts.get("style") or "line")
    if style not in SOUNDWAVE_STYLES:
        allowed = ", ".join(SOUNDWAVE_STYLES)
        raise ValueError(f"style must be one of: {allowed}")
    return SoundwaveOptions(
        segment_start_ms=max(0, int(segment_start_ms)),
        segment_duration_ms=min(MAX_SEGMENT_MS, max(1, int(segment_duration_ms))),
        style=style,  # type: ignore[arg-type]
        sample_points=int(opts.get("samplePoints", 512)),
        normalize=bool(opts.get("normalize", True)),
        amplitude_scale=float(opts.get("amplitudeScale", 1.0)),
        smoothing=float(opts.get("smoothing", 0.0)),
        preset=preset,
    )


def _default_soundwave_options(
    *,
    segment_start_ms: int = 0,
    segment_duration_ms: int = 3000,
) -> SoundwaveOptions:
    return _soundwave_options_from_dict(
        default_soundwave_options_dict(),
        segment_start_ms=segment_start_ms,
        segment_duration_ms=segment_duration_ms,
        preset="standard",
    )


def _load_previous_soundwave_segment(artifact_id: str) -> tuple[int, int]:
    """Return (segmentStartMs, segmentDurationMs) from REVIEW if available."""
    try:
        personalization_storage.ensure_local_from_review(
            artifact_id, "waveform_points.json", artifact_type=TYPE_SOUNDWAVE
        )
        path = personalization_storage.path_for(artifact_id, "waveform_points.json")
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            start = int(data.get("segmentStartMs", 0))
            duration = int(data.get("segmentDurationMs", MAX_SEGMENT_MS))
            return max(0, start), min(MAX_SEGMENT_MS, max(1, duration))
    except Exception:
        pass
    return 0, MAX_SEGMENT_MS


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


def _manifest_review_url(
    artifact_id: str, *, artifact_type: str = TYPE_FINGERPRINT
) -> str:
    return personalization_storage.build_public_url(
        personalization_storage.build_review_object_key(
            artifact_id,
            "artifact_manifest.json",
            artifact_type=artifact_type,
        )
    )


def _build_review_response(
    artifact_id: str,
    *,
    quality: Optional[Dict[str, Any]] = None,
    metadata: Optional[FingerprintMetadata] = None,
) -> FingerprintReviewResponse:
    files = personalization_storage.build_review_files_response(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )
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
            personalization_storage.build_review_object_key(
                artifact_id, name, artifact_type=TYPE_FINGERPRINT
            )
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
        personalization_storage.review_file_exists(
            artifact_id, name, artifact_type=TYPE_FINGERPRINT
        )
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


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health check",
    description="Trả `status=ok` nếu process personalization_engine đang chạy.",
)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="personalization_engine")


@app.get(
    "/ffmpeg/health",
    response_model=FFmpegHealthResponse,
    tags=["Health"],
    summary="Kiểm tra FFmpeg binary",
    description=(
        "Chạy `ffmpeg -version` với `FFMPEG_BINARY` (name trên PATH hoặc absolute path). "
        "Cần cho soundwave mp3/m4a/aac/ogg; WAV không bắt buộc. "
        "`status=ok` khi binary available."
    ),
)
def ffmpeg_health() -> FFmpegHealthResponse:
    info = probe_ffmpeg(settings.FFMPEG_BINARY)
    return FFmpegHealthResponse(
        status="ok" if info.get("available") else "error",
        available=bool(info.get("available")),
        binary=str(info.get("binary") or settings.FFMPEG_BINARY),
        version=info.get("version"),
        resolvedPath=info.get("resolvedPath"),
        error=info.get("error"),
    )


@app.get(
    "/storage/health",
    response_model=StorageHealthResponse,
    tags=["Storage"],
    summary="Kiểm tra MinIO + path templates",
    description=(
        "Đảm bảo bucket `bioring-personalization` reachable và public-read. "
        "Response gồm path templates fingerprint/soundwave REVIEW & APPROVED."
    ),
)
def storage_health() -> StorageHealthResponse:
    prefix = settings.PERSONALIZATION_MINIO_PREFIX.strip("/")
    ok, message = personalization_storage.check_minio_health()
    ffmpeg = FFmpegHealthInfo(**probe_ffmpeg(settings.FFMPEG_BINARY))
    paths = StoragePathsInfo(
        fingerprintReview=f"{prefix}/review/fingerprint/{{artifactId}}/...",
        fingerprintApproved=f"{prefix}/approved/fingerprint/{{artifactId}}/...",
        soundwaveReview=f"{prefix}/review/soundwave/{{artifactId}}/...",
        soundwaveApproved=f"{prefix}/approved/soundwave/{{artifactId}}/...",
    )
    common = dict(
        bucket=settings.PERSONALIZATION_MINIO_BUCKET,
        prefix=prefix,
        paths=paths,
        supportedTypes=list(SUPPORTED_ARTIFACT_TYPES),
        endpoint=settings.MINIO_ENDPOINT,
        publicEndpoint=settings.MINIO_PUBLIC_ENDPOINT,
        ffmpeg=ffmpeg,
        reviewPrefixExample=paths.fingerprintReview,
        approvedPrefixExample=paths.fingerprintApproved,
    )
    if ok:
        return StorageHealthResponse(status="ok", **common)
    return StorageHealthResponse(status="error", message=message, **common)


@app.get(
    "/texture-presets",
    response_model=SharedTexturePresetsResponse,
    tags=["Texture"],
    summary="Shared texture presets (fingerprint + soundwave)",
    description=(
        "Preset height/normal/roughness/AO dùng chung cho "
        "`POST /fingerprint/{id}/reprocess-texture` và "
        "`POST /soundwave/{id}/reprocess-texture`."
    ),
)
def list_shared_texture_presets() -> SharedTexturePresetsResponse:
    raw = texture_presets_options_map()
    return SharedTexturePresetsResponse(
        presets={code: TexturePresetOptions(**opts) for code, opts in raw.items()},
        supportedTypes=["fingerprint", "soundwave"],
    )


@app.get(
    "/fingerprint/presets",
    response_model=PresetListResponse,
    tags=["Fingerprint"],
    summary="Danh sách preset reprocess",
    description="Preset OpenCV/potrace cho `POST /fingerprint/{id}/reprocess` + parameterGuide.",
)
def list_reprocess_presets() -> PresetListResponse:
    return PresetListResponse(
        presets=REPROCESS_PRESETS,
        parameterGuide=REPROCESS_PARAMETER_GUIDE,
    )


@app.post(
    "/fingerprint/process",
    response_model=FingerprintReviewResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["Fingerprint"],
    summary="Upload ảnh → .work pipeline → REVIEW MinIO",
    description=(
        "Tạo `fp_{uuid}`. Lưu upload + chạy OpenCV/potrace/textures trong "
        "`.tmp/personalization/{id}/.work/process_*/`. "
        "Thành công mới sync lên `personalization/review/fingerprint/{id}/` rồi xóa `.work`. "
        "Không tạo APPROVED. Không tạo file old/v2."
    ),
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

    artifact_id = personalization_storage.create_artifact_id(TYPE_FINGERPRINT)
    work_dir = personalization_storage.create_work_dir(artifact_id, "process")

    suffix = Path(file.filename or "input.png").suffix.lower() or ".png"
    if suffix not in {".png", ".jpg", ".jpeg"}:
        suffix = ".png" if "png" in content_type else ".jpg"

    raw_path = work_dir / f"upload{suffix}"
    try:
        with raw_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        await file.close()

    input_path = work_dir / "input.png"
    if raw_path.name != "input.png":
        shutil.move(str(raw_path), str(input_path))
    else:
        input_path = raw_path

    try:
        result = _run_process(input_path, work_dir, options)
        options_path = work_dir / "options.json"
        if options_path.is_file():
            try:
                data = json.loads(options_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                data = {}
            data["preset"] = "standard"
            options_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            result["metadata"]["preset"] = "standard"

        finalize_process_to_review(
            personalization_storage,
            artifact_id,
            work_dir,
            last_operation="process",
            extra_manifest={"preset": "standard"},
        )
    except HTTPException:
        personalization_storage.cleanup_work_dir(work_dir)
        raise
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        logger.exception("Fingerprint process failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process / upload REVIEW: {exc}",
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
    summary="Reprocess OpenCV+SVG → overwrite REVIEW (.work)",
    description=(
        "Không tạo artifactId mới. Hydrate `input.png` từ REVIEW nếu thiếu local. "
        "Pipeline chạy trong `.work/reprocess_*`, thành công mới overwrite "
        "`personalization/review/fingerprint/{id}/`. Không đụng APPROVED."
    ),
)
async def reprocess_fingerprint(
    artifact_id: str,
    body: FingerprintTuneOptions,
) -> FingerprintReviewResponse:
    artifact_dir = personalization_storage.build_artifact_dir(artifact_id)
    personalization_storage.ensure_local_from_review(
        artifact_id, "input.png", artifact_type=TYPE_FINGERPRINT
    )

    input_path = find_artifact_input(artifact_dir)
    if input_path is None:
        raise HTTPException(
            status_code=404,
            detail="Artifact has no input image in REVIEW (input.png). Cannot reprocess.",
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
            preset=body.preset,
        )
    except HTTPException:
        personalization_storage.cleanup_work_dir(work_dir)
        raise
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        logger.exception("Reprocess failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Reprocess failed: {exc}") from exc

    logger.info("fingerprint reprocess artifact=%s preset=%s", artifact_id, body.preset)
    return _build_review_response(artifact_id)


@app.post(
    "/fingerprint/{artifact_id}/reprocess-texture",
    response_model=FingerprintTextureResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
    summary="Regenerate textures → overwrite REVIEW (.work)",
    description=(
        "Tạo lại texture maps từ `06_final_clean.png` trong `.work/textures_*`, "
        "rồi overwrite REVIEW. Body dùng schema chung `TexturePresetRequest` "
        "(xem `GET /texture-presets`). Không đụng APPROVED."
    ),
)
async def reprocess_fingerprint_texture(
    artifact_id: str,
    body: TexturePresetRequest = TexturePresetRequest(),
) -> FingerprintTextureResponse:
    personalization_storage.ensure_local_from_review(
        artifact_id, "06_final_clean.png", artifact_type=TYPE_FINGERPRINT
    )
    final_path = personalization_storage.path_for(artifact_id, "06_final_clean.png")
    if not final_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Artifact has no 06_final_clean.png in REVIEW. Process fingerprint first.",
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
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        logger.exception("Texture reprocess failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Texture reprocess failed: {exc}",
        ) from exc

    personalization_storage.ensure_local_from_review(
        artifact_id, "options.json", artifact_type=TYPE_FINGERPRINT
    )
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
    try:
        personalization_storage.upload_review_file(
            options_path, artifact_id, "options.json", artifact_type=TYPE_FINGERPRINT
        )
    except Exception:
        pass

    logger.info(
        "fingerprint reprocess-texture artifact=%s preset=%s",
        artifact_id,
        applied_preset,
    )
    return _texture_response(artifact_id, texture_meta)


@app.get(
    "/fingerprint/{artifact_id}/textures",
    response_model=FingerprintTextureResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["Fingerprint"],
    summary="GET texture maps từ REVIEW",
    description="Trả URL MinIO REVIEW của height/normal/roughness/AO/overlay/alpha. Không đọc APPROVED.",
)
async def get_fingerprint_textures(artifact_id: str) -> FingerprintTextureResponse:
    if not _textures_exist_in_review(artifact_id):
        raise HTTPException(
            status_code=404,
            detail="Texture maps not found in REVIEW. Call POST /fingerprint/{id}/reprocess-texture first.",
        )

    personalization_storage.ensure_local_from_review(
        artifact_id, "options.json", artifact_type=TYPE_FINGERPRINT
    )
    options_path = personalization_storage.path_for(artifact_id, "options.json")
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
    "/fingerprint/{artifact_id}/publish-approved",
    response_model=PublishApprovedResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
    summary="Internal: copy REVIEW → APPROVED (giữ REVIEW)",
    description=(
        "Không xử lý lại ảnh. Copy file cần thiết từ "
        "`personalization/review/fingerprint/{id}/` sang "
        "`personalization/approved/fingerprint/{id}/`. "
        "Không xóa REVIEW — gọi `POST …/cleanup-review` sau khi NestJS update DB thành công. "
        "Response chỉ trả `approvedFiles`."
    ),
)
async def publish_fingerprint_approved(
    artifact_id: str,
    body: PublishApprovedRequest,
) -> PublishApprovedResponse:
    # Allow publish even if local .tmp was cleaned — MinIO REVIEW is source.
    if not personalization_storage.review_file_exists(
        artifact_id, "fingerprint_overlay.png", artifact_type=TYPE_FINGERPRINT
    ):
        raise HTTPException(
            status_code=404,
            detail=f"Review assets not found: {artifact_id}",
        )

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
    description=(
        "Chỉ đọc `personalization/approved/fingerprint/{id}/`. "
        "Không trả review URL / debugFiles. 404 nếu chưa publish-approved."
    ),
)
async def get_approved_viewer_assets(
    artifact_id: str,
) -> ApprovedViewerAssetsResponse:
    has_manifest = personalization_storage.approved_file_exists(
        artifact_id, "artifact_manifest.json", artifact_type=TYPE_FINGERPRINT
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
        personalization_storage.approved_file_exists(
            artifact_id, name, artifact_type=TYPE_FINGERPRINT
        )
        for name in required
    )

    if not has_manifest and not has_files:
        raise HTTPException(
            status_code=404,
            detail="Approved assets not found.",
        )

    manifest = personalization_storage.load_approved_manifest(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )
    status = manifest.get("status")
    if status not in {"ASSET_APPROVED", "PLACEMENT_CONFIRMED"}:
        status = (
            "PLACEMENT_CONFIRMED"
            if personalization_storage.approved_file_exists(
                artifact_id, "placement.json", artifact_type=TYPE_FINGERPRINT
            )
            else "ASSET_APPROVED"
        )

    placement_raw = personalization_storage.load_approved_placement(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )
    placement = placement_from_raw(placement_raw or default_placement_dict())

    viewer = personalization_storage.build_approved_viewer_response(
        artifact_id, artifact_type=TYPE_FINGERPRINT
    )
    return ApprovedViewerAssetsResponse(
        artifactId=artifact_id,
        type=TYPE_FINGERPRINT,
        status=status,
        stage="approved",
        viewerFiles=ViewerFiles(**viewer["viewerFiles"]),
        placement=placement,
    )


@app.post(
    "/fingerprint/{artifact_id}/cleanup-review",
    response_model=CleanupReviewResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    tags=["Fingerprint"],
    summary="Internal: xóa REVIEW sau khi APPROVED + DB ok",
    description=(
        "Xóa `personalization/review/fingerprint/{id}/` **chỉ khi** APPROVED đã tồn tại. "
        "Đồng thời xóa local `.tmp/personalization/{id}/` (best-effort). "
        "Không xóa APPROVED. Dùng sau NestJS approve DB thành công."
    ),
)
async def cleanup_fingerprint_review(
    artifact_id: str,
    body: CleanupReviewRequest,
) -> CleanupReviewResponse:
    try:
        result = cleanup_review(
            personalization_storage,
            artifact_id,
            artifact_type=TYPE_FINGERPRINT,
            reason=body.reason,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CleanupReviewResponse(
        artifactId=artifact_id,
        deletedObjects=result["deletedObjects"],
        reason=result["reason"],
        localTmpDeleted=bool(result.get("localTmpDeleted", True)),
    )


# ---------------------------------------------------------------------------
# Soundwave
# ---------------------------------------------------------------------------


def _build_soundwave_review_response(
    artifact_id: str,
    *,
    metadata: Optional[dict] = None,
) -> SoundwaveReviewResponse:
    files = personalization_storage.build_review_files_response(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    debug = files.get("debugFiles") or {}
    return SoundwaveReviewResponse(
        artifactId=artifact_id,
        status="READY_FOR_REVIEW",
        stage="review",
        type=TYPE_SOUNDWAVE,
        reviewFiles=SoundwaveReviewFilesBundle(
            viewerFiles=ViewerFiles(**files["viewerFiles"]),
            productionFiles=SoundwaveProductionFiles(**files["productionFiles"]),
            debugFiles=SoundwaveDebugFiles(**debug) if debug else None,
        ),
        manifestUrl=_manifest_review_url(artifact_id, artifact_type=TYPE_SOUNDWAVE),
        metadata=metadata,
    )


@app.get(
    "/soundwave/presets",
    response_model=PresetListResponse,
    tags=["Soundwave"],
    summary="Danh sách preset reprocess soundwave",
    description=(
        "Preset waveform cho `POST /soundwave/{id}/reprocess` + parameterGuide. "
        "`POST /soundwave/process` luôn dùng preset `standard`."
    ),
)
def list_soundwave_presets() -> PresetListResponse:
    return PresetListResponse(
        presets=SOUNDWAVE_REPROCESS_PRESETS,
        parameterGuide=SOUNDWAVE_PARAMETER_GUIDE,
    )


@app.post(
    "/soundwave/process",
    response_model=SoundwaveReviewResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Upload audio → .work pipeline → REVIEW MinIO",
    description=(
        "Tạo `sw_{uuid}`. Dùng preset **`standard`** (giống fingerprint process). "
        "Chỉ cần chọn đoạn audio (`segmentStartMs` / `segmentDurationMs` ≤ 3s). "
        "Tinh chỉnh style/biên độ sau qua `POST …/reprocess` + `GET /soundwave/presets`. "
        "Thành công sync `personalization/review/soundwave/{id}/` rồi xóa `.work`. "
        "Không tạo APPROVED."
    ),
)
async def process_soundwave(
    file: UploadFile = File(..., description="Audio file (wav/mp3/…)"),
    segmentStartMs: int = Form(0, description="Vị trí bắt đầu đoạn cắt (ms)"),
    segmentDurationMs: int = Form(
        3000, description=f"Độ dài đoạn cắt (ms), tối đa {MAX_SEGMENT_MS}"
    ),
) -> SoundwaveReviewResponse:
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_AUDIO_CONTENT_TYPES:
        if not content_type.startswith("audio/") and content_type != "application/octet-stream":
            raise HTTPException(
                status_code=400,
                detail="Only audio uploads are allowed.",
            )

    if segmentDurationMs > MAX_SEGMENT_MS:
        raise HTTPException(
            status_code=400,
            detail=f"segmentDurationMs max is {MAX_SEGMENT_MS}",
        )

    options = _default_soundwave_options(
        segment_start_ms=segmentStartMs,
        segment_duration_ms=segmentDurationMs,
    )

    artifact_id = personalization_storage.create_artifact_id(TYPE_SOUNDWAVE)
    work_dir = personalization_storage.create_work_dir(artifact_id, "process")
    suffix = Path(file.filename or "audio.wav").suffix.lower() or ".wav"
    input_path = work_dir / f"upload{suffix}"
    try:
        with input_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        await file.close()

    try:
        result = finalize_soundwave_process_to_review(
            personalization_storage,
            artifact_id,
            input_path,
            work_dir,
            options,
            original_name=file.filename,
        )
    except AudioDecodeError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        logger.exception("soundwave process failed: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Soundwave processing failed: {exc}"
        ) from exc

    return _build_soundwave_review_response(
        artifact_id, metadata=result.get("metadata")
    )


@app.post(
    "/soundwave/{artifact_id}/reprocess",
    response_model=SoundwaveReviewResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Reprocess từ audio_original → overwrite REVIEW (.work)",
    description=(
        "Không tạo artifactId mới. Chọn `preset` (GET /soundwave/presets) rồi "
        "override từng field nếu cần. Segment bỏ trống → giữ đoạn REVIEW trước đó. "
        "Chạy lại trong `.work/reprocess_*` rồi overwrite REVIEW. Không đụng APPROVED."
    ),
)
async def reprocess_soundwave(
    artifact_id: str,
    body: SoundwaveTuneOptions = SoundwaveTuneOptions(),
) -> SoundwaveReviewResponse:
    prev_start, prev_duration = _load_previous_soundwave_segment(artifact_id)
    try:
        merged = {
            **default_soundwave_options_dict(),
            **resolve_soundwave_preset(body.preset),
            **body.model_dump(
                exclude_none=True,
                exclude={"preset", "segmentStartMs", "segmentDurationMs"},
            ),
        }
        options = _soundwave_options_from_dict(
            merged,
            segment_start_ms=(
                body.segmentStartMs if body.segmentStartMs is not None else prev_start
            ),
            segment_duration_ms=(
                body.segmentDurationMs
                if body.segmentDurationMs is not None
                else prev_duration
            ),
            preset=body.preset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    work_dir = personalization_storage.create_work_dir(artifact_id, "reprocess")
    try:
        result = reprocess_soundwave_to_review(
            personalization_storage, artifact_id, work_dir, options
        )
    except AudioDecodeError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        logger.exception("soundwave reprocess failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "soundwave reprocess artifact=%s preset=%s",
        artifact_id,
        body.preset,
    )
    return _build_soundwave_review_response(
        artifact_id, metadata=result.get("metadata")
    )


@app.post(
    "/soundwave/{artifact_id}/reprocess-texture",
    response_model=SoundwaveReviewResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Regenerate soundwave textures → REVIEW (.work)",
    description=(
        "Tạo lại texture maps từ `soundwave_preview.png` trong `.work/textures_*`, "
        "overwrite REVIEW. Body dùng schema chung `TexturePresetRequest` "
        "(xem `GET /texture-presets`). Không đụng APPROVED."
    ),
)
async def reprocess_soundwave_texture(
    artifact_id: str,
    body: TexturePresetRequest = TexturePresetRequest(),
) -> SoundwaveReviewResponse:
    try:
        applied_preset, merged = resolve_texture_options(
            body.preset,
            body.model_dump(exclude_none=True, exclude={"preset"}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    work_dir = personalization_storage.create_work_dir(artifact_id, "textures")
    try:
        textures_soundwave_to_review(
            personalization_storage,
            artifact_id,
            work_dir,
            blur_radius=float(merged["heightmapBlur"]),
            normal_strength=float(merged["normalStrength"]),
            roughness_base=int(merged["roughnessBase"]),
            roughness_ridge=int(merged["roughnessRidge"]),
            ao_strength=float(merged["aoStrength"]),
        )
    except FileNotFoundError as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        personalization_storage.cleanup_work_dir(work_dir)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "soundwave reprocess-texture artifact=%s preset=%s",
        artifact_id,
        applied_preset,
    )
    return _build_soundwave_review_response(artifact_id)


@app.post(
    "/soundwave/{artifact_id}/publish-approved",
    response_model=SoundwavePublishApprovedResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Internal: copy REVIEW → APPROVED (giữ REVIEW)",
    description=(
        "Copy từ `personalization/review/soundwave/{id}/` sang "
        "`…/approved/soundwave/{id}/`. "
        "Không xóa REVIEW — gọi `POST …/cleanup-review` sau khi NestJS update DB thành công. "
        "Response chỉ `approvedFiles`."
    ),
)
async def publish_soundwave(
    artifact_id: str,
    body: PublishApprovedRequest,
) -> SoundwavePublishApprovedResponse:
    if not personalization_storage.review_file_exists(
        artifact_id, "soundwave_overlay.png", artifact_type=TYPE_SOUNDWAVE
    ):
        raise HTTPException(
            status_code=404, detail=f"Review assets not found: {artifact_id}"
        )
    try:
        result = publish_soundwave_approved(
            personalization_storage,
            artifact_id,
            approved_by=body.approvedBy,
            approved_at=body.approvedAt,
            approval_note=body.approvalNote,
            copy_debug_files=body.copyDebugFiles,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    approved = result["approvedFiles"]
    return SoundwavePublishApprovedResponse(
        artifactId=artifact_id,
        approvedFiles=SoundwaveApprovedFilesBundle(
            viewerFiles=ViewerFiles(**approved["viewerFiles"]),
            productionFiles=SoundwaveProductionFiles(**approved["productionFiles"]),
        ),
        manifestUrl=result["manifestUrl"],
    )


@app.get(
    "/soundwave/{artifact_id}/approved-viewer-assets",
    response_model=ApprovedViewerAssetsResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Mobile: APPROVED viewer URLs + audio playback",
    description=(
        "Chỉ đọc `personalization/approved/soundwave/{id}/`. "
        "Trả viewer maps + `audioOriginal` (raw upload) + `audioSegment` (clip ≤3s) "
        "để nghe trên memory card. Không trả REVIEW/debug."
    ),
)
async def get_soundwave_approved_viewer_assets(
    artifact_id: str,
) -> ApprovedViewerAssetsResponse:
    required = [
        "soundwave_overlay.png",
        "soundwave_alpha.png",
        "soundwave_heightmap.png",
        "soundwave_normal.png",
        "soundwave_roughness.png",
        "soundwave_ao.png",
    ]
    has_files = all(
        personalization_storage.approved_file_exists(
            artifact_id, name, artifact_type=TYPE_SOUNDWAVE
        )
        for name in required
    )
    if not has_files:
        raise HTTPException(status_code=404, detail="Approved assets not found.")

    manifest = personalization_storage.load_approved_manifest(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    status = manifest.get("status") or "ASSET_APPROVED"
    placement_raw = personalization_storage.load_approved_placement(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    placement = placement_from_raw(placement_raw or default_placement_dict())
    viewer = personalization_storage.build_approved_viewer_response(
        artifact_id, artifact_type=TYPE_SOUNDWAVE
    )
    return ApprovedViewerAssetsResponse(
        artifactId=artifact_id,
        type=TYPE_SOUNDWAVE,
        status=status,
        stage="approved",
        viewerFiles=ViewerFiles(**viewer["viewerFiles"]),
        placement=placement,
        audioOriginal=viewer.get("audioOriginal"),
        audioSegment=viewer.get("audioSegment"),
    )


@app.post(
    "/soundwave/{artifact_id}/cleanup-review",
    response_model=CleanupReviewResponse,
    responses={400: {"model": ErrorResponse}},
    tags=["Soundwave"],
    summary="Internal: xóa REVIEW sau khi APPROVED + DB ok",
    description=(
        "Xóa `personalization/review/soundwave/{id}/` **chỉ khi** APPROVED đã tồn tại. "
        "Đồng thời xóa local `.tmp/personalization/{id}/` (best-effort). "
        "Không xóa APPROVED. Dùng sau NestJS approve DB thành công."
    ),
)
async def cleanup_soundwave_review(
    artifact_id: str,
    body: CleanupReviewRequest,
) -> CleanupReviewResponse:
    try:
        result = cleanup_review(
            personalization_storage,
            artifact_id,
            artifact_type=TYPE_SOUNDWAVE,
            reason=body.reason,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CleanupReviewResponse(
        artifactId=artifact_id,
        deletedObjects=result["deletedObjects"],
        reason=result["reason"],
        localTmpDeleted=bool(result.get("localTmpDeleted", True)),
    )


settings.temp_dir_path.mkdir(parents=True, exist_ok=True)
