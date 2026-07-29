import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
} from '@nestjs/swagger';

export function ApiUploadWarrantyProofDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upload warranty proof file (image/video)',
      description:
        'Upload a proof image or video to MinIO, returns public URL. Accepted: image/jpeg, image/png, image/webp (max 10MB), video/mp4, video/quicktime (max 50MB).',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Proof file (image or video)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', example: 'https://minio.bioring.vn/warranty-proofs/uuid.jpg' },
        },
      },
    }),
  );
}
