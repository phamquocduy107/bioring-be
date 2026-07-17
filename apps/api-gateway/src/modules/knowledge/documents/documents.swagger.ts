import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';

const documentExample = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  workspaceId: 'bioring-catalog',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  originalName: 'company-policy.pdf',
  mimetype: 'application/pdf',
  size: 1048576,
  status: 'PENDING',
  createdAt: '2026-07-10T02:00:00.000Z',
  updatedAt: '2026-07-10T02:00:00.000Z',
};

const documentStatusExample = {
  documentId: '550e8400-e29b-41d4-a716-446655440001',
  status: 'PROCESSING',
  errorMessage: '',
  chunkCount: 12,
  updatedAt: '2026-07-10T02:05:00.000Z',
};

export function ApiUploadDocumentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Upload PDF document',
      description:
        'Upload tài liệu PDF. workspaceId được gán tự động phía server (KNOWLEDGE_DEFAULT_WORKSPACE_ID).',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'PDF file',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Document uploaded successfully.',
      schema: { example: { document: documentExample } },
    }),
    ApiResponse({ status: 400, description: 'Missing file or invalid PDF' }),
    ApiAuthFailures(),
  );
}

export function ApiFindAllDocumentsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List documents',
      description:
        'Lấy danh sách tài liệu trong workspace mặc định của hệ thống.',
    }),
    ApiResponse({
      status: 200,
      description: 'List of documents.',
      schema: {
        example: {
          documents: [documentExample],
        },
      },
    }),
    ApiAuthFailures(),
  );
}

export function ApiFindOneDocumentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get document detail',
      description: 'Lấy chi tiết một tài liệu theo ID.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Document detail.',
      schema: { example: { document: documentExample } },
    }),
    ApiResponse({ status: 404, description: 'Document not found' }),
    ApiAuthFailures(),
  );
}

export function ApiGetDocumentStatusDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get document ingestion status',
      description:
        'Kiểm tra trạng thái xử lý tài liệu (PENDING, PROCESSING, COMPLETED, FAILED, ...).',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Document ingestion status.',
      schema: { example: documentStatusExample },
    }),
    ApiResponse({ status: 404, description: 'Document not found' }),
    ApiAuthFailures(),
  );
}

export function ApiDeleteDocumentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Delete document',
      description: 'Xóa tài liệu và dữ liệu ingestion liên quan.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Document deleted.',
      schema: { example: { success: true } },
    }),
    ApiResponse({ status: 404, description: 'Document not found' }),
    ApiAuthFailures(),
  );
}

export function ApiRetryIngestionDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Retry document ingestion',
      description: 'Thử lại quá trình ingestion cho tài liệu bị lỗi.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Ingestion retry triggered.',
      schema: {
        example: {
          document: { ...documentExample, status: 'PENDING' },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Document not found' }),
    ApiAuthFailures(),
  );
}

export function ApiReindexDocumentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Reindex document',
      description: 'Chạy lại quá trình chunking và embedding cho tài liệu.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Reindex triggered.',
      schema: {
        example: {
          document: { ...documentExample, status: 'REINDEXING' },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Document not found' }),
    ApiAuthFailures(),
  );
}
