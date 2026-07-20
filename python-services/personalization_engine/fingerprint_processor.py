"""OpenCV fingerprint preprocessing → clean PNG (+ optional SVG via potrace)."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union

import cv2
import numpy as np

from .svg_processor import (
    find_potrace_command,
    patch_svg_make_clean,
    save_pbm_for_potrace,
    vectorize_to_svg,
)
from .texture_processor import generate_fingerprint_texture_maps

logger = logging.getLogger("personalization.fingerprint")

PathLike = Union[str, Path]


@dataclass
class ProcessOptions:
    canvas_size: int = 1024
    content_ratio: float = 0.85
    min_area: int = 15
    output_svg: bool = True
    padding: int = 24
    erode_size: int = 10
    # Adaptive threshold (odd block size)
    adaptive_block_size: int = 31
    adaptive_c: int = 4
    blur_ksize: int = 5
    clahe_clip: float = 2.5
    apply_morphology: bool = False
    # Potrace
    turdsize: int = 3
    alphamax: float = 0.75
    opttolerance: float = 0.06
    # Texture maps: only True when calling /textures (not during process/reprocess)
    generate_textures: bool = False
    heightmap_blur: float = 1.2
    normal_strength: float = 2.5
    roughness_base: int = 180
    roughness_ridge: int = 235
    ao_strength: float = 0.45
    engrave_depth: float = 0.18

    def to_public_dict(self) -> Dict[str, Any]:
        return {
            "canvasSize": self.canvas_size,
            "contentRatio": self.content_ratio,
            "minArea": self.min_area,
            "outputSvg": self.output_svg,
            "padding": self.padding,
            "erodeSize": self.erode_size,
            "adaptiveBlockSize": self.adaptive_block_size,
            "adaptiveC": self.adaptive_c,
            "blurKsize": self.blur_ksize,
            "claheClip": self.clahe_clip,
            "applyMorphology": self.apply_morphology,
            "turdsize": self.turdsize,
            "alphamax": self.alphamax,
            "opttolerance": self.opttolerance,
            "generateTextures": self.generate_textures,
            "heightmapBlur": self.heightmap_blur,
            "normalStrength": self.normal_strength,
            "roughnessBase": self.roughness_base,
            "roughnessRidge": self.roughness_ridge,
            "aoStrength": self.ao_strength,
            "engraveDepth": self.engrave_depth,
        }


def ensure_black_ridges_white_bg(binary_img: np.ndarray) -> np.ndarray:
    """Normalize so ridges are black (0) and background is white (255)."""
    img = binary_img.copy()
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if np.mean(img) < 127:
        img = cv2.bitwise_not(img)

    _, img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    return img


def remove_small_components(binary_img: np.ndarray, min_area: int = 35) -> np.ndarray:
    """Remove connected components smaller than min_area (black ridges on white)."""
    inv = cv2.bitwise_not(binary_img)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)
    out = np.zeros_like(inv)
    for i in range(1, num):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            out[labels == i] = 255
    return cv2.bitwise_not(out)


def remove_thin_noise_by_morphology(binary_img: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    inv = cv2.bitwise_not(binary_img)
    opened = cv2.morphologyEx(inv, cv2.MORPH_OPEN, kernel, iterations=1)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)
    return cv2.bitwise_not(closed)


def keep_fingerprint_main_region(
    binary_img: np.ndarray, erode_size: int = 18
) -> np.ndarray:
    """Keep the largest blob (main fingerprint) and mask out the rest."""
    inv = cv2.bitwise_not(binary_img)
    k = max(3, erode_size | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    eroded = cv2.erode(inv, kernel, iterations=1)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(eroded, connectivity=8)
    if num <= 1:
        return binary_img

    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mask = np.zeros_like(inv)
    mask[labels == largest] = 255
    mask = cv2.dilate(mask, kernel, iterations=2)

    kept = cv2.bitwise_and(inv, mask)
    return cv2.bitwise_not(kept)


def crop_to_fingerprint(binary_img: np.ndarray, padding: int = 24) -> np.ndarray:
    inv = cv2.bitwise_not(binary_img)
    coords = cv2.findNonZero(inv)
    if coords is None:
        return binary_img

    x, y, w, h = cv2.boundingRect(coords)
    h_img, w_img = binary_img.shape[:2]
    x0 = max(0, x - padding)
    y0 = max(0, y - padding)
    x1 = min(w_img, x + w + padding)
    y1 = min(h_img, y + h + padding)
    return binary_img[y0:y1, x0:x1]


def fit_to_square_canvas(
    binary_img: np.ndarray,
    canvas_size: int = 1024,
    content_ratio: float = 0.85,
) -> np.ndarray:
    """Center fingerprint on a white square canvas."""
    canvas = np.full((canvas_size, canvas_size), 255, dtype=np.uint8)
    h, w = binary_img.shape[:2]
    if h == 0 or w == 0:
        return canvas

    target = max(1, int(canvas_size * content_ratio))
    scale = min(target / h, target / w)
    nh = max(1, int(round(h * scale)))
    nw = max(1, int(round(w * scale)))
    resized = cv2.resize(binary_img, (nw, nh), interpolation=cv2.INTER_NEAREST)

    y0 = (canvas_size - nh) // 2
    x0 = (canvas_size - nw) // 2
    canvas[y0 : y0 + nh, x0 : x0 + nw] = resized
    return canvas


def check_quality(gray: np.ndarray) -> Dict[str, Any]:
    """Simple contrast / variance based quality check."""
    if gray is None or gray.size == 0:
        return {
            "passed": False,
            "score": 0.0,
            "message": "Không đọc được ảnh.",
        }

    std = float(np.std(gray))
    mean = float(np.mean(gray))
    score = min(100.0, round(std * 1.2, 1))

    if std < 12:
        return {
            "passed": False,
            "score": score,
            "message": "Ảnh quá mờ hoặc thiếu tương phản. Hãy chụp lại rõ hơn.",
        }
    if mean < 20 or mean > 235:
        return {
            "passed": False,
            "score": score,
            "message": "Ảnh quá tối hoặc quá sáng. Điều chỉnh ánh sáng rồi thử lại.",
        }
    if std < 25:
        return {
            "passed": True,
            "score": score,
            "message": "Ảnh chấp nhận được nhưng tương phản hơi thấp.",
        }
    return {
        "passed": True,
        "score": score,
        "message": "Ảnh có độ tương phản tốt.",
    }


def _odd_at_least(value: int, minimum: int = 3) -> int:
    v = max(minimum, int(value))
    if v % 2 == 0:
        v += 1
    return v


def preprocess_fingerprint(
    image: np.ndarray, options: Optional[ProcessOptions] = None
) -> Dict[str, np.ndarray]:
    """Run full OpenCV pipeline; return intermediate images."""
    opts = options or ProcessOptions()

    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    max_side = 1600
    h, w = gray.shape[:2]
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )

    blur_k = _odd_at_least(opts.blur_ksize, 3)
    blurred = cv2.GaussianBlur(gray, (blur_k, blur_k), 0)
    clahe = cv2.createCLAHE(clipLimit=float(opts.clahe_clip), tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)

    block = _odd_at_least(opts.adaptive_block_size, 3)
    binary_raw = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block,
        int(opts.adaptive_c),
    )
    binary = ensure_black_ridges_white_bg(binary_raw)
    cleaned = remove_small_components(binary, min_area=opts.min_area)
    if opts.apply_morphology:
        cleaned = remove_thin_noise_by_morphology(cleaned)
    main_region = keep_fingerprint_main_region(cleaned, erode_size=opts.erode_size)
    cropped = crop_to_fingerprint(main_region, padding=opts.padding)
    final = fit_to_square_canvas(
        cropped,
        canvas_size=opts.canvas_size,
        content_ratio=opts.content_ratio,
    )

    return {
        "gray": gray,
        "enhanced": enhanced,
        "binary": binary,
        "cleaned": cleaned,
        "mainRegion": main_region,
        "final": final,
    }


def _save_png(path: Path, image: np.ndarray) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), image)
    return str(path)


def find_artifact_input(artifact_dir: Path) -> Optional[Path]:
    for name in ("input.png", "input.jpg", "input.jpeg"):
        path = artifact_dir / name
        if path.is_file():
            return path
    matches = sorted(artifact_dir.glob("input.*"))
    return matches[0] if matches else None


def _write_options(output_dir: Path, opts: ProcessOptions) -> None:
    (output_dir / "options.json").write_text(
        json.dumps(opts.to_public_dict(), indent=2),
        encoding="utf-8",
    )


def process_fingerprint_file(
    input_path: PathLike,
    output_dir: PathLike,
    options: Optional[ProcessOptions] = None,
) -> Dict[str, Any]:
    """
    Process a fingerprint image file into clean PNG (+ optional SVG).

    Returns:
      {
        "quality": {...},
        "paths": {...},
        "metadata": {...},
        "options": {...}
      }
    """
    opts = options or ProcessOptions()
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    image = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Cannot read image: {input_path}")

    gray_for_quality = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    quality = check_quality(gray_for_quality)

    stages = preprocess_fingerprint(image, opts)

    paths: Dict[str, Optional[str]] = {
        "gray": _save_png(output_dir / "01_gray.png", stages["gray"]),
        "enhanced": _save_png(output_dir / "02_enhanced.png", stages["enhanced"]),
        "binary": _save_png(output_dir / "03_binary.png", stages["binary"]),
        "cleaned": _save_png(output_dir / "04_cleaned.png", stages["cleaned"]),
        "mainRegion": _save_png(
            output_dir / "05_main_region.png", stages["mainRegion"]
        ),
        "final": _save_png(output_dir / "06_final_clean.png", stages["final"]),
        "pbm": None,
        "svg": None,
    }

    pbm_path = output_dir / "fingerprint.pbm"
    save_pbm_for_potrace(stages["final"], pbm_path)
    paths["pbm"] = str(pbm_path)

    if opts.output_svg:
        if not find_potrace_command():
            raise FileNotFoundError(
                "Không tìm thấy potrace. Hãy cài potrace hoặc đặt potrace.exe vào "
                "python-services/tools/potrace/."
            )
        svg_path = output_dir / "fingerprint.svg"
        vectorize_to_svg(
            pbm_path,
            svg_path,
            turdsize=opts.turdsize,
            alphamax=opts.alphamax,
            opttolerance=opts.opttolerance,
        )
        patch_svg_make_clean(svg_path)
        paths["svg"] = str(svg_path)

    if opts.generate_textures:
        final_png_path = Path(paths["final"])  # type: ignore[arg-type]
        texture_paths = generate_fingerprint_texture_maps(
            final_png_path,
            output_dir,
            blur_radius=opts.heightmap_blur,
            normal_strength=opts.normal_strength,
            roughness_base=opts.roughness_base,
            roughness_ridge=opts.roughness_ridge,
            ao_strength=opts.ao_strength,
        )
        paths.update(texture_paths)

    _write_options(output_dir, opts)

    h, w = stages["final"].shape[:2]
    public = opts.to_public_dict()
    return {
        "quality": quality,
        "paths": paths,
        "options": public,
        "metadata": {
            "width": w,
            "height": h,
            **public,
        },
    }


def reconvert_svg_from_final(
    artifact_dir: PathLike,
    options: Optional[ProcessOptions] = None,
) -> Dict[str, Any]:
    """Re-run PBM + potrace from existing 06_final_clean.png (no OpenCV redo)."""
    opts = options or ProcessOptions()
    artifact_dir = Path(artifact_dir)
    final_path = artifact_dir / "06_final_clean.png"
    if not final_path.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy 06_final_clean.png trong artifact: {artifact_dir}"
        )

    final = cv2.imread(str(final_path), cv2.IMREAD_GRAYSCALE)
    if final is None:
        raise ValueError(f"Cannot read final PNG: {final_path}")

    if not find_potrace_command():
        raise FileNotFoundError(
            "Không tìm thấy potrace. Hãy cài potrace hoặc đặt potrace.exe vào "
            "python-services/tools/potrace/."
        )

    pbm_path = artifact_dir / "fingerprint.pbm"
    save_pbm_for_potrace(final, pbm_path)
    svg_path = artifact_dir / "fingerprint.svg"
    vectorize_to_svg(
        pbm_path,
        svg_path,
        turdsize=opts.turdsize,
        alphamax=opts.alphamax,
        opttolerance=opts.opttolerance,
    )
    patch_svg_make_clean(svg_path)

    prev: Dict[str, Any] = {}
    options_path = artifact_dir / "options.json"
    if options_path.is_file():
        try:
            prev = json.loads(options_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = {}
    merged = {**prev, **opts.to_public_dict(), "outputSvg": True}
    options_path.write_text(json.dumps(merged, indent=2), encoding="utf-8")

    h, w = final.shape[:2]

    def optional(name: str) -> Optional[str]:
        path = artifact_dir / name
        return str(path) if path.is_file() else None

    # Keep existing texture maps if present (reconvert does not regenerate them)
    return {
        "quality": {
            "passed": True,
            "score": 0.0,
            "message": "Reconvert SVG từ final PNG (không chạy lại OpenCV).",
        },
        "paths": {
            "gray": optional("01_gray.png"),
            "enhanced": optional("02_enhanced.png"),
            "binary": optional("03_binary.png"),
            "cleaned": optional("04_cleaned.png"),
            "mainRegion": optional("05_main_region.png"),
            "final": str(final_path),
            "pbm": str(pbm_path),
            "svg": str(svg_path),
            "heightmap": optional("fingerprint_heightmap.png"),
            "normal": optional("fingerprint_normal.png"),
            "roughness": optional("fingerprint_roughness.png"),
            "ao": optional("fingerprint_ao.png"),
        },
        "options": merged,
        "metadata": {
            "width": w,
            "height": h,
            **merged,
        },
    }
