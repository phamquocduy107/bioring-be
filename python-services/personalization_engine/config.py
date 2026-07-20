"""Personalization engine settings (fingerprint / SVG assets)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from python-services root
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")


def get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"true", "1", "yes", "y"}


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


def get_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return float(value)


@dataclass
class Settings:
    PERSONALIZATION_PORT: int = get_int_env("PERSONALIZATION_PORT", 8010)

    PERSONALIZATION_TEMP_DIR: str = os.getenv(
        "PERSONALIZATION_TEMP_DIR", ".tmp/personalization"
    )

    FINGERPRINT_CANVAS_SIZE: int = get_int_env("FINGERPRINT_CANVAS_SIZE", 1024)
    FINGERPRINT_CONTENT_RATIO: float = get_float_env("FINGERPRINT_CONTENT_RATIO", 0.85)
    FINGERPRINT_MIN_AREA: int = get_int_env("FINGERPRINT_MIN_AREA", 15)
    FINGERPRINT_PADDING: int = get_int_env("FINGERPRINT_PADDING", 24)
    FINGERPRINT_ERODE_SIZE: int = get_int_env("FINGERPRINT_ERODE_SIZE", 10)
    FINGERPRINT_ADAPTIVE_BLOCK_SIZE: int = get_int_env(
        "FINGERPRINT_ADAPTIVE_BLOCK_SIZE", 31
    )
    FINGERPRINT_ADAPTIVE_C: int = get_int_env("FINGERPRINT_ADAPTIVE_C", 4)
    FINGERPRINT_BLUR_KSIZE: int = get_int_env("FINGERPRINT_BLUR_KSIZE", 5)
    FINGERPRINT_CLAHE_CLIP: float = get_float_env("FINGERPRINT_CLAHE_CLIP", 2.5)
    FINGERPRINT_APPLY_MORPHOLOGY: bool = get_bool_env(
        "FINGERPRINT_APPLY_MORPHOLOGY", False
    )

    # Texture maps for 3D engraving preview (Three.js / React Native)
    # Textures are produced only via POST /fingerprint/{id}/textures (final step).
    FINGERPRINT_GENERATE_TEXTURES: bool = get_bool_env(
        "FINGERPRINT_GENERATE_TEXTURES", False
    )
    FINGERPRINT_ENGRAVE_DEPTH: float = get_float_env("FINGERPRINT_ENGRAVE_DEPTH", 0.18)
    FINGERPRINT_HEIGHTMAP_BLUR: float = get_float_env("FINGERPRINT_HEIGHTMAP_BLUR", 1.2)
    FINGERPRINT_NORMAL_STRENGTH: float = get_float_env(
        "FINGERPRINT_NORMAL_STRENGTH", 2.5
    )
    FINGERPRINT_ROUGHNESS_BASE: int = get_int_env("FINGERPRINT_ROUGHNESS_BASE", 180)
    FINGERPRINT_ROUGHNESS_RIDGE: int = get_int_env("FINGERPRINT_ROUGHNESS_RIDGE", 235)
    FINGERPRINT_AO_STRENGTH: float = get_float_env("FINGERPRINT_AO_STRENGTH", 0.45)

    POTRACE_TURDSIZE: int = get_int_env("POTRACE_TURDSIZE", 3)
    POTRACE_ALPHAMAX: float = get_float_env("POTRACE_ALPHAMAX", 0.75)
    POTRACE_OPTTOLERANCE: float = get_float_env("POTRACE_OPTTOLERANCE", 0.06)

    # Empty → auto-discover potrace.exe
    POTRACE_PATH: str = os.getenv("POTRACE_PATH", "") or ""

    APP_ENV: str = os.getenv("APP_ENV", "development")

    PERSONALIZATION_MINIO_BUCKET: str = os.getenv(
        "PERSONALIZATION_MINIO_BUCKET", "bioring-personalization"
    )
    PERSONALIZATION_MINIO_PREFIX: str = os.getenv(
        "PERSONALIZATION_MINIO_PREFIX", "personalization"
    ).strip("/")

    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE: bool = (
        get_bool_env("MINIO_SECURE", False)
        if os.getenv("MINIO_SECURE") is not None
        else get_bool_env("MINIO_USE_SSL", False)
    )
    MINIO_PUBLIC_ENDPOINT: str = os.getenv(
        "MINIO_PUBLIC_ENDPOINT", "http://localhost:9000"
    ).rstrip("/")

    @property
    def temp_dir_path(self) -> Path:
        path = Path(self.PERSONALIZATION_TEMP_DIR)
        if not path.is_absolute():
            path = _ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
