import urllib.request
import numpy as np
import cv2
from skimage import morphology
import svgwrite


def process_fingerprint(image_url: str, width: int = 400, height: int = 400) -> str:
    # 1. Download image
    try:
        response = urllib.request.urlopen(image_url, timeout=30)
        img_bytes = np.frombuffer(response.read(), np.uint8)
    except Exception as e:
        raise ValueError(f"Failed to download fingerprint from {image_url}: {e}")

    # 2. Decode + grayscale
    img = cv2.imdecode(img_bytes, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Failed to decode fingerprint image")

    # 3. Resize to standard size
    img = cv2.resize(img, (width, height))

    # 4. Enhance contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(img)

    # 5. Denoise
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)

    # 6. Binary threshold (Otsu)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 7. Morphological cleanup — remove small dots, close gaps
    kernel = np.ones((2, 2), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)

    # 8. Skeletonize — thin ridges to 1px
    skeleton = morphology.skeletonize(cleaned.astype(bool)).astype(np.uint8) * 255

    # 9. Find contours
    contours, _ = cv2.findContours(skeleton, cv2.RETR_LIST, cv2.CHAIN_APPROX_TC89_KCOS)

    # 10. Generate SVG
    dwg = svgwrite.Drawing(size=(width, height))
    dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill="none"))

    for contour in contours:
        # Simplify contour (Douglas-Peucker)
        epsilon = 0.5
        simplified = cv2.approxPolyDP(contour, epsilon, closed=False)

        if len(simplified) < 4:
            continue

        # Build SVG path from contour points
        path_data = f"M {simplified[0][0][0]} {simplified[0][0][1]}"
        for point in simplified[1:]:
            path_data += f" L {point[0][0]} {point[0][1]}"

        dwg.add(
            dwg.path(
                d=path_data,
                fill="none",
                stroke="#333333",
                stroke_width=0.8,
                stroke_linecap="round",
                stroke_linejoin="round",
            )
        )

    return dwg.tostring()
