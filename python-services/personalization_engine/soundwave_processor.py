"""Soundwave personalization — segment audio → waveform points → SVG/PNG/textures."""

from __future__ import annotations

import json
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Optional

import cv2
import numpy as np

from .texture_processor import generate_texture_maps

Style = Literal[
    "line",
    "bars",
    "outline",
    "center_line",
    "dots",
    "filled_bars",
    "steps",
    "ridge",
]

SOUNDWAVE_STYLES: tuple[str, ...] = (
    "line",
    "bars",
    "outline",
    "center_line",
    "dots",
    "filled_bars",
    "steps",
    "ridge",
)

MAX_SEGMENT_MS = 3000


@dataclass
class SoundwaveOptions:
    segment_start_ms: int = 0
    segment_duration_ms: int = 3000
    style: Style = "line"
    sample_points: int = 512
    normalize: bool = True
    amplitude_scale: float = 1.0
    smoothing: float = 0.0
    preset: Optional[str] = None


def _load_wav_stdlib(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())

    if sampwidth == 1:
        audio = np.frombuffer(frames, dtype=np.uint8).astype(np.float32)
        audio = (audio - 128.0) / 128.0
    elif sampwidth == 2:
        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 4:
        audio = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sampwidth}")

    if n_channels > 1:
        audio = audio.reshape(-1, n_channels).mean(axis=1)
    return audio.astype(np.float32), int(sr)


def _load_via_ffmpeg(path: Path) -> tuple[np.ndarray, int]:
    """
    Decode compressed audio via FFmpeg (external binary) through pydub.

    Business logic stays here; FFmpeg path comes from settings only.
    """
    from .config import settings
    from .ffmpeg_util import AudioDecodeError

    try:
        from pydub import AudioSegment
    except ImportError as exc:
        raise AudioDecodeError(
            "Audio decoding failed. Install pydub and FFmpeg, or upload WAV."
        ) from exc

    binary = settings.FFMPEG_BINARY
    AudioSegment.converter = binary
    AudioSegment.ffmpeg = binary
    # ffprobe beside ffmpeg — do not string-replace the whole path (breaks .../ffmpeg/bin/ffmpeg)
    bin_path = Path(binary)
    name = bin_path.name
    probe_name = name.replace("ffmpeg", "ffprobe").replace("FFMPEG", "ffprobe")
    if bin_path.parent != Path("."):
        AudioSegment.ffprobe = str(bin_path.with_name(probe_name))
    elif name != "ffmpeg":
        AudioSegment.ffprobe = probe_name
    else:
        AudioSegment.ffprobe = "ffprobe"

    try:
        seg = AudioSegment.from_file(str(path))
        seg = seg.set_channels(1)
        samples = np.array(seg.get_array_of_samples(), dtype=np.float32)
        max_val = float(1 << (8 * seg.sample_width - 1))
        if max_val <= 0:
            max_val = 32768.0
        samples = samples / max_val
        return samples.astype(np.float32), int(seg.frame_rate)
    except AudioDecodeError:
        raise
    except Exception as exc:
        raise AudioDecodeError() from exc


def _load_audio_mono(path: Path) -> tuple[np.ndarray, int]:
    """Load audio as float32 mono [-1, 1]. WAV via stdlib; else FFmpeg."""
    from .ffmpeg_util import AudioDecodeError

    path = Path(path)
    suffix = path.suffix.lower()

    if suffix in {".wav", ".wave"}:
        try:
            return _load_wav_stdlib(path)
        except Exception:
            # Corrupt/odd WAV — try FFmpeg once
            try:
                return _load_via_ffmpeg(path)
            except AudioDecodeError:
                raise
            except Exception as exc:
                raise ValueError(f"Failed to read WAV: {exc}") from exc

    return _load_via_ffmpeg(path)


def _write_wav_mono(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    samples = np.clip(samples, -1.0, 1.0)
    pcm = (samples * 32767.0).astype(np.int16)
    path = Path(path)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sample_rate))
        wf.writeframes(pcm.tobytes())


def _smooth(points: np.ndarray, amount: float) -> np.ndarray:
    amount = float(np.clip(amount, 0.0, 1.0))
    if amount <= 0 or len(points) < 3:
        return points
    # Simple moving average window proportional to smoothing
    k = max(3, int(round(amount * 31)) | 1)
    kernel = np.ones(k, dtype=np.float32) / k
    padded = np.pad(points, (k // 2, k // 2), mode="edge")
    return np.convolve(padded, kernel, mode="valid").astype(np.float32)


def extract_waveform_points(
    samples: np.ndarray,
    *,
    sample_points: int = 512,
    normalize: bool = True,
    amplitude_scale: float = 1.0,
    smoothing: float = 0.0,
) -> list[float]:
    n = max(8, int(sample_points))
    if len(samples) == 0:
        return [0.0] * n

    # RMS-ish envelope per bucket
    edges = np.linspace(0, len(samples), n + 1, dtype=int)
    envelope = np.zeros(n, dtype=np.float32)
    for i in range(n):
        chunk = samples[edges[i] : edges[i + 1]]
        if len(chunk) == 0:
            envelope[i] = 0.0
        else:
            envelope[i] = float(np.sqrt(np.mean(chunk * chunk)))

    envelope = _smooth(envelope, smoothing)
    if normalize:
        peak = float(np.percentile(envelope, 99)) if envelope.max() > 0 else 0.0
        if peak < 1e-8:
            peak = float(envelope.max()) or 1.0
        envelope = np.clip(envelope / peak, 0.0, 1.0)
    envelope = np.clip(envelope * float(amplitude_scale), 0.0, 1.0)
    return [float(x) for x in envelope]


def render_soundwave_svg(
    points: list[float],
    *,
    style: Style = "line",
    width: int = 1024,
    height: int = 256,
) -> str:
    n = len(points)
    center = height / 2.0
    amp = height / 2.0 - 8
    step = width / max(n, 1)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]

    if style == "bars":
        stroke_w = max(1.5, step * 0.45)
        parts.append(
            f'<g stroke="#000" stroke-width="{stroke_w:.2f}" stroke-linecap="round">'
        )
        for i, p in enumerate(points):
            x = i * step + step / 2
            y_amp = max(p * amp, 1.5)
            parts.append(
                f'<line x1="{x:.2f}" y1="{center - y_amp:.2f}" '
                f'x2="{x:.2f}" y2="{center + y_amp:.2f}"/>'
            )
        parts.append("</g>")

    elif style == "filled_bars":
        bar_w = max(1.2, step * 0.7)
        parts.append('<g fill="#000">')
        for i, p in enumerate(points):
            x = i * step + step / 2
            y_amp = max(p * amp, 1.5)
            parts.append(
                f'<rect x="{x - bar_w / 2:.2f}" y="{center - y_amp:.2f}" '
                f'width="{bar_w:.2f}" height="{y_amp * 2:.2f}" rx="0.8"/>'
            )
        parts.append("</g>")

    elif style == "dots":
        parts.append('<g fill="#000">')
        for i, p in enumerate(points):
            x = i * step + step / 2
            y_amp = max(p * amp, 0.0)
            r = max(1.2, min(step * 0.35, 4.5))
            parts.append(f'<circle cx="{x:.2f}" cy="{center - y_amp:.2f}" r="{r:.2f}"/>')
            if y_amp > 0.5:
                parts.append(
                    f'<circle cx="{x:.2f}" cy="{center + y_amp:.2f}" r="{r:.2f}"/>'
                )
        parts.append("</g>")

    elif style == "center_line":
        coords = []
        for i, p in enumerate(points):
            x = i * step
            y = center - p * amp
            coords.append(f"{x:.2f},{y:.2f}")
        parts.append(
            f'<polyline points="{" ".join(coords)}" fill="none" stroke="#000" '
            f'stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
        )

    elif style == "outline":
        coords_top = []
        coords_bot = []
        for i, p in enumerate(points):
            x = i * step
            y_amp = max(p * amp, 0.5)
            coords_top.append(f"{x:.2f},{center - y_amp:.2f}")
            coords_bot.append(f"{x:.2f},{center + y_amp:.2f}")
        parts.append(
            f'<polyline points="{" ".join(coords_top)}" fill="none" stroke="#000" '
            f'stroke-width="2" stroke-linejoin="round"/>'
        )
        parts.append(
            f'<polyline points="{" ".join(coords_bot)}" fill="none" stroke="#000" '
            f'stroke-width="2" stroke-linejoin="round"/>'
        )

    elif style == "steps":
        coords: list[str] = []
        for i, p in enumerate(points):
            x0 = i * step
            x1 = (i + 1) * step
            y = center - max(p * amp, 0.5)
            coords.append(f"{x0:.2f},{y:.2f}")
            coords.append(f"{x1:.2f},{y:.2f}")
        for i in range(n - 1, -1, -1):
            x0 = i * step
            x1 = (i + 1) * step
            y = center + max(points[i] * amp, 0.5)
            coords.append(f"{x1:.2f},{y:.2f}")
            coords.append(f"{x0:.2f},{y:.2f}")
        parts.append(
            f'<polygon points="{" ".join(coords)}" fill="#000" fill-opacity="0.92"/>'
        )

    elif style == "ridge":
        parts.append(
            '<g stroke="#000" stroke-linecap="round" stroke-linejoin="round">'
        )
        for i in range(max(n - 1, 0)):
            x0 = i * step + step / 2
            x1 = (i + 1) * step + step / 2
            sw = max(1.8, ((points[i] + points[i + 1]) / 2) * amp * 0.7)
            parts.append(
                f'<line x1="{x0:.2f}" y1="{center:.2f}" '
                f'x2="{x1:.2f}" y2="{center:.2f}" stroke-width="{sw:.2f}"/>'
            )
        parts.append("</g>")

    else:
        # line — filled mirrored polygon
        coords = []
        for i, p in enumerate(points):
            x = i * step
            y = center - p * amp
            coords.append(f"{x:.2f},{y:.2f}")
        for i in range(n - 1, -1, -1):
            x = i * step
            y = center + points[i] * amp
            coords.append(f"{x:.2f},{y:.2f}")
        parts.append(
            f'<polygon points="{" ".join(coords)}" fill="#000" fill-opacity="0.9"/>'
        )

    parts.append("</svg>")
    return "\n".join(parts)


def render_soundwave_preview_png(
    points: list[float],
    dest: Path,
    *,
    style: Style = "line",
    width: int = 1024,
    height: int = 256,
) -> Path:
    """Black waveform on white background (binary-friendly for texture maps)."""
    img = np.full((height, width), 255, dtype=np.uint8)
    center = height // 2
    amp = height // 2 - 8
    n = len(points)
    step = width / max(n, 1)

    if style == "bars":
        bar_w = max(1, int(step * 0.45))
        for i, p in enumerate(points):
            x = int(i * step + step / 2)
            y_amp = max(int(p * amp), 1)
            x0 = max(0, x - bar_w // 2)
            x1 = min(width, x0 + bar_w)
            img[center - y_amp : center + y_amp + 1, x0:x1] = 0

    elif style == "filled_bars":
        bar_w = max(2, int(step * 0.7))
        for i, p in enumerate(points):
            x = int(i * step + step / 2)
            y_amp = max(int(p * amp), 1)
            x0 = max(0, x - bar_w // 2)
            x1 = min(width, x0 + bar_w)
            img[center - y_amp : center + y_amp + 1, x0:x1] = 0

    elif style == "dots":
        for i, p in enumerate(points):
            x = int(i * step + step / 2)
            y_amp = max(int(p * amp), 0)
            r = max(1, min(int(step * 0.35), 4))
            cv2.circle(img, (x, center - y_amp), r, 0, -1, lineType=cv2.LINE_AA)
            if y_amp > 0:
                cv2.circle(img, (x, center + y_amp), r, 0, -1, lineType=cv2.LINE_AA)

    elif style == "center_line":
        pts = []
        for i, p in enumerate(points):
            x = int(i * step)
            y = int(center - p * amp)
            pts.append([x, y])
        if len(pts) >= 2:
            cv2.polylines(
                img,
                [np.asarray(pts, dtype=np.int32)],
                False,
                0,
                2,
                lineType=cv2.LINE_AA,
            )

    elif style == "outline":
        top, bot = [], []
        for i, p in enumerate(points):
            x = int(i * step)
            y_amp = max(int(p * amp), 1)
            top.append([x, center - y_amp])
            bot.append([x, center + y_amp])
        if len(top) >= 2:
            cv2.polylines(
                img, [np.asarray(top, dtype=np.int32)], False, 0, 2, lineType=cv2.LINE_AA
            )
            cv2.polylines(
                img, [np.asarray(bot, dtype=np.int32)], False, 0, 2, lineType=cv2.LINE_AA
            )

    elif style == "steps":
        for i, p in enumerate(points):
            x0 = int(i * step)
            x1 = int((i + 1) * step)
            y_amp = max(int(p * amp), 1)
            img[center - y_amp : center + y_amp + 1, x0:x1] = 0

    elif style == "ridge":
        for i in range(max(n - 1, 0)):
            x0 = int(i * step + step / 2)
            x1 = int((i + 1) * step + step / 2)
            sw = max(2, int(((points[i] + points[i + 1]) / 2) * amp * 0.7))
            cv2.line(img, (x0, center), (x1, center), 0, sw, lineType=cv2.LINE_AA)

    else:
        # line — filled mirrored ribbon
        xs = []
        ys_top = []
        ys_bot = []
        for i, p in enumerate(points):
            x = int(i * step)
            y_amp = max(int(p * amp), 1)
            xs.append(x)
            ys_top.append(center - y_amp)
            ys_bot.append(center + y_amp)
        for i in range(len(xs) - 1):
            cv2.line(
                img,
                (xs[i], ys_top[i]),
                (xs[i + 1], ys_top[i + 1]),
                0,
                2,
                lineType=cv2.LINE_AA,
            )
            cv2.line(
                img,
                (xs[i], ys_bot[i]),
                (xs[i + 1], ys_bot[i + 1]),
                0,
                2,
                lineType=cv2.LINE_AA,
            )
            for x in range(xs[i], xs[i + 1] + 1):
                t = (x - xs[i]) / max(xs[i + 1] - xs[i], 1)
                yt = int(ys_top[i] + t * (ys_top[i + 1] - ys_top[i]))
                yb = int(ys_bot[i] + t * (ys_bot[i + 1] - ys_bot[i]))
                img[yt : yb + 1, x] = 0

    dest = Path(dest)
    cv2.imwrite(str(dest), img)
    return dest


def process_soundwave_file(
    input_path: Path,
    output_dir: Path,
    options: SoundwaveOptions,
    *,
    original_name: Optional[str] = None,
) -> dict[str, Any]:
    """
    Segment audio (max 3s), write review outputs into output_dir.
    Returns metadata + list of output filenames.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    input_path = Path(input_path)

    samples, sr = _load_audio_mono(input_path)
    duration_ms = int(len(samples) / sr * 1000) if sr else 0

    start_ms = max(0, int(options.segment_start_ms))
    seg_ms = min(MAX_SEGMENT_MS, max(1, int(options.segment_duration_ms)))
    start = int(start_ms * sr / 1000)
    end = min(len(samples), start + int(seg_ms * sr / 1000))
    if end <= start:
        raise ValueError("Audio segment is empty. Check segmentStartMs / duration.")

    segment = samples[start:end]

    # Preserve original with stable name
    ext = input_path.suffix.lower() or ".wav"
    if original_name:
        orig_ext = Path(original_name).suffix.lower() or ext
        audio_original = output_dir / f"audio_original{orig_ext}"
    else:
        audio_original = output_dir / f"audio_original{ext}"
    if input_path.resolve() != audio_original.resolve():
        audio_original.write_bytes(input_path.read_bytes())

    segment_path = output_dir / "audio_segment.wav"
    _write_wav_mono(segment_path, segment, sr)

    points = extract_waveform_points(
        segment,
        sample_points=options.sample_points,
        normalize=options.normalize,
        amplitude_scale=options.amplitude_scale,
        smoothing=options.smoothing,
    )
    points_path = output_dir / "waveform_points.json"
    points_payload = {
        "samplePoints": len(points),
        "style": options.style,
        "segmentStartMs": start_ms,
        "segmentDurationMs": seg_ms,
        "sampleRate": sr,
        "points": points,
    }
    points_path.write_text(
        json.dumps(points_payload, indent=2), encoding="utf-8"
    )

    render_from_points(output_dir, points, style=options.style)

    metadata = {
        "durationMs": duration_ms,
        "segmentStartMs": start_ms,
        "segmentDurationMs": seg_ms,
        "sampleRate": sr,
        "style": options.style,
        "samplePoints": len(points),
        "normalize": options.normalize,
        "amplitudeScale": options.amplitude_scale,
        "smoothing": options.smoothing,
        "preset": options.preset,
    }
    (output_dir / "options.json").write_text(
        json.dumps(
            {
                "preset": options.preset,
                "segmentStartMs": start_ms,
                "segmentDurationMs": seg_ms,
                "style": options.style,
                "samplePoints": options.sample_points,
                "normalize": options.normalize,
                "amplitudeScale": options.amplitude_scale,
                "smoothing": options.smoothing,
                "audioOriginal": audio_original.name,
                "audioSegment": segment_path.name,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return {
        "metadata": {
            **metadata,
            "audioOriginal": audio_original.name,
            "audioSegment": segment_path.name,
        },
        "points": points,
    }


def render_from_points(
    output_dir: Path,
    points: list[float],
    *,
    style: Style = "line",
) -> None:
    output_dir = Path(output_dir)
    svg = render_soundwave_svg(points, style=style)
    (output_dir / "soundwave.svg").write_text(svg, encoding="utf-8")
    preview = render_soundwave_preview_png(
        points, output_dir / "soundwave_preview.png", style=style
    )
    generate_texture_maps(preview, output_dir, name_prefix="soundwave")


def load_waveform_points(path: Path) -> tuple[list[float], dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    points = data.get("points") or []
    if not isinstance(points, list) or not points:
        raise ValueError("waveform_points.json has no points")
    return [float(x) for x in points], data
