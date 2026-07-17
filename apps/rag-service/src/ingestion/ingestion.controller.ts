import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { IngestionService } from './ingestion.service';

@Controller()
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @GrpcMethod('KnowledgeService', 'RetryIngestion')
  retryIngestion(data: { userId: string; documentId: string }) {
    return this.ingestionService.retry(data);
  }

  @GrpcMethod('KnowledgeService', 'ReindexDocument')
  reindexDocument(data: { userId: string; documentId: string }) {
    return this.ingestionService.reindex(data);
  }
}
