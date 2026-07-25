import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  UpdateQrMemoryDto,
  ActivateQrMemoryDto,
  QrMemoryUpdateResponse,
  QrMemoryActivateResponse,
  QrMemoryListResponse,
  QrMemoryUploadPhotoResponse,
  QrMemoryResponse,
} from '@app/common';

export function ApiUpdateQrMemoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update QR memory card',
      description:
        'Update cardTitle, greetingMessage, recipientEmail for a memory card.',
    }),
    ApiParam({ name: 'engravingId', type: 'string', format: 'uuid' }),
    ApiBody({ type: UpdateQrMemoryDto }),
    ApiOkResponse({ type: QrMemoryUpdateResponse }),
  );
}

export function ApiGetQrMemoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get QR memory by engraving ID',
      description: 'Retrieve memory card details for a specific engraving.',
    }),
    ApiParam({ name: 'engravingId', type: 'string', format: 'uuid' }),
    ApiOkResponse({ type: QrMemoryUpdateResponse }),
  );
}

export function ApiActivateQrMemoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Activate QR memory',
      description:
        'Unlock memory card by providing qrCode and accessPin. Public endpoint — no auth required.',
    }),
    ApiBody({ type: ActivateQrMemoryDto }),
    ApiCreatedResponse({ type: QrMemoryActivateResponse }),
  );
}

export function ApiListQrMemoriesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List my QR memories',
      description: 'List all memory cards belonging to the authenticated user.',
    }),
    ApiQuery({ name: 'page', type: 'number', required: false, example: 1 }),
    ApiQuery({ name: 'limit', type: 'number', required: false, example: 10 }),
    ApiOkResponse({ type: QrMemoryListResponse }),
  );
}

export function ApiGetQrMemoryByCodeDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get QR memory by QR code',
      description:
        'Public endpoint — retrieve memory card details by scanning QR code.',
    }),
    ApiParam({ name: 'qrCode', type: 'string', description: 'QR code value (12 hex chars)' }),
    ApiOkResponse({ type: QrMemoryUpdateResponse }),
  );
}

export function ApiUploadPhotoDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upload photo for memory card',
      description: 'Upload a photo to S3, returns public URL.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Image file (jpg, png, webp)',
          },
        },
      },
    }),
    ApiCreatedResponse({ type: QrMemoryUploadPhotoResponse }),
  );
}
