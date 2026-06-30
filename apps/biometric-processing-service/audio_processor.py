import io
import urllib.request
import librosa
import numpy as np
import svgwrite


def _download_audio(audio_url: str) -> tuple[np.ndarray, int]:
    try:
        # Cấu hình User-Agent để tránh bị một số server chặn tải file
        req = urllib.request.Request(
            audio_url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        response = urllib.request.urlopen(req, timeout=30)
        audio_bytes = response.read()
    except Exception as e:
        raise ValueError(f"Failed to download audio from {audio_url}: {e}")

    try:
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=True)
    except Exception as e:
        raise ValueError(f"Failed to process audio with librosa: {e}")

    return y, sr


def _preprocess(y: np.ndarray, sr: int) -> np.ndarray:
    # Cắt bỏ đoạn im lặng ở đầu và cuối file
    y, _ = librosa.effects.trim(y, top_db=20)
    if len(y) < 256:
        raise ValueError("Audio too short after trimming silence")

    # Chuẩn hóa biên độ âm thanh về khoảng [-1, 1]
    y = librosa.util.normalize(y)
    return y


def _compute_rms_envelope(y: np.ndarray) -> np.ndarray:
    frame_length = 2048
    hop_length = 512
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    return rms


def _downsample(rms: np.ndarray, num_points: int) -> np.ndarray:
    # Chia đều các chỉ số để đảm bảo mọi phần của bài nhạc đều đóng góp vào sóng âm
    indices = np.linspace(0, len(rms) - 1, num_points)
    return np.interp(indices, np.arange(len(rms)), rms)


def _normalize_envelope(envelope: np.ndarray) -> np.ndarray:
    # Chuẩn hóa dựa trên phân vị thứ 99 để tránh các đỉnh âm thanh quá cao làm sụp các đoạn khác
    p99 = np.percentile(envelope, 99)
    if p99 < 1e-10:
        raise ValueError("Audio envelope is flat or silent")
    return np.clip(envelope / p99, 0, 1)


def _generate_svg(envelope: np.ndarray, width: int = 800, height: int = 256) -> str:
    n = len(envelope)
    center = height / 2.0
    amplitude = height / 2.0 - 10  # Chừa lề 10px để đầu các cột to không bị cắt lẹm
    
    dwg = svgwrite.Drawing(size=(width, height))
    
    # Tạo nền trắng (#ffffff)
    # dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill="#ffffff"))
    
    # Tính toán khoảng cách giữa các vạch và độ dày nét vẽ
    step = width / n
    # Dành 50% cho vạch, 50% cho khoảng trống
    stroke_width = max(2.0, step * 0.5) 
    
    # Đổi thành màu đen (#000000), nét bo tròn (round)
    g = dwg.g(stroke="#000000", stroke_width=stroke_width, stroke_linecap="round")
    
    for i in range(n):
        # Căn giữa các vạch
        x = i * step + step / 2
        # Đảm bảo các đoạn im lặng vẫn có vạch ngắn (tạo thành một đường đứt nét ở giữa)
        y_amp = max(envelope[i] * amplitude, 2.0) 
        
        # Vẽ đường thẳng đứng đối xứng qua trục tâm
        g.add(dwg.line(start=(x, center - y_amp), end=(x, center + y_amp)))
        
    dwg.add(g)
    return dwg.tostring()


# SỬA num_points TỪ 400 XUỐNG 60
def process_audio(audio_url: str, num_points: int = 60) -> tuple[str, int]:
    """
    Hàm chính xử lý audio và trả về chuỗi SVG cùng thời lượng nhạc (ms)
    - num_points: 60 điểm sẽ tạo ra các cột thưa và to, khoảng cách rõ ràng.
    """
    # 1. Tải và nạp file âm thanh
    y, sr = _download_audio(audio_url)
    duration_ms = int(len(y) / sr * 1000)

    # 2. Tiền xử lý (Xóa khoảng lặng, chuẩn hóa biên độ)
    y = _preprocess(y, sr)

    # 3. Trích xuất phong bì năng lượng RMS
    rms = _compute_rms_envelope(y)

    # 4. Giảm số lượng điểm (Downsampling) xuống số lượng vạch mong muốn
    envelope = _downsample(rms, num_points)

    # 5. Chuẩn hóa biên độ phong bì nhạc
    envelope = _normalize_envelope(envelope)

    # 6. Tạo chuỗi SVG dạng vạch đứng
    svg_content = _generate_svg(envelope, width=800, height=256)

    return svg_content, duration_ms