"""PBM + Potrace SVG vectorization helpers."""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import numpy as np

from .config import settings

logger = logging.getLogger("personalization.svg")


def save_pbm_for_potrace(binary_image: np.ndarray, pbm_path: str | Path) -> Path:
    """Write binary image (0/255, white bg / black ridges) as PBM (P4)."""
    path = Path(pbm_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    img = binary_image
    if img.ndim == 3:
        img = img[:, :, 0]

    # Potrace: black = foreground. Ensure 0=black ridge, 255=white bg → bit 1 = black.
    # PBM: 1 = black. Convert so ridge (near 0) → 1, bg (near 255) → 0.
    bits = (img < 128).astype(np.uint8)
    h, w = bits.shape
    row_bytes = (w + 7) // 8
    packed = np.zeros((h, row_bytes), dtype=np.uint8)

    for y in range(h):
        row = bits[y]
        for x in range(w):
            if row[x]:
                packed[y, x // 8] |= 0x80 >> (x % 8)

    header = f"P4\n{w} {h}\n".encode("ascii")
    path.write_bytes(header + packed.tobytes())
    return path


def find_potrace_command() -> Optional[str]:
    """Resolve potrace executable path."""
    if settings.POTRACE_PATH:
        candidate = Path(settings.POTRACE_PATH)
        if candidate.is_file():
            return str(candidate.resolve())

    which = shutil.which("potrace") or shutil.which("potrace.exe")
    if which:
        return which

    # Windows common locations relative to python-services root
    root = Path(__file__).resolve().parent.parent
    candidates = [
        Path.cwd() / "potrace.exe",
        Path.cwd() / "potrace",
        root / "tools" / "potrace" / "potrace.exe",
        root / "tools" / "potrace" / "potrace",
    ]
    for path in candidates:
        if path.is_file():
            return str(path.resolve())

    return None


def vectorize_to_svg(
    pbm_path: str | Path,
    svg_path: str | Path,
    *,
    turdsize: int = 12,
    alphamax: float = 0.75,
    opttolerance: float = 0.12,
) -> Path:
    """Run potrace on PBM → SVG."""
    potrace = find_potrace_command()
    if not potrace:
        raise FileNotFoundError(
            "Không tìm thấy potrace. Hãy cài potrace hoặc đặt potrace.exe vào "
            "python-services/tools/potrace/."
        )

    pbm = Path(pbm_path)
    out = Path(svg_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        potrace,
        str(pbm),
        "-s",  # SVG
        "-o",
        str(out),
        "--turdsize",
        str(int(turdsize)),
        "--alphamax",
        str(float(alphamax)),
        "--opttolerance",
        str(float(opttolerance)),
    ]
    logger.info("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"potrace failed (code={result.returncode}): {result.stderr or result.stdout}"
        )
    if not out.is_file():
        raise RuntimeError("potrace finished but SVG file was not created.")
    return out


def patch_svg_make_clean(svg_path: str | Path) -> Path:
    """Light post-process: ensure black fill / white-friendly SVG."""
    path = Path(svg_path)
    text = path.read_text(encoding="utf-8", errors="ignore")

    # Force path fill to black if fill missing or white
    text = re.sub(
        r'fill\s*=\s*["\']?(?:#?[fF]{3,6}|white|none)["\']?',
        'fill="#000000"',
        text,
    )
    if "fill=" not in text and "<path" in text:
        text = text.replace("<path", '<path fill="#000000"', 1)

    # Transparent / white background hint via style if no rect bg
    if "<rect" not in text and "<svg" in text:
        text = text.replace(
            "<svg",
            '<svg style="background:transparent"',
            1,
        )

    path.write_text(text, encoding="utf-8")
    return path
