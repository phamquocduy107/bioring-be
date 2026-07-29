"""Artifact type / stage constants and output file groups."""

from __future__ import annotations

STAGE_REVIEW = "review"
STAGE_APPROVED = "approved"

TYPE_FINGERPRINT = "fingerprint"
TYPE_SOUNDWAVE = "soundwave"
TYPE_HEARTBEAT = "heartbeat"

SUPPORTED_ARTIFACT_TYPES = [TYPE_FINGERPRINT, TYPE_SOUNDWAVE, TYPE_HEARTBEAT]

MANIFEST_FILENAME = "artifact_manifest.json"
PLACEMENT_FILENAME = "placement.json"

DEFAULT_SURFACE = {
    TYPE_FINGERPRINT: "Fingerprint_Surface",
    TYPE_SOUNDWAVE: "Soundwave_Surface",
    TYPE_HEARTBEAT: "Heartbeat_Surface",
}

ARTIFACT_ID_PREFIX = {
    TYPE_FINGERPRINT: "fp",
    TYPE_SOUNDWAVE: "sw",
    TYPE_HEARTBEAT: "hb",
}

PREFIX_TO_ARTIFACT_TYPE = {
    prefix: artifact_type
    for artifact_type, prefix in ARTIFACT_ID_PREFIX.items()
}


def resolve_artifact_type_from_id(artifact_id: str) -> str | None:
    """Infer artifact type from id prefix (`fp_…` / `sw_…` / `hb_…`)."""
    if not artifact_id or "_" not in artifact_id:
        return None
    prefix = artifact_id.split("_", 1)[0].lower()
    return PREFIX_TO_ARTIFACT_TYPE.get(prefix)

# --- Fingerprint ---

FINGERPRINT_VIEWER_FILES = [
    "fingerprint_overlay.png",
    "fingerprint_alpha.png",
    "fingerprint_heightmap.png",
    "fingerprint_normal.png",
    "fingerprint_roughness.png",
    "fingerprint_ao.png",
]

FINGERPRINT_PRODUCTION_FILES = [
    "fingerprint.svg",
]

FINGERPRINT_DEBUG_FILES = [
    "input.png",
    "06_final_clean.png",
]

FINGERPRINT_REQUIRED_APPROVAL_FILES = [
    "input.png",
    "06_final_clean.png",
    "fingerprint.svg",
    *FINGERPRINT_VIEWER_FILES,
]

FINGERPRINT_PIPELINE_FILES = [
    "01_gray.png",
    "02_enhanced.png",
    "03_binary.png",
    "04_cleaned.png",
    "05_main_region.png",
    "fingerprint.pbm",
]

FINGERPRINT_BAKED_TEXTURE_FILES = [
    "fingerprint_overlay_baked.png",
    "fingerprint_alpha_baked.png",
    "fingerprint_heightmap_baked.png",
    "fingerprint_normal_baked.png",
    "fingerprint_roughness_baked.png",
    "fingerprint_ao_baked.png",
]

FINGERPRINT_PLACEMENT_PRODUCTION_FILES = [
    "fingerprint_placed.svg",
    "manufacturing_metadata.json",
]

REPROCESS_REPLACE_FILES = [
    "06_final_clean.png",
    "fingerprint.svg",
    *FINGERPRINT_PIPELINE_FILES,
    *FINGERPRINT_VIEWER_FILES,
    *FINGERPRINT_BAKED_TEXTURE_FILES,
    *FINGERPRINT_PLACEMENT_PRODUCTION_FILES,
]

RECONVERT_REPLACE_FILES = [
    "fingerprint.svg",
    *FINGERPRINT_PLACEMENT_PRODUCTION_FILES,
]

TEXTURE_REPLACE_FILES = [
    *FINGERPRINT_VIEWER_FILES,
    *FINGERPRINT_BAKED_TEXTURE_FILES,
]

PROCESS_OUTPUT_FILES = [
    *FINGERPRINT_PIPELINE_FILES,
    "input.png",
    "06_final_clean.png",
    "fingerprint.svg",
    *FINGERPRINT_VIEWER_FILES,
]

REPROCESS_OUTPUT_FILES = PROCESS_OUTPUT_FILES

TEXTURE_OUTPUT_FILES = list(FINGERPRINT_VIEWER_FILES)

APPROVED_PUBLISH_FILES = [
    "fingerprint.svg",
    *FINGERPRINT_VIEWER_FILES,
]

APPROVED_DEBUG_FILES = list(FINGERPRINT_DEBUG_FILES)

# --- Soundwave ---

SOUNDWAVE_VIEWER_FILES = [
    "soundwave_overlay.png",
    "soundwave_alpha.png",
    "soundwave_heightmap.png",
    "soundwave_normal.png",
    "soundwave_roughness.png",
    "soundwave_ao.png",
]

SOUNDWAVE_PRODUCTION_FILES = [
    "soundwave.svg",
    "waveform_points.json",
]

SOUNDWAVE_DEBUG_FILES = [
    "audio_segment.wav",
    "soundwave_preview.png",
]

SOUNDWAVE_REQUIRED_APPROVAL_FILES = [
    "soundwave.svg",
    "waveform_points.json",
    *SOUNDWAVE_VIEWER_FILES,
]

SOUNDWAVE_PROCESS_OUTPUT_FILES = [
    "audio_segment.wav",
    "waveform_points.json",
    "soundwave_preview.png",
    "soundwave.svg",
    "options.json",
    *SOUNDWAVE_VIEWER_FILES,
]

SOUNDWAVE_REPROCESS_REPLACE_FILES = [
    *SOUNDWAVE_PROCESS_OUTPUT_FILES,
]

SOUNDWAVE_RENDER_REPLACE_FILES = [
    "soundwave_preview.png",
    "soundwave.svg",
    *SOUNDWAVE_VIEWER_FILES,
]

SOUNDWAVE_TEXTURE_REPLACE_FILES = list(SOUNDWAVE_VIEWER_FILES)

SOUNDWAVE_APPROVED_PUBLISH_FILES = [
    "soundwave.svg",
    *SOUNDWAVE_VIEWER_FILES,
    "waveform_points.json",
    "audio_segment.wav",  # clip ≤3s used for engraving / memory-card playback
]

SOUNDWAVE_APPROVED_DEBUG_FILES = [
    "soundwave_preview.png",
]
