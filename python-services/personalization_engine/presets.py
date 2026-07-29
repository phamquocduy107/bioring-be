"""Reprocess and texture preset definitions for personalization."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict

ReprocessPresetCode = Literal[
    "standard", "keep_ridges", "clean_noise", "thick_ridges", "less_crop"
]
SoundwavePresetCode = Literal[
    "standard",
    "bars",
    "smooth_wave",
    "detailed",
    "bold",
    "outline",
    "center_line",
    "dots",
    "filled_bars",
    "steps",
    "ridge",
]
TexturePresetCode = Literal[
    "realistic_default",
    "deep_engrave",
    "soft_engrave",
    "sharp_detail",
    "subtle_luxury",
]


class PresetDefinition(TypedDict):
    code: str
    title: str
    whenToUse: str
    options: Dict[str, Any]
    explanation: Dict[str, str]


REPROCESS_PARAMETER_GUIDE: Dict[str, str] = {
    "minArea": (
        "Lọc connected-component nhỏ. Tăng lên sẽ xóa nhiễu tốt hơn nhưng dễ mất đoạn vân mảnh. "
        "Giảm xuống sẽ giữ nhiều nét hơn nhưng có thể giữ cả nhiễu."
    ),
    "adaptiveC": (
        "Điều chỉnh adaptive threshold. Giảm xuống giúp vân dày/liền hơn. "
        "Tăng lên làm vân mảnh/sạch hơn nhưng dễ đứt."
    ),
    "erodeSize": (
        "Kích thước erode để giữ vùng vân chính. 0 = tắt erode. "
        "Tăng lên sẽ loại vùng ngoài mạnh hơn nhưng dễ cắt mất mép / còn đốm. "
        "Giảm xuống sẽ giữ mép nhiều hơn."
    ),
    "applyMorphology": (
        "Bật open/close morphology. true giúp sạch nhiễu nhưng dễ làm đứt nét mỏng. "
        "false giữ nhiều đường vân hơn."
    ),
    "turdsize": (
        "Potrace bỏ path/blob nhỏ hơn giá trị này. Tăng lên sẽ SVG sạch nhẹ hơn "
        "nhưng mất chi tiết. Giảm xuống giữ nhiều path nhỏ hơn."
    ),
    "opttolerance": (
        "Potrace đơn giản hóa đường cong. Tăng lên SVG mượt/nhẹ hơn nhưng mất chi tiết. "
        "Giảm xuống giữ chi tiết hơn nhưng SVG nặng hơn."
    ),
}

REPROCESS_PRESETS: List[PresetDefinition] = [
    {
        "code": "standard",
        "title": "Chuẩn mặc định",
        "whenToUse": "Dùng cho đa số ảnh vân tay rõ, ít nhiễu.",
        "options": {
            "minArea": 15,
            "adaptiveC": 4,
            "erodeSize": 4,
            "applyMorphology": False,
            "turdsize": 3,
            "opttolerance": 0.06,
        },
        "explanation": {
            "minArea": "Lọc nhiễu nhỏ vừa phải, vẫn giữ được nét mảnh.",
            "adaptiveC": "Giữ độ dày vân ở mức cân bằng.",
            "erodeSize": "Erode nhẹ để giữ ROI chính, không phá nét mỏng.",
            "applyMorphology": "Tắt để tránh làm đứt nét mỏng.",
            "turdsize": "Potrace giữ tương đối nhiều path nhỏ.",
            "opttolerance": "Giữ chi tiết SVG ở mức tốt.",
        },
    },
    {
        "code": "keep_ridges",
        "title": "Giữ nhiều nét vân hơn",
        "whenToUse": "Dùng khi PNG/SVG bị mất nhiều nét hoặc đường vân bị đứt.",
        "options": {
            "minArea": 5,
            "adaptiveC": 3,
            "erodeSize": 2,
            "applyMorphology": False,
            "turdsize": 1,
            "opttolerance": 0.03,
        },
        "explanation": {
            "minArea": "Giảm mạnh để không xóa các nét vân nhỏ.",
            "adaptiveC": "Giảm để vân dày và liền hơn.",
            "erodeSize": "Erode rất nhẹ để giữ hầu hết mép vân.",
            "applyMorphology": "Tắt để tránh làm đứt nét mỏng.",
            "turdsize": "Giảm để SVG giữ nhiều path nhỏ.",
            "opttolerance": "Giảm để giữ nhiều chi tiết vector hơn.",
        },
    },
    {
        "code": "clean_noise",
        "title": "Làm sạch nhiễu hơn",
        "whenToUse": "Dùng khi output còn nhiều chấm nhỏ, hạt nhiễu hoặc path rác.",
        "options": {
            "minArea": 25,
            "adaptiveC": 5,
            "erodeSize": 6,
            "applyMorphology": True,
            "turdsize": 5,
            "opttolerance": 0.08,
        },
        "explanation": {
            "minArea": "Tăng để xóa nhiều blob nhỏ hơn.",
            "adaptiveC": "Tăng nhẹ để vân sạch và mảnh hơn.",
            "erodeSize": "Tăng vừa phải để tập trung vùng vân chính.",
            "applyMorphology": "Bật để lọc nhiễu mạnh hơn.",
            "turdsize": "Tăng để bỏ path SVG nhỏ/rác.",
            "opttolerance": "Tăng nhẹ để SVG mượt và nhẹ hơn.",
        },
    },
    {
        "code": "thick_ridges",
        "title": "Làm vân dày/liền hơn",
        "whenToUse": "Dùng khi đường vân quá mỏng hoặc dễ đứt trước khi chuyển SVG.",
        "options": {
            "minArea": 10,
            "adaptiveC": 3,
            "erodeSize": 3,
            "applyMorphology": False,
            "turdsize": 2,
            "opttolerance": 0.04,
        },
        "explanation": {
            "minArea": "Giữ nét nhỏ tốt hơn standard.",
            "adaptiveC": "Giảm để đường vân dày và liền hơn.",
            "erodeSize": "Giảm để ít cắt vùng rìa.",
            "applyMorphology": "Tắt để không làm mỏng/đứt nét.",
            "turdsize": "Giữ nhiều path nhỏ hơn standard.",
            "opttolerance": "Giữ chi tiết SVG nhiều hơn standard.",
        },
    },
    {
        "code": "less_crop",
        "title": "Giữ mép ngoài nhiều hơn",
        "whenToUse": "Dùng khi vùng rìa fingerprint bị cắt mất hoặc chỉ còn phần giữa.",
        "options": {
            "minArea": 10,
            "adaptiveC": 4,
            "erodeSize": 0,
            "applyMorphology": False,
            "turdsize": 2,
            "opttolerance": 0.05,
        },
        "explanation": {
            "minArea": "Giữ nhiều chi tiết nhỏ ở vùng rìa.",
            "adaptiveC": "Giữ threshold cân bằng.",
            "erodeSize": "Tắt erode để không cắt mất mép ngoài fingerprint.",
            "applyMorphology": "Tắt để tránh mất nét mỏng vùng rìa.",
            "turdsize": "Giữ nhiều path nhỏ ở vùng rìa.",
            "opttolerance": "Giữ chi tiết vector vừa đủ.",
        },
    },
]

TEXTURE_PARAMETER_GUIDE: Dict[str, str] = {
    "heightmapBlur": (
        "Làm mềm mép rãnh trên heightmap. Tăng lên thì rãnh mềm hơn, giảm xuống thì mép sắc hơn."
    ),
    "normalStrength": (
        "Độ mạnh của normal map. Tăng lên thì rãnh nhìn sâu/rõ hơn, giảm xuống thì khắc nhẹ hơn."
    ),
    "roughnessBase": (
        "Độ nhám của vùng nền kim loại. Giá trị cao hơn làm nền bớt bóng."
    ),
    "roughnessRidge": (
        "Độ nhám của vùng vân khắc. Cao hơn làm vùng khắc nhám hơn và thật hơn."
    ),
    "aoStrength": (
        "Độ tối trong rãnh. Tăng lên thì rãnh sâu/tối hơn, giảm xuống thì rãnh nhẹ hơn."
    ),
}

TEXTURE_PRESETS: List[PresetDefinition] = [
    {
        "code": "realistic_default",
        "title": "Preview mặc định",
        "whenToUse": "Dùng cho đa số mẫu nhẫn.",
        "options": {
            "heightmapBlur": 1.2,
            "normalStrength": 2.5,
            "roughnessBase": 180,
            "roughnessRidge": 235,
            "aoStrength": 0.45,
        },
        "explanation": {
            "heightmapBlur": "Làm mềm mép rãnh ở mức vừa phải.",
            "normalStrength": "Tạo cảm giác rãnh khắc rõ nhưng không quá gắt.",
            "roughnessBase": "Nền kim loại vẫn còn độ bóng.",
            "roughnessRidge": "Vùng khắc nhám hơn nền.",
            "aoStrength": "Tạo bóng rãnh vừa phải.",
        },
    },
    {
        "code": "deep_engrave",
        "title": "Khắc sâu hơn",
        "whenToUse": "Dùng khi rãnh khắc trên model nhìn quá nông.",
        "options": {
            "heightmapBlur": 1.0,
            "normalStrength": 3.5,
            "roughnessBase": 170,
            "roughnessRidge": 245,
            "aoStrength": 0.6,
        },
        "explanation": {
            "heightmapBlur": "Giữ mép rãnh khá sắc.",
            "normalStrength": "Tăng mạnh để rãnh nhìn sâu và rõ hơn.",
            "roughnessBase": "Giữ nền kim loại hơi bóng.",
            "roughnessRidge": "Làm vùng khắc nhám hơn để nhìn thật hơn.",
            "aoStrength": "Tăng bóng tối trong rãnh để tạo cảm giác sâu.",
        },
    },
    {
        "code": "soft_engrave",
        "title": "Khắc mềm hơn",
        "whenToUse": "Dùng khi rãnh nhìn quá gắt, giả hoặc quá sắc.",
        "options": {
            "heightmapBlur": 1.8,
            "normalStrength": 1.6,
            "roughnessBase": 180,
            "roughnessRidge": 220,
            "aoStrength": 0.3,
        },
        "explanation": {
            "heightmapBlur": "Tăng để mép rãnh mềm hơn.",
            "normalStrength": "Giảm để hiệu ứng khắc nhẹ hơn.",
            "roughnessBase": "Giữ nền ở mức nhám vừa.",
            "roughnessRidge": "Vùng khắc nhám nhẹ, không quá tương phản.",
            "aoStrength": "Giảm bóng tối để rãnh dịu hơn.",
        },
    },
    {
        "code": "sharp_detail",
        "title": "Vân sắc nét hơn",
        "whenToUse": "Dùng khi texture trên model bị mờ hoặc vân tay chưa rõ.",
        "options": {
            "heightmapBlur": 0.6,
            "normalStrength": 3.0,
            "roughnessBase": 175,
            "roughnessRidge": 240,
            "aoStrength": 0.5,
        },
        "explanation": {
            "heightmapBlur": "Giảm để mép vân sắc hơn.",
            "normalStrength": "Tăng để vân nổi bật hơn dưới ánh sáng.",
            "roughnessBase": "Giữ nền có độ bóng vừa.",
            "roughnessRidge": "Vùng khắc nhám hơn để tách rõ khỏi nền.",
            "aoStrength": "Tăng bóng rãnh vừa phải.",
        },
    },
    {
        "code": "subtle_luxury",
        "title": "Khắc nhẹ cao cấp",
        "whenToUse": "Dùng khi muốn preview tinh tế, khắc nhẹ, không quá đậm.",
        "options": {
            "heightmapBlur": 1.6,
            "normalStrength": 1.3,
            "roughnessBase": 150,
            "roughnessRidge": 200,
            "aoStrength": 0.25,
        },
        "explanation": {
            "heightmapBlur": "Làm mép rãnh mềm và tự nhiên.",
            "normalStrength": "Giảm để khắc nhẹ hơn.",
            "roughnessBase": "Nền kim loại bóng hơn.",
            "roughnessRidge": "Vùng khắc chỉ nhám nhẹ.",
            "aoStrength": "Bóng rãnh nhẹ, phù hợp preview cao cấp.",
        },
    },
]

SOUNDWAVE_PARAMETER_GUIDE: Dict[str, str] = {
    "style": (
        "Định dạng hình sóng: "
        "`line` (khối đối xứng), `bars` (cột tròn), `filled_bars` (cột vuông), "
        "`outline` (chỉ viền), `center_line` (đường đơn trên), `dots` (chấm), "
        "`steps` (bậc thang), `ridge` (gờ giữa dày theo biên độ)."
    ),
    "samplePoints": (
        "Số điểm lấy mẫu trên đoạn audio. ↑ cao = chi tiết hơn nhưng SVG/texture nặng hơn. "
        "Gợi ý: 128–256 dots/bars, 256–512 steps/filled_bars, 512–1024 line/outline."
    ),
    "normalize": (
        "Chuẩn hóa biên độ về peak ~1 trước khi scale. Bật khi đoạn audio nhỏ/lớn lệch nhiều."
    ),
    "amplitudeScale": (
        "Nhân biên độ sau normalize. ↑ cao = sóng cao/đậm hơn trên preview; "
        "↓ thấp = sóng thấp, khắc nhẹ hơn."
    ),
    "smoothing": (
        "Làm mượt chuỗi điểm (0–1). ↑ cao = sóng mềm, ít răng cưa; "
        "↓ thấp = giữ đỉnh nhọn, chi tiết nhịp."
    ),
    "segmentStartMs": (
        "Vị trí bắt đầu đoạn cắt (ms) trong file gốc. Không nằm trong preset hình — staff chọn đoạn ≤ 3s."
    ),
    "segmentDurationMs": (
        "Độ dài đoạn cắt (ms), tối đa 3000. Không nằm trong preset hình."
    ),
}

SOUNDWAVE_REPROCESS_PRESETS: List[PresetDefinition] = [
    {
        "code": "standard",
        "title": "Chuẩn mặc định (line)",
        "whenToUse": "Dùng khi upload lần đầu / đa số đoạn vocal/melody rõ.",
        "options": {
            "style": "line",
            "samplePoints": 512,
            "normalize": True,
            "amplitudeScale": 1.0,
            "smoothing": 0.0,
        },
        "explanation": {
            "style": "Line khối đối xứng — khắc mượt trên nhẫn.",
            "samplePoints": "512 điểm — cân bằng chi tiết và dung lượng.",
            "normalize": "Bật để biên độ ổn định giữa các file.",
            "amplitudeScale": "Scale 1.0 — độ cao trung bình.",
            "smoothing": "Tắt để giữ đỉnh nhịp gốc.",
        },
    },
    {
        "code": "bars",
        "title": "Cột nhịp (bars)",
        "whenToUse": "Dùng khi muốn nhìn rõ từng nhịp / beat, khắc dạng cột mảnh.",
        "options": {
            "style": "bars",
            "samplePoints": 256,
            "normalize": True,
            "amplitudeScale": 1.1,
            "smoothing": 0.05,
        },
        "explanation": {
            "style": "Bars tròn — đọc nhịp dễ hơn line.",
            "samplePoints": "256 cột — không quá dày trên chu vi nhẫn.",
            "normalize": "Bật để các cột tương đối đều theo peak.",
            "amplitudeScale": "Hơi tăng để cột nổi trên preview.",
            "smoothing": "Làm mượt nhẹ giữa các cột.",
        },
    },
    {
        "code": "filled_bars",
        "title": "Cột vuông đặc",
        "whenToUse": "Dùng khi muốn cột dày, dễ khắc laser/CNC hơn bars mảnh.",
        "options": {
            "style": "filled_bars",
            "samplePoints": 192,
            "normalize": True,
            "amplitudeScale": 1.15,
            "smoothing": 0.08,
        },
        "explanation": {
            "style": "Cột chữ nhật đặc — tương phản mạnh.",
            "samplePoints": "192 — khoảng cách cột rõ.",
            "normalize": "Bật để chiều cao ổn định.",
            "amplitudeScale": "Hơi tăng để cột đậm.",
            "smoothing": "Mượt nhẹ tránh nhảy cột quá mạnh.",
        },
    },
    {
        "code": "outline",
        "title": "Viền sóng (outline)",
        "whenToUse": "Dùng khi muốn khắc nhẹ, chỉ đường viền trên/dưới.",
        "options": {
            "style": "outline",
            "samplePoints": 512,
            "normalize": True,
            "amplitudeScale": 1.0,
            "smoothing": 0.15,
        },
        "explanation": {
            "style": "Hai đường viền đối xứng — không fill khối.",
            "samplePoints": "512 — đường mượt vừa đủ.",
            "normalize": "Giữ biên độ ổn định.",
            "amplitudeScale": "Chuẩn 1.0.",
            "smoothing": "0.15 — viền đỡ răng cưa.",
        },
    },
    {
        "code": "center_line",
        "title": "Đường đơn (center line)",
        "whenToUse": "Dùng khi muốn hình tối giản — một đường theo biên độ phía trên.",
        "options": {
            "style": "center_line",
            "samplePoints": 640,
            "normalize": True,
            "amplitudeScale": 1.2,
            "smoothing": 0.2,
        },
        "explanation": {
            "style": "Polyline đơn — khắc tinh tế.",
            "samplePoints": "640 — chi tiết đường.",
            "normalize": "Bật trước khi scale.",
            "amplitudeScale": "1.2 — đường cao hơn một chút.",
            "smoothing": "0.2 — đường mềm.",
        },
    },
    {
        "code": "dots",
        "title": "Chấm nhịp (dots)",
        "whenToUse": "Dùng khi muốn texture dạng hạt / chấm theo biên độ.",
        "options": {
            "style": "dots",
            "samplePoints": 160,
            "normalize": True,
            "amplitudeScale": 1.25,
            "smoothing": 0.1,
        },
        "explanation": {
            "style": "Chấm đối xứng theo biên độ.",
            "samplePoints": "160 — chấm không bị dính nhau.",
            "normalize": "Bật để phân bố đều.",
            "amplitudeScale": "1.25 — tách chấm rõ hơn.",
            "smoothing": "Nhẹ để tránh nhiễu vị trí.",
        },
    },
    {
        "code": "steps",
        "title": "Bậc thang (steps)",
        "whenToUse": "Dùng khi muốn sóng dạng block / pixel, khác line mượt.",
        "options": {
            "style": "steps",
            "samplePoints": 128,
            "normalize": True,
            "amplitudeScale": 1.1,
            "smoothing": 0.0,
        },
        "explanation": {
            "style": "Khối bậc thang đối xứng.",
            "samplePoints": "128 — bậc rõ, không quá mảnh.",
            "normalize": "Bật để chiều cao bậc ổn định.",
            "amplitudeScale": "Hơi tăng để bậc nổi.",
            "smoothing": "Tắt — giữ cạnh vuông.",
        },
    },
    {
        "code": "ridge",
        "title": "Gờ giữa (ridge)",
        "whenToUse": "Dùng khi muốn đường khắc giữa nhẫn, dày theo biên độ âm.",
        "options": {
            "style": "ridge",
            "samplePoints": 384,
            "normalize": True,
            "amplitudeScale": 1.35,
            "smoothing": 0.2,
        },
        "explanation": {
            "style": "Gờ ngang giữa — độ dày = biên độ.",
            "samplePoints": "384 — biến thiên độ dày mượt.",
            "normalize": "Bật trước khi phóng độ dày.",
            "amplitudeScale": "1.35 — gờ đậm hơn.",
            "smoothing": "0.2 — tránh nhảy độ dày đột ngột.",
        },
    },
    {
        "code": "smooth_wave",
        "title": "Sóng mượt (line)",
        "whenToUse": "Dùng khi waveform răng cưa / nhiễu, muốn khắc mềm mại.",
        "options": {
            "style": "line",
            "samplePoints": 384,
            "normalize": True,
            "amplitudeScale": 1.0,
            "smoothing": 0.35,
        },
        "explanation": {
            "style": "Line — đường liên tục sau khi mượt.",
            "samplePoints": "384 — đủ mượt, không quá nặng.",
            "normalize": "Giữ biên độ ổn định.",
            "amplitudeScale": "Giữ độ cao chuẩn.",
            "smoothing": "0.35 — giảm răng cưa rõ rệt.",
        },
    },
    {
        "code": "detailed",
        "title": "Giữ nhiều chi tiết (line)",
        "whenToUse": "Dùng khi đoạn audio phức tạp, muốn giữ đỉnh/nhịp nhỏ.",
        "options": {
            "style": "line",
            "samplePoints": 1024,
            "normalize": True,
            "amplitudeScale": 1.0,
            "smoothing": 0.0,
        },
        "explanation": {
            "style": "Line với mật độ điểm cao.",
            "samplePoints": "1024 — chi tiết tối đa trong giới hạn hợp lý.",
            "normalize": "Bật để so sánh biên độ công bằng.",
            "amplitudeScale": "Không phóng đại thêm.",
            "smoothing": "Tắt để không mất đỉnh nhỏ.",
        },
    },
    {
        "code": "bold",
        "title": "Sóng đậm / cao hơn (line)",
        "whenToUse": "Dùng khi preview quá thấp/mảnh, cần khắc nổi hơn.",
        "options": {
            "style": "line",
            "samplePoints": 512,
            "normalize": True,
            "amplitudeScale": 1.6,
            "smoothing": 0.1,
        },
        "explanation": {
            "style": "Line đậm hơn nhờ amplitudeScale.",
            "samplePoints": "512 — giữ cân bằng mặc định.",
            "normalize": "Bật trước khi scale lên.",
            "amplitudeScale": "1.6 — sóng cao/đậm trên preview.",
            "smoothing": "0.1 — tránh răng cưa khi phóng biên độ.",
        },
    },
]

_REPROCESS_BY_CODE: Dict[str, PresetDefinition] = {p["code"]: p for p in REPROCESS_PRESETS}
_SOUNDWAVE_BY_CODE: Dict[str, PresetDefinition] = {
    p["code"]: p for p in SOUNDWAVE_REPROCESS_PRESETS
}
_TEXTURE_BY_CODE: Dict[str, PresetDefinition] = {p["code"]: p for p in TEXTURE_PRESETS}


def resolve_preset(name: Optional[str]) -> Dict[str, Any]:
    """Return mergeable OpenCV/potrace options for fingerprint /reprocess."""
    if not name:
        return {}
    key = name.strip().lower()
    preset = _REPROCESS_BY_CODE.get(key)
    if preset is None:
        allowed = ", ".join(sorted(_REPROCESS_BY_CODE))
        raise ValueError(f"Unknown preset '{name}'. Allowed: {allowed}.")
    return {**preset["options"], "outputSvg": True}


def resolve_soundwave_preset(name: Optional[str]) -> Dict[str, Any]:
    """Return mergeable waveform options for soundwave process/reprocess."""
    if not name:
        return {}
    key = name.strip().lower()
    preset = _SOUNDWAVE_BY_CODE.get(key)
    if preset is None:
        allowed = ", ".join(sorted(_SOUNDWAVE_BY_CODE))
        raise ValueError(f"Unknown soundwave preset '{name}'. Allowed: {allowed}.")
    return dict(preset["options"])


def default_soundwave_options_dict() -> Dict[str, Any]:
    """Standard preset options used by POST /soundwave/process."""
    return dict(_SOUNDWAVE_BY_CODE["standard"]["options"])


def get_texture_preset(name: str) -> PresetDefinition:
    key = name.strip().lower()
    preset = _TEXTURE_BY_CODE.get(key)
    if preset is None:
        allowed = ", ".join(sorted(_TEXTURE_BY_CODE))
        raise ValueError(f"Unknown texture preset '{name}'. Allowed: {allowed}.")
    return preset


def default_texture_options() -> Dict[str, Any]:
    """Base texture options (realistic_default)."""
    return dict(_TEXTURE_BY_CODE["realistic_default"]["options"])


def resolve_texture_options(
    preset: Optional[str] = None,
    overrides: Optional[Dict[str, Any]] = None,
) -> tuple[Optional[str], Dict[str, Any]]:
    """
    Merge texture options: realistic_default base → preset → explicit overrides.
    Returns (applied_preset_code, merged_options).
    Shared by fingerprint and soundwave reprocess-texture.
    """
    merged = default_texture_options()
    applied_preset: Optional[str] = None

    if preset:
        applied_preset = preset.strip().lower()
        merged.update(get_texture_preset(applied_preset)["options"])

    if overrides:
        for key in (
            "heightmapBlur",
            "normalStrength",
            "roughnessBase",
            "roughnessRidge",
            "aoStrength",
        ):
            if overrides.get(key) is not None:
                merged[key] = overrides[key]

    return applied_preset, merged


def texture_presets_options_map() -> Dict[str, Dict[str, Any]]:
    """Flat map code → options for GET /texture-presets."""
    return {p["code"]: dict(p["options"]) for p in TEXTURE_PRESETS}
