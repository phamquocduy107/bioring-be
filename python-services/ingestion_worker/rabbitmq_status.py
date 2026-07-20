import json
from datetime import datetime, timezone
from typing import Optional

import pika

from .config import settings
from .schemas import RabbitMQIngestionJob

ROUTING_KEY_STATUS = "document.ingestion.status"


class RabbitMQStatusPublisher:
    """Publish document ingestion progress/status events back to RabbitMQ."""

    def __init__(self, channel) -> None:
        self.channel = channel

    def publish_status(
        self,
        job: RabbitMQIngestionJob,
        status: str,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        error_message: Optional[str] = None,
        chunk_count: Optional[int] = None,
    ) -> None:
        event: dict = {
            "jobId": job.jobId,
            "jobType": job.jobType,
            "documentId": job.documentId,
            "workspaceId": job.workspaceId,
            "status": status,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        if progress is not None:
            event["progress"] = progress
        if message is not None:
            event["message"] = message
        if error_message is not None:
            event["errorMessage"] = error_message
        if chunk_count is not None:
            event["chunkCount"] = chunk_count

        self.channel.basic_publish(
            exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
            routing_key=ROUTING_KEY_STATUS,
            body=json.dumps(event, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=2,  # persistent
                content_type="application/json",
                message_id=job.jobId,
            ),
        )
