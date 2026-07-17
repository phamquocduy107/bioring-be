import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DocumentsService } from './documents.service';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @GrpcMethod('KnowledgeService', 'UploadDocument')
  uploadDocument(data: {
    userId: string;
    workspaceId: string;
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    };
    documentType?: string;
    retrievalTypes?: string[];
  }) {
    return this.documentsService.uploadDocument(data);
  }

  @GrpcMethod('KnowledgeService', 'FindAllDocuments')
  findAllDocuments(data: { userId: string; workspaceId: string }) {
    return this.documentsService.findAll(data);
  }

  @GrpcMethod('KnowledgeService', 'FindOneDocument')
  findOneDocument(data: { userId: string; documentId: string }) {
    return this.documentsService.findOne(data);
  }

  @GrpcMethod('KnowledgeService', 'GetDocumentStatus')
  getDocumentStatus(data: { userId: string; documentId: string }) {
    return this.documentsService.getStatus(data);
  }

  @GrpcMethod('KnowledgeService', 'DeleteDocument')
  deleteDocument(data: { userId: string; documentId: string }) {
    return this.documentsService.delete(data);
  }
}
