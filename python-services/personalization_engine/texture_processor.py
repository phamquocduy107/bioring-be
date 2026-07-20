"""Generate height / normal / roughness / AO maps from final clean fingerprint PNG."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Union

import cv2
import numpy as np

PathLike = Union[str, Path]


def load_binary_final(path: Path) -> np.ndarray:
    """Load 06_final_clean.png as grayscale binary (black ridges on white)."""
    path = Path(path)
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Cannot read final clean image: {path}")
    _, binary = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)
    return binary


def create_heightmap(
    binary_img: np.ndarray,
    blur_radius: float = 1.2,
    invert: bool = False,
) -> np.ndarray:
    """
    Grayscale heightmap for engraving preview.

    Default: background=255 (high), ridges=0 (low / engraved).
    Soften edges with optional Gaussian blur.
    """
    heightmap = binary_img.copy()
    if invert:
        heightmap = cv2.bitwise_not(heightmap)

    if blur_radius and blur_radius > 0:
        # OpenCV GaussianBlur sigma; kernel sized from sigma
        k = max(3, int(round(blur_radius * 2)) | 1)
        heightmap = cv2.GaussianBlur(heightmap, (k, k), float(blur_radius))

    # Re-normalize to full 0–255 after blur
    mn, mx = float(heightmap.min()), float(heightmap.max())
    if mx > mn:
        heightmap = ((heightmap.astype(np.float32) - mn) / (mx - mn) * 255.0).astype(
            np.uint8
        )
    return heightmap


def create_normal_map(
    heightmap: np.ndarray,
    strength: float = 2.5,
) -> np.ndarray:
    """Build RGB normal map from grayscale heightmap (OpenGL / Three.js style)."""
    h = heightmap.astype(np.float32) / 255.0
    dx = cv2.Sobel(h, cv2.CV_32F, 1, 0, ksize=3)
    dy = cv2.Sobel(h, cv2.CV_32F, 0, 1, ksize=3)

    nx = -dx * float(strength)
    ny = -dy * float(strength)
    nz = np.ones_like(h, dtype=np.float32)

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    length = np.maximum(length, 1e-8)
    nx /= length
    ny /= length
    nz /= length

    r = ((nx * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    g = ((ny * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    b = ((nz * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    # OpenCV imwrite expects BGR
    return cv2.merge([b, g, r])


def create_roughness_map(
    binary_img: np.ndarray,
    base_value: int = 180,
    ridge_value: int = 235,
) -> np.ndarray:
    """
    Roughness map: metal base less rough, engraved ridges rougher (whiter).
    """
    base = int(np.clip(base_value, 0, 255))
    ridge = int(np.clip(ridge_value, 0, 255))
    result = np.full_like(binary_img, base, dtype=np.uint8)
    result[binary_img < 128] = ridge
    result = cv2.GaussianBlur(result, (3, 3), 0.5)
    return result


def create_ao_map(
    binary_img: np.ndarray,
    strength: float = 0.45,
) -> np.ndarray:
    """
    Ambient occlusion: white background, darker grooves.
    strength 0–1 controls how dark grooves become.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    groove = int(round(255 * (1.0 - strength)))
    ao = np.full_like(binary_img, 255, dtype=np.uint8)
    ao[binary_img < 128] = groove
    ao = cv2.GaussianBlur(ao, (5, 5), 1.0)
    return ao


def create_overlay_png(
    binary_img: np.ndarray,
    *,
    ridge_color: tuple[int, int, int] = (20, 20, 20),
    ridge_alpha: int = 220,
) -> np.ndarray:
    """RGBA overlay: dark ridges visible, white background transparent."""
    h, w = binary_img.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    ridge_mask = binary_img < 128
    rgba[ridge_mask, 0] = ridge_color[0]
    rgba[ridge_mask, 1] = ridge_color[1]
    rgba[ridge_mask, 2] = ridge_color[2]
    rgba[ridge_mask, 3] = int(np.clip(ridge_alpha, 0, 255))
    return rgba


def create_alpha_png(binary_img: np.ndarray) -> np.ndarray:
    """Grayscale alpha map: ridges opaque (255), background transparent (0)."""
    alpha = np.zeros_like(binary_img, dtype=np.uint8)
    alpha[binary_img < 128] = 255
    return alpha


def generate_fingerprint_texture_maps(
    final_png_path: PathLike,
    output_dir: PathLike,
    *,
    blur_radius: float = 1.2,
    normal_strength: float = 2.5,
    roughness_base: int = 180,
    roughness_ridge: int = 235,
    ao_strength: float = 0.45,
    invert_heightmap: bool = False,
) -> Dict[str, str]:
    """
    From 06_final_clean.png write viewer texture maps:
      fingerprint_overlay.png, fingerprint_alpha.png,
      fingerprint_heightmap.png, fingerprint_normal.png,
      fingerprint_roughness.png, fingerprint_ao.png
    """
    final_png_path = Path(final_png_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    binary = load_binary_final(final_png_path)
    heightmap = create_heightmap(
        binary, blur_radius=blur_radius, invert=invert_heightmap
    )
    normal = create_normal_map(heightmap, strength=normal_strength)
    roughness = create_roughness_map(
        binary, base_value=roughness_base, ridge_value=roughness_ridge
    )
    ao = create_ao_map(binary, strength=ao_strength)
    overlay = create_overlay_png(binary)
    alpha = create_alpha_png(binary)

    paths = {
        "overlay": output_dir / "fingerprint_overlay.png",
        "alpha": output_dir / "fingerprint_alpha.png",
        "heightmap": output_dir / "fingerprint_heightmap.png",
        "normal": output_dir / "fingerprint_normal.png",
        "roughness": output_dir / "fingerprint_roughness.png",
        "ao": output_dir / "fingerprint_ao.png",
    }

    cv2.imwrite(str(paths["overlay"]), overlay)
    cv2.imwrite(str(paths["alpha"]), alpha)
    cv2.imwrite(str(paths["heightmap"]), heightmap)
    cv2.imwrite(str(paths["normal"]), normal)
    cv2.imwrite(str(paths["roughness"]), roughness)
    cv2.imwrite(str(paths["ao"]), ao)

    return {key: str(path) for key, path in paths.items()}
