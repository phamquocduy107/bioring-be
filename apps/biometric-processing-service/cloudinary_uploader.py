import os
import cloudinary
import cloudinary.uploader


def upload_to_cloudinary(svg_content: str, public_id: str) -> str:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
        api_key=os.getenv("CLOUDINARY_API_KEY", ""),
        api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
    )

    cloud_name = cloudinary.config().cloud_name
    print(f"[Cloudinary] Config: cloud_name={cloud_name}, api_key={'***' if cloudinary.config().api_key else 'empty'}")

    if not cloud_name:
        raise RuntimeError(
            "Cloudinary not configured: missing CLOUDINARY_CLOUD_NAME. "
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
        )

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
