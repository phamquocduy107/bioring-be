import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
)


def upload_to_cloudinary(svg_content: str, public_id: str) -> str:
    if not cloudinary.config().cloud_name:
        return f"https://cdn.bioring.com/waveforms/{public_id}.svg"

    try:
        result = cloudinary.uploader.upload(
            f"data:image/svg+xml;base64,{__import__('base64').b64encode(svg_content.encode()).decode()}",
            public_id=public_id,
            folder="waveforms",
            overwrite=True,
            resource_type="image",
        )
        return result.get("secure_url", "")
    except Exception as e:
        raise RuntimeError(f"Cloudinary upload failed: {e}")
