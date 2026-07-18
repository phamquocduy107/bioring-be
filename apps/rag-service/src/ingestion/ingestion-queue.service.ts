import {
  INGESTION_ROUTING_KEYS,
  normalizeDocumentType,
  normalizeRetrievalTypes,
  type IngestionJobPayload,
  type IngestionJobType,
  type IngestionStatusEvent,
  mapIngestionWorkerStatusToDb,
} from '@app/common';
import { PrismaService } from '@app/prisma';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { knowledge_documents } from '@prisma/client';
import amqp, { type Channel, type Connection } from 'amqplib';
import { randomUUID } from 'node:crypto';

@Injectable()
export class IngestionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionQueueService.name);
  private connection?: Connection;
  private channel?: Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  async publishIngestJob(document: knowledge_documents) {
    await this.publishJob('INGEST', INGESTION_ROUTING_KEYS.INGEST, document);
  }

  async publishReindexJob(document: knowledge_documents) {
    await this.publishJob(
      'REINDEX',
      INGESTION_ROUTING_KEYS.REINDEX,
      document,
    );
  }

  async publishDeleteVectorsJob(document: knowledge_documents) {
    await this.publishJob(
      'DELETE_VECTORS',
      INGESTION_ROUTING_KEYS.DELETE_VECTORS,
      document,
    );
  }

  private async publishJob(
    jobType: IngestionJobType,
    routingKey: string,
    document: knowledge_documents,
  ) {
    const channel = await this.ensureChannel();
    const payload = this.buildJobPayload(jobType, document);

    const published = channel.publish(
      this.getExchange(),
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: payload.jobId,
      },
    );

    if (!published) {
      await new Promise<void>((resolve) => channel.once('drain', resolve));
    }

    this.logger.log(
      `Published ${jobType} job=${payload.jobId} document=${document.id} routingKey=${routingKey}`,
    );
  }

  private buildJobPayload(
    jobType: IngestionJobType,
    document: knowledge_documents,
  ): IngestionJobPayload {
    const payload: IngestionJobPayload = {
      jobId: randomUUID(),
      jobType,
      documentId: document.id,
      workspaceId: document.workspace_id,
      userId: document.user_id,
      createdAt: new Date().toISOString(),
    };

    if (jobType === 'INGEST' || jobType === 'REINDEX') {
      payload.bucket = this.configService.get<string>(
        'MINIO_BUCKET',
        'knowledge-documents',
      );
      payload.objectName = document.storage_key;
      payload.originalName = document.original_name;

      // Gửi type từ DB xuống worker để gắn metadata chunk cho Qdrant filter.
      // Job cũ/DB thiếu type vẫn được chuẩn hóa (general) để worker không crash.
      const documentType = normalizeDocumentType(document.document_type);
      payload.documentType = documentType;
      payload.retrievalTypes = normalizeRetrievalTypes(
        Array.isArray(document.retrieval_types)
          ? (document.retrieval_types as unknown[]).map((item) => String(item))
          : [],
        documentType,
      );
    }

    return payload;
  }

  private async handleStatusEvent(raw: unknown) {
    const event = raw as IngestionStatusEvent;
    if (!event?.documentId || !event?.status) {
      this.logger.warn('Ignored invalid ingestion status event');
      return;
    }

    const dbStatus = mapIngestionWorkerStatusToDb(event.status);
    if (!dbStatus) {
      return;
    }

    const updated = await this.prisma.knowledge_documents.updateMany({
      where: { id: event.documentId },
      data: {
        status: dbStatus,
        ...(event.chunkCount !== undefined
          ? { chunk_count: event.chunkCount }
          : {}),
        ...(event.errorMessage !== undefined
          ? { error_message: event.errorMessage || null }
          : dbStatus === 'COMPLETED'
            ? { error_message: null }
            : {}),
      },
    });

    if (updated.count === 0) {
      this.logger.debug(
        `No document updated for status event document=${event.documentId}`,
      );
      return;
    }

    this.logger.log(
      `Updated document=${event.documentId} status=${dbStatus} progress=${event.progress ?? 'n/a'}`,
    );
  }

  private getRabbitMqUri(): string {
    const user = this.configService.get<string>('RABBITMQ_USER');
    const pass = this.configService.get<string>('RABBITMQ_PASS');
    const host = this.configService.get<string>('RABBITMQ_HOST');
    const port = this.configService.get<string>('RABBITMQ_PORT');
    const vhost = this.configService.get<string>('RABBITMQ_VHOST');

    if (!user || !pass || !host || !port || !vhost) {
      throw new Error('Missing RabbitMQ configuration in .env file');
    }

    return `amqp://${user}:${pass}@${host}:${port}/${encodeURIComponent(vhost)}`;
  }

  private getExchange(): string {
    return this.configService.get<string>(
      'RABBITMQ_INGESTION_EXCHANGE',
      'rag.ingestion.exchange',
    );
  }

  private getIngestionQueue(): string {
    return this.configService.get<string>(
      'RABBITMQ_INGESTION_QUEUE',
      'rag.ingestion.jobs',
    );
  }

  private getStatusQueue(): string {
    return this.configService.get<string>(
      'RABBITMQ_STATUS_QUEUE',
      'rag.ingestion.status',
    );
  }

  private getDlxExchange(): string {
    return this.configService.get<string>(
      'RABBITMQ_INGESTION_DLX',
      'rag.ingestion.dlx',
    );
  }

  private getDlq(): string {
    return this.configService.get<string>(
      'RABBITMQ_INGESTION_DLQ',
      'rag.ingestion.dlq',
    );
  }

  private async connect() {
    try {
      this.connection = await amqp.connect(this.getRabbitMqUri());
      this.channel = await this.connection.createChannel();
      await this.setupTopology(this.channel);
      await this.startStatusConsumer(this.channel);
      this.logger.log('Connected to RabbitMQ ingestion exchange');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect RabbitMQ ingestion: ${message}`);
      throw error;
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }
    await this.connect();
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }
    return this.channel;
  }

  private async setupTopology(channel: Channel) {
    const exchange = this.getExchange();
    const dlxExchange = this.getDlxExchange();
    const ingestionQueue = this.getIngestionQueue();
    const statusQueue = this.getStatusQueue();
    const dlq = this.getDlq();

    await channel.assertExchange(exchange, 'direct', { durable: true });
    await channel.assertExchange(dlxExchange, 'direct', { durable: true });

    await channel.assertQueue(ingestionQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxExchange,
        'x-dead-letter-routing-key': INGESTION_ROUTING_KEYS.FAILED,
      },
    });
    await channel.assertQueue(statusQueue, { durable: true });
    await channel.assertQueue(dlq, { durable: true });

    await channel.bindQueue(
      ingestionQueue,
      exchange,
      INGESTION_ROUTING_KEYS.INGEST,
    );
    await channel.bindQueue(
      ingestionQueue,
      exchange,
      INGESTION_ROUTING_KEYS.REINDEX,
    );
    await channel.bindQueue(
      ingestionQueue,
      exchange,
      INGESTION_ROUTING_KEYS.DELETE_VECTORS,
    );
    await channel.bindQueue(statusQueue, exchange, INGESTION_ROUTING_KEYS.STATUS);
    await channel.bindQueue(dlq, dlxExchange, INGESTION_ROUTING_KEYS.FAILED);
  }

  private async startStatusConsumer(channel: Channel) {
    const statusQueue = this.getStatusQueue();

    await channel.consume(
      statusQueue,
      (message) => {
        void (async () => {
          if (!message) {
            return;
          }

          try {
            const payload = JSON.parse(
              message.content.toString('utf-8'),
            ) as IngestionStatusEvent;
            await this.handleStatusEvent(payload);
            channel.ack(message);
          } catch (error) {
            const messageText =
              error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to process ingestion status event: ${messageText}`,
            );
            channel.nack(message, false, false);
          }
        })();
      },
      { noAck: false },
    );

    this.logger.log(`Consuming ingestion status queue: ${statusQueue}`);
  }

  private async close() {
    try {
      await this.channel?.close();
    } catch {
      // ignore close errors during shutdown
    }
    try {
      await this.connection?.close();
    } catch {
      // ignore close errors during shutdown
    }
    this.channel = undefined;
    this.connection = undefined;
  }
}
