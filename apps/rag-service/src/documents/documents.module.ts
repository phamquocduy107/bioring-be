import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { StorageModule } from '../storage/storage.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/** Document metadata (Postgres) + file object (MinIO). Trigger ingestion enqueue. */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => IngestionModule),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
