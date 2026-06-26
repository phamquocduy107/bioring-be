import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  UpdateQrMemoryDto,
  ActivateQrMemoryDto,
  QrMemoryUpdateResponse,
  QrMemoryActivateResponse,
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
