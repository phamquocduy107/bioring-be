import { KNOWLEDGE_MAX_UPLOAD_BYTES, type JwtPayload } from '@app/common';
import { CurrentUser } from '@app/common';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KnowledgeService } from '../knowledge.service';
import {
  ApiDeleteDocumentDocs,
  ApiFindAllDocumentsDocs,
  ApiFindOneDocumentDocs,
  ApiGetDocumentStatusDocs,
  ApiReindexDocumentDocs,
  ApiRetryIngestionDocs,
  ApiUploadDocumentDocs,
} from './documents.swagger';

interface UploadedPdfFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Knowledge - Documents')
@ApiBearerAuth('access-token')
@Controller('knowledge/documents')
export class DocumentsController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('upload')
  @ApiUploadDocumentDocs()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: KNOWLEDGE_MAX_UPLOAD_BYTES },
    }),
  )
  uploadDocument(
    @UploadedFile() file: UploadedPdfFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    return this.knowledgeService.uploadDocument(user.sub, file);
  }

  @Get()
  @ApiFindAllDocumentsDocs()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.knowledgeService.findAllDocuments(user.sub);
  }

  @Get(':id')
  @ApiFindOneDocumentDocs()
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.findOneDocument(user.sub, id);
  }

  @Get(':id/status')
  @ApiGetDocumentStatusDocs()
  getStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.getDocumentStatus(user.sub, id);
  }

  @Delete(':id')
  @ApiDeleteDocumentDocs()
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.deleteDocument(user.sub, id);
  }

  @Post(':id/retry')
  @ApiRetryIngestionDocs()
  retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.retryIngestion(user.sub, id);
  }

  @Post(':id/reindex')
  @ApiReindexDocumentDocs()
  reindex(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.knowledgeService.reindexDocument(user.sub, id);
  }
}
