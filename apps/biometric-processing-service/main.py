import os
from pathlib import Path
from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from audio_processor import process_audio
from cloudinary_uploader import upload_to_cloudinary

load_dotenv(Path(__file__).parent.parent.parent / '.env')

app = FastAPI(title="Bioring Biometric Processing Service")


class ProcessAudioRequest(BaseModel):
    audioUrl: str
    engravingVersionId: str


class ProcessAudioResponse(BaseModel):
    waveformUrl: str
    durationMs: int


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/process-audio", response_model=ProcessAudioResponse)
async def process_audio_endpoint(req: ProcessAudioRequest):
    print(f"[AudioProcessing] Received: engravingVersionId={req.engravingVersionId}, audioUrl={req.audioUrl}")
    if not req.audioUrl:
        raise HTTPException(status_code=400, detail="audioUrl is required")

    try:
        svg_content, duration_ms = process_audio(req.audioUrl)
        waveform_url = upload_to_cloudinary(
            svg_content,
            f"waveform_{req.engravingVersionId}",
        )
        return ProcessAudioResponse(
            waveformUrl=waveform_url,
            durationMs=duration_ms,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


if __name__ == "__main__":
    port = int(os.getenv("BIOMETRIC_PROCESSING_PORT", "5051"))
    uvicorn.run(app, host="0.0.0.0", port=port)
