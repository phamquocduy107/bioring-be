import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';

/** Shared MinIO client cho documents. */
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
