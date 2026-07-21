"""Pydantic schemas for personalization_engine API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class FingerprintQuality(BaseModel):
    passed: bool
    score: float
    message: str


class FingerprintFiles(BaseModel):
    grayPng: Optional[str] = None
    enhancedPng: Optional[str] = None
    binaryPng: Optional[str] = None
    cleanedPng: Optional[str] = None
    mainRegionPng: Optional[str] = None
    finalPng: str
    pbm: Optional[str] = None
    svg: Optional[str] = None
    heightmap: Optional[str] = None
    normalMap: Optional[str] = None
    roughnessMap: Optional[str] = None
    aoMap: Optional[str] = None


class FingerprintMetadata(BaseModel):
    """Params đã áp dụng (chỉ các knobs public) + kích thước output."""

    width: int
    height: int
    minArea: int = Field(
        ...,
        description="Lọc blob nhỏ trên binary. Cao → xóa nhiễu nhưng dễ mất đoạn vân mỏng → SVG đứt.",
    )
    adaptiveC: int = Field(
        ...,
        description="Độ ‘gắt’ adaptive threshold. Thấp (3–5) → vân dày/liền hơn; cao → vân mỏng/đứt trước khi potrace.",
    )
    erodeSize: int = Field(
        ...,
        description="Mặt nạ vùng vân chính. Cao → cắt mép ngoài; thấp (8–12) giữ đường viền.",
    )
    applyMorphology: bool = Field(
        ...,
        description="Open/close morphology. true làm sạch nhiễu nhưng dễ làm đứt nét mỏng → SVG manh mún.",
    )
    turdsize: int = Field(
        ...,
        description="Potrace: bỏ path nhỏ hơn N px. Cao (12+) → SVG mất nhiều đoạn; thấp (2–5) giữ chi tiết.",
    )
    opttolerance: float = Field(
        ...,
        description="Potrace: mức đơn giản hóa đường cong. Cao → SVG mượt hơn nhưng mất chi tiết; thấp (0.05–0.08) giữ nét.",
    )
    outputSvg: bool = True
    preset: Optional[str] = None
    generateTextures: bool = False
    heightmapBlur: Optional[float] = None
    normalStrength: Optional[float] = None
    roughnessBase: Optional[int] = None
    roughnessRidge: Optional[int] = None
    aoStrength: Optional[float] = None
    engraveDepth: Optional[float] = None


class FingerprintProcessResponse(BaseModel):
    artifactId: str
    quality: FingerprintQuality
    files: FingerprintFiles
    metadata: FingerprintMetadata


class ViewerFiles(BaseModel):
    overlayPng: str
    alphaMap: str
    heightmap: str
    normalMap: str
    roughnessMap: str
    aoMap: str


class ProductionFiles(BaseModel):
    svg: str


class DebugFiles(BaseModel):
    inputPng: str
    finalCleanPng: str


class ReviewFilesBundle(BaseModel):
    viewerFiles: ViewerFiles
    productionFiles: ProductionFiles
    debugFiles: DebugFiles


class ApprovedFilesBundle(BaseModel):
    viewerFiles: ViewerFiles
    productionFiles: ProductionFiles


class FingerprintReviewResponse(BaseModel):
    artifactId: str
    status: str
    stage: str
    quality: Optional[FingerprintQuality] = None
    reviewFiles: ReviewFilesBundle
    manifestUrl: str
    metadata: Optional[FingerprintMetadata] = None


class PublishApprovedRequest(BaseModel):
    approvedBy: str
    approvedAt: str
    approvalNote: Optional[str] = None
    copyDebugFiles: bool = False


class PublishApprovedResponse(BaseModel):
    artifactId: str
    status: str = "ASSET_APPROVED"
    stage: str = "approved"
    approvedFiles: ApprovedFilesBundle
    manifestUrl: str


class PlacementTransform(BaseModel):
    offsetX: float = Field(default=0, ge=-1, le=1)
    offsetY: float = Field(default=0, ge=-1, le=1)
    scaleX: float = Field(default=1, ge=0.2, le=5)
    scaleY: float = Field(default=1, ge=0.2, le=5)
    rotation: float = Field(default=0, ge=-180, le=180)
    flipX: bool = False
    flipY: bool = False
    opacity: float = Field(default=0.75, ge=0, le=1)


class ConfirmPlacementRequest(BaseModel):
    modelCode: str
    surface: Optional[str] = None
    placement: PlacementTransform
    confirmedBy: str = "customer"


class ConfirmPlacementResponse(BaseModel):
    artifactId: str
    status: str = "PLACEMENT_CONFIRMED"
    placementUrl: str
    manifestUrl: str


class CleanupReviewRequest(BaseModel):
    reason: str = "approved"


class CleanupReviewResponse(BaseModel):
    artifactId: str
    deletedObjects: int
    reason: str
    localTmpDeleted: bool = True


class ApprovedViewerAssetsResponse(BaseModel):
    artifactId: str
    type: str = "fingerprint"
    status: str
    stage: str
    viewerFiles: ViewerFiles
    placement: Optional[PlacementTransform] = None
    # Soundwave only — raw upload + engraved clip for memory-card playback
    audioOriginal: Optional[str] = None
    audioSegment: Optional[str] = None


class FingerprintTextureFiles(BaseModel):
    overlayPng: Optional[str] = None
    alphaMap: Optional[str] = None
    heightmap: str
    normalMap: str
    roughnessMap: str
    aoMap: str


class AppliedTextureOptions(BaseModel):
    heightmapBlur: float
    normalStrength: float
    roughnessBase: int
    roughnessRidge: int
    aoStrength: float


class FingerprintTextureMetadata(BaseModel):
    appliedTexturePreset: Optional[str] = None
    appliedTextureOptions: AppliedTextureOptions


class FingerprintTextureResponse(BaseModel):
    artifactId: str
    files: FingerprintTextureFiles
    metadata: FingerprintTextureMetadata


class PresetListResponse(BaseModel):
    presets: list
    parameterGuide: dict


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "personalization_engine"


class StoragePathsInfo(BaseModel):
    fingerprintReview: str
    fingerprintApproved: str
    soundwaveReview: str
    soundwaveApproved: str


class FFmpegHealthInfo(BaseModel):
    available: bool
    binary: str
    version: Optional[str] = None
    resolvedPath: Optional[str] = None
    error: Optional[str] = None


class FFmpegHealthResponse(BaseModel):
    """GET /ffmpeg/health — probe system FFmpeg binary only."""

    status: str
    available: bool
    binary: str
    version: Optional[str] = None
    resolvedPath: Optional[str] = None
    error: Optional[str] = None


class StorageHealthResponse(BaseModel):
    status: str
    bucket: str
    prefix: str
    paths: StoragePathsInfo
    supportedTypes: list[str]
    endpoint: str
    publicEndpoint: str
    ffmpeg: FFmpegHealthInfo
    message: Optional[str] = None
    # Backward-compatible examples (optional)
    reviewPrefixExample: Optional[str] = None
    approvedPrefixExample: Optional[str] = None


class TexturePresetOptions(BaseModel):
    heightmapBlur: float
    normalStrength: float
    roughnessBase: int
    roughnessRidge: int
    aoStrength: float


class SharedTexturePresetsResponse(BaseModel):
    """GET /texture-presets — shared by fingerprint + soundwave."""

    presets: dict[str, TexturePresetOptions]
    supportedTypes: list[str] = ["fingerprint", "soundwave"]


class TexturePresetRequest(BaseModel):
    """
    Shared body for:
    - POST /fingerprint/{id}/reprocess-texture
    - POST /soundwave/{id}/reprocess-texture
    """

    preset: Optional[
        Literal[
            "realistic_default",
            "deep_engrave",
            "soft_engrave",
            "sharp_detail",
            "subtle_luxury",
        ]
    ] = Field(
        default=None,
        description="Texture preset. See GET /texture-presets.",
    )
    heightmapBlur: Optional[float] = Field(default=None, ge=0, le=10)
    normalStrength: Optional[float] = Field(default=None, ge=0.1, le=20)
    roughnessBase: Optional[int] = Field(default=None, ge=0, le=255)
    roughnessRidge: Optional[int] = Field(default=None, ge=0, le=255)
    aoStrength: Optional[float] = Field(default=None, ge=0, le=1)


class SoundwaveProductionFiles(BaseModel):
    svg: str
    waveformPoints: Optional[str] = None
    audioOriginal: Optional[str] = Field(
        default=None,
        description="URL file raw upload (audio_original.*) — nghe trên memory card.",
    )
    audioSegment: Optional[str] = Field(
        default=None,
        description="URL đoạn ≤3s đã cắt (audio_segment.wav).",
    )


class SoundwaveDebugFiles(BaseModel):
    previewPng: Optional[str] = None
    segmentWav: Optional[str] = None


class SoundwaveReviewFilesBundle(BaseModel):
    viewerFiles: ViewerFiles
    productionFiles: SoundwaveProductionFiles
    debugFiles: Optional[SoundwaveDebugFiles] = None


class SoundwaveReviewResponse(BaseModel):
    artifactId: str
    status: str
    stage: str
    type: str = "soundwave"
    reviewFiles: SoundwaveReviewFilesBundle
    manifestUrl: str
    metadata: Optional[dict] = None


class SoundwaveApprovedFilesBundle(BaseModel):
    viewerFiles: ViewerFiles
    productionFiles: SoundwaveProductionFiles


class SoundwavePublishApprovedResponse(BaseModel):
    artifactId: str
    status: str = "ASSET_APPROVED"
    stage: str = "approved"
    type: str = "soundwave"
    approvedFiles: SoundwaveApprovedFilesBundle
    manifestUrl: str


class SoundwaveTuneOptions(BaseModel):
    """
    Body cho POST /soundwave/{id}/reprocess.
    Chọn `preset` (GET /soundwave/presets) rồi override từng field nếu cần.
    Segment (start/duration) chọn đoạn audio — không nằm trong preset hình.
    """

    preset: Optional[
        Literal[
            "standard",
            "bars",
            "filled_bars",
            "outline",
            "center_line",
            "dots",
            "steps",
            "ridge",
            "smooth_wave",
            "detailed",
            "bold",
        ]
    ] = Field(
        default=None,
        description="Preset waveform. Xem GET /soundwave/presets.",
    )
    segmentStartMs: Optional[int] = Field(
        default=None, ge=0, description="Vị trí bắt đầu đoạn cắt (ms)."
    )
    segmentDurationMs: Optional[int] = Field(
        default=None,
        ge=1,
        le=3000,
        description="Độ dài đoạn cắt (ms), tối đa 3000.",
    )
    style: Optional[
        Literal[
            "line",
            "bars",
            "outline",
            "center_line",
            "dots",
            "filled_bars",
            "steps",
            "ridge",
        ]
    ] = Field(
        default=None,
        description=(
            "Kiểu render hình sóng. "
            "line|bars|outline|center_line|dots|filled_bars|steps|ridge."
        ),
    )
    samplePoints: Optional[int] = Field(
        default=None, ge=32, le=2048, description="Số điểm lấy mẫu waveform."
    )
    normalize: Optional[bool] = Field(
        default=None, description="Chuẩn hóa biên độ trước khi scale."
    )
    amplitudeScale: Optional[float] = Field(
        default=None, ge=0.1, le=5.0, description="Nhân biên độ sau normalize."
    )
    smoothing: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Làm mượt chuỗi điểm (0–1)."
    )


class ErrorResponse(BaseModel):
    message: str
    detail: Optional[str] = None


DESC_MIN_AREA = (
    "Lọc connected-component nhỏ (px). "
    "↑ cao: ít nhiễu nhưng mất đoạn vân mỏng → SVG đứt. "
    "Gợi ý giữ đường: 10–20."
)
DESC_ADAPTIVE_C = (
    "Hằng số adaptive threshold. "
    "↓ thấp (3–5): vân dày/liền hơn trên PNG → SVG liền hơn. "
    "↑ cao: vân mỏng, dễ đứt trước potrace."
)
DESC_ERODE = (
    "Kích thước erode khi giữ vùng vân chính. "
    "↑ cao: cắt mép ngoài. "
    "Gợi ý giữ đường: 8–12."
)
DESC_MORPH = (
    "Bật morphology open/close. "
    "true: sạch hơn nhưng dễ đứt nét mỏng. "
    "false: giữ nhiều đường hơn (có thể còn nhiễu)."
)
DESC_TURD = (
    "Potrace --turdsize: bỏ blob/path nhỏ hơn N. "
    "Ảnh hưởng trực tiếp SVG. "
    "↑ cao (12+): mất nhiều đoạn. Gợi ý: 2–5."
)
DESC_OPT = (
    "Potrace --opttolerance: đơn giản hóa curve. "
    "↑ cao: mượt hơn, mất chi tiết. "
    "Gợi ý giữ nét: 0.05–0.08."
)

class FingerprintTuneOptions(BaseModel):
    """
    Body cho /reprocess — chạy lại **toàn bộ** OpenCV + potrace từ `input.*`.
    Có thể chọn `preset` rồi override từng field nếu cần. Xem GET /fingerprint/presets.
    """

    preset: Optional[
        Literal[
            "standard",
            "keep_ridges",
            "clean_noise",
            "thick_ridges",
            "less_crop",
        ]
    ] = Field(
        default=None,
        description="Preset gợi ý cho reprocess. Xem GET /fingerprint/presets.",
    )
    minArea: Optional[int] = Field(default=None, ge=1, description=DESC_MIN_AREA)
    adaptiveC: Optional[int] = Field(
        default=None, ge=-20, le=40, description=DESC_ADAPTIVE_C
    )
    erodeSize: Optional[int] = Field(default=None, ge=1, le=64, description=DESC_ERODE)
    applyMorphology: Optional[bool] = Field(default=None, description=DESC_MORPH)
    turdsize: Optional[int] = Field(default=None, ge=0, le=100, description=DESC_TURD)
    opttolerance: Optional[float] = Field(
        default=None, ge=0.0, le=2.0, description=DESC_OPT
    )
    outputSvg: Optional[bool] = Field(
        default=None,
        description="true: tạo fingerprint.svg (cần potrace). false: chỉ PNG sạch.",
    )


class FingerprintReconvertSvgRequest(BaseModel):
    """
    Body cho /reconvert — **chỉ** vector hóa lại từ `06_final_clean.png`.
    Không chạy OpenCV. Dùng khi PNG đã ổn, chỉ muốn tinh chỉnh SVG.
    """

    turdsize: Optional[int] = Field(default=None, ge=0, le=100, description=DESC_TURD)
    opttolerance: Optional[float] = Field(
        default=None, ge=0.0, le=2.0, description=DESC_OPT
    )


class FingerprintTextureOptions(TexturePresetRequest):
    """Deprecated alias — use TexturePresetRequest with reprocess-texture."""


class SoundwaveTextureOptions(TexturePresetRequest):
    """Deprecated alias — use TexturePresetRequest with reprocess-texture."""
