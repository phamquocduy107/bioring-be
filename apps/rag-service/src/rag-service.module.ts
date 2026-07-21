import { MinioModule } from '@app/minio';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  CommonModule,
  CustomValidationPipe,
  FitRpcExceptionFilter,
  LoggingInterceptor,
  TimeoutInterceptor,
} from '@app/common';
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';

/**
 * Root rag-service.
 *
 * Feature modules:
 * - documents  : upload / CRUD document metadata + MinIO
 * - ingestion  : publish RabbitMQ jobs cho Python worker
 * - chat       : counsel chat → CatalogModule + RagEngineModule
 */
@Module({
  imports: [
    CommonModule,
    MinioModule,
    DocumentsModule,
    IngestionModule,
    ChatModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: FitRpcExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class RagServiceModule {}
