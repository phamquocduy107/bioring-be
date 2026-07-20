"""Output file groups for fingerprint artifact replace / review / approve."""

from __future__ import annotations

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
    "fingerprint_overlay.png",
    "fingerprint_alpha.png",
    "fingerprint_heightmap.png",
    "fingerprint_normal.png",
    "fingerprint_roughness.png",
    "fingerprint_ao.png",
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

# Outputs produced on full process / reprocess (local + REVIEW upload).
PROCESS_OUTPUT_FILES = [
    *FINGERPRINT_PIPELINE_FILES,
    "input.png",
    "06_final_clean.png",
    "fingerprint.svg",
    *FINGERPRINT_VIEWER_FILES,
]

REPROCESS_OUTPUT_FILES = PROCESS_OUTPUT_FILES

TEXTURE_OUTPUT_FILES = list(FINGERPRINT_VIEWER_FILES)

# Copy to APPROVED when publish-approved (default, no debug).
APPROVED_PUBLISH_FILES = [
    "fingerprint.svg",
    *FINGERPRINT_VIEWER_FILES,
]

APPROVED_DEBUG_FILES = list(FINGERPRINT_DEBUG_FILES)

MANIFEST_FILENAME = "artifact_manifest.json"
PLACEMENT_FILENAME = "placement.json"
