import json
import logging
import sys
import time
import warnings

warnings.filterwarnings(
    "ignore",
    message="Api key is used with an insecure connection",
)

import pika
from pydantic import ValidationError

from shared.nest_log import setup_logging

from .config import settings
from .connection_check import run_startup_checks
from .job_processor import process_rabbitmq_job
from .rabbitmq_status import RabbitMQStatusPublisher
from .schemas import RabbitMQIngestionJob

logger = setup_logging("WORKER")

ROUTING_KEY_INGEST = "document.ingestion.requested"
ROUTING_KEY_REINDEX = "document.ingestion.reindex"
ROUTING_KEY_DELETE_VECTORS = "document.vectors.delete"
ROUTING_KEY_STATUS = "document.ingestion.status"
ROUTING_KEY_FAILED = "document.ingestion.failed"


def setup_channel(channel) -> None:
    channel.exchange_declare(
        exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
        exchange_type="direct",
        durable=True,
    )

    channel.exchange_declare(
        exchange=settings.RABBITMQ_INGESTION_DLX,
        exchange_type="direct",
        durable=True,
    )

    channel.queue_declare(
        queue=settings.RABBITMQ_INGESTION_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": settings.RABBITMQ_INGESTION_DLX,
            "x-dead-letter-routing-key": ROUTING_KEY_FAILED,
        },
    )

    channel.queue_declare(queue=settings.RABBITMQ_INGESTION_DLQ, durable=True)
    channel.queue_declare(queue=settings.RABBITMQ_STATUS_QUEUE, durable=True)

    channel.queue_bind(
        queue=settings.RABBITMQ_INGESTION_QUEUE,
        exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
        routing_key=ROUTING_KEY_INGEST,
    )
    channel.queue_bind(
        queue=settings.RABBITMQ_INGESTION_QUEUE,
        exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
        routing_key=ROUTING_KEY_REINDEX,
    )
    channel.queue_bind(
        queue=settings.RABBITMQ_INGESTION_QUEUE,
        exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
        routing_key=ROUTING_KEY_DELETE_VECTORS,
    )
    channel.queue_bind(
        queue=settings.RABBITMQ_STATUS_QUEUE,
        exchange=settings.RABBITMQ_INGESTION_EXCHANGE,
        routing_key=ROUTING_KEY_STATUS,
    )
    channel.queue_bind(
        queue=settings.RABBITMQ_INGESTION_DLQ,
        exchange=settings.RABBITMQ_INGESTION_DLX,
        routing_key=ROUTING_KEY_FAILED,
    )

    # One heavy PDF job at a time for each worker process.
    channel.basic_qos(prefetch_count=1)


def publish_failed_status_if_possible(
    status_publisher: RabbitMQStatusPublisher,
    job: RabbitMQIngestionJob | None,
    error_message: str,
) -> None:
    if job is None:
        return

    try:
        status_publisher.publish_status(
            job=job,
            status="FAILED",
            progress=0,
            message="Document ingestion failed.",
            error_message=error_message,
        )
    except Exception as exc:
        logger.error("failed to publish FAILED status: %s", exc, exc_info=True)


def handle_message(channel, method, properties, body: bytes) -> None:
    status_publisher = RabbitMQStatusPublisher(channel)
    job: RabbitMQIngestionJob | None = None

    try:
        payload = json.loads(body.decode("utf-8"))
        job = RabbitMQIngestionJob(**payload)

        logger.info(
            "job received id=%s type=%s document=%s",
            job.jobId,
            job.jobType,
            job.documentId,
        )

        process_rabbitmq_job(job, status_publisher)

        channel.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("job done id=%s type=%s", job.jobId, job.jobType)

    except ValidationError as exc:
        error_message = f"Invalid job payload: {exc}"
        logger.error(error_message)
        publish_failed_status_if_possible(status_publisher, job, error_message)
        channel.basic_nack(delivery_tag=method.delivery_tag, multiple=False, requeue=False)

    except Exception as exc:
        error_message = str(exc)
        logger.error(
            "job failed id=%s error=%s",
            getattr(job, "jobId", None),
            error_message,
            exc_info=True,
        )
        publish_failed_status_if_possible(status_publisher, job, error_message)
        channel.basic_nack(delivery_tag=method.delivery_tag, multiple=False, requeue=False)


def run_worker() -> None:
    run_startup_checks()

    while True:
        connection = None
        try:
            parameters = pika.URLParameters(settings.RABBITMQ_URL)
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            setup_channel(channel)

            channel.basic_consume(
                queue=settings.RABBITMQ_INGESTION_QUEUE,
                on_message_callback=handle_message,
                auto_ack=False,
            )

            logger.info(
                "listening queue=%s exchange=%s",
                settings.RABBITMQ_INGESTION_QUEUE,
                settings.RABBITMQ_INGESTION_EXCHANGE,
            )
            channel.start_consuming()

        except KeyboardInterrupt:
            logger.info("worker stopped by user")
            try:
                if connection:
                    connection.close()
            except Exception:
                pass
            sys.exit(0)

        except Exception as exc:
            logger.error("RabbitMQ connection error: %s", exc, exc_info=True)
            logger.info("reconnecting in 5 seconds...")
            time.sleep(5)


if __name__ == "__main__":
    run_worker()
