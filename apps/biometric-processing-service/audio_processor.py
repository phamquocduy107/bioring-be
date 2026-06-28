import io
import urllib.request
import librosa
import numpy as np
import svgwrite


def process_audio(audio_url: str) -> tuple[str, int]:
    try:
        response = urllib.request.urlopen(audio_url, timeout=30)
        audio_bytes = response.read()
    except Exception as e:
        raise ValueError(f"Failed to download audio from {audio_url}: {e}")

    try:
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=True)
    except Exception as e:
        raise ValueError(f"Failed to process audio with librosa: {e}")

    duration_ms = int(len(y) / sr * 1000)

    n_fft = 2048
    hop_length = 512
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    S_db = librosa.amplitude_to_db(S, ref=np.max)

    S_norm = (S_db - S_db.min()) / (S_db.max() - S_db.min() + 1e-10)
    S_norm = 1.0 - S_norm

    num_freq_bins = min(32, S_norm.shape[0])
    num_time_frames = min(200, S_norm.shape[1])

    downsampled = np.zeros((num_freq_bins, num_time_frames))
    fb = S_norm.shape[0] // num_freq_bins
    ft = S_norm.shape[1] // num_time_frames
    for i in range(num_freq_bins):
        for j in range(num_time_frames):
            downsampled[i, j] = np.mean(
                S_norm[i * fb : (i + 1) * fb, j * ft : (j + 1) * ft]
            )

    svg = svgwrite.Drawing(size=(800, 256))
    svg.add(svg.rect(insert=(0, 0), size=(800, 256), fill="#1a1a2e"))

    band_height = 256 / num_freq_bins
    bar_width = 800 / num_time_frames

    for i in range(num_freq_bins):
        y0 = i * band_height
        for j in range(num_time_frames):
            intensity = float(downsampled[i, j])
            intensity = max(0.0, min(1.0, intensity))
            if intensity < 0.05:
                continue
            h = band_height * intensity
            gray_value = int(180 + 75 * (1.0 - intensity))
            fill_color = f"rgb({gray_value}, {gray_value}, {gray_value})"
            svg.add(
                svg.rect(
                    insert=(j * bar_width, y0 + (band_height - h) / 2),
                    size=(max(bar_width - 1, 1), max(h, 1)),
                    fill=fill_color,
                    rx=0.5,
                    ry=0.5,
                )
            )

    return svg.tostring(), duration_ms
