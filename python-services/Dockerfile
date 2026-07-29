# BIORING Python services — single image, multiple commands (rag / worker / personalization)
# Build:  docker build -t kietmn/bioring-python:latest -f python-services/Dockerfile python-services
# Run:    see deploy/compose.yaml

FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_HOME=/app \
    PERSONALIZATION_TEMP_DIR=/tmp/personalization \
    TEMP_DIR=/tmp/knowledge-documents \
    FFMPEG_BINARY=ffmpeg \
    POTRACE_PATH=/usr/bin/potrace

WORKDIR ${APP_HOME}

# System deps: OpenCV runtime, FFmpeg (soundwave), Potrace (fingerprint SVG), curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ffmpeg \
      potrace \
      libglib2.0-0 \
      libgl1 \
      libsm6 \
      libxext6 \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/personalization /tmp/knowledge-documents

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY rag_engine ./rag_engine
COPY ingestion_worker ./ingestion_worker
COPY personalization_engine ./personalization_engine
COPY shared ./shared

# Default = RAG; compose overrides command per service
EXPOSE 8000 8010
CMD ["uvicorn", "rag_engine.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
