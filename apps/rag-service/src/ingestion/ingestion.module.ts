import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionController } from './ingestion.controller';
import { IngestionQueueService } from './ingestion-queue.service';
import { IngestionService } from './ingestion.service';

/** Publish / retry / reindex jobs lên RabbitMQ cho Python ingestion_worker. */
@Module({
  imports: [PrismaModule, forwardRef(() => DocumentsModule)],
  controllers: [IngestionController],
  providers: [IngestionQueueService, IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
