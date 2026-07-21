"""FFmpeg as external system tool (not business logic)."""

from __future__ import annotations

import shutil
import subprocess
from typing import Any, Optional


def probe_ffmpeg(binary: str = "ffmpeg") -> dict[str, Any]:
    """
    Check whether the configured FFmpeg binary is available.

    Returns a small health dict — does not decode audio or touch artifacts.
    """
    resolved = shutil.which(binary) or binary
    try:
        proc = subprocess.run(
            [binary, "-version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if proc.returncode != 0:
            return {
                "available": False,
                "binary": binary,
                "resolvedPath": resolved if shutil.which(binary) else None,
                "version": None,
                "error": (proc.stderr or proc.stdout or "ffmpeg -version failed").strip()[
                    :300
                ],
            }
        first_line = (proc.stdout or "").splitlines()[0] if proc.stdout else ""
        return {
            "available": True,
            "binary": binary,
            "resolvedPath": shutil.which(binary),
            "version": first_line.strip() or None,
            "error": None,
        }
    except FileNotFoundError:
        return {
            "available": False,
            "binary": binary,
            "resolvedPath": None,
            "version": None,
            "error": f"Binary not found: {binary}",
        }
    except Exception as exc:
        return {
            "available": False,
            "binary": binary,
            "resolvedPath": shutil.which(binary),
            "version": None,
            "error": str(exc)[:300],
        }


class AudioDecodeError(RuntimeError):
    """Raised when compressed audio cannot be decoded (usually missing FFmpeg)."""

    DEFAULT_MESSAGE = (
        "Audio decoding failed. FFmpeg is required for mp3/m4a/aac/ogg. "
        "Install FFmpeg or upload WAV."
    )

    def __init__(self, message: Optional[str] = None) -> None:
        super().__init__(message or self.DEFAULT_MESSAGE)
