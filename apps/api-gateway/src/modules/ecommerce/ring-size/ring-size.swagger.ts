import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export function ApiListRingSizesDocs() {
  return applyDecorators(
    ApiTags('Ring Sizes'),
    ApiOperation({
      summary: 'List user ring sizes',
      description: 'Get all saved ring size profiles for the current user.',
    }),
    ApiResponse({
      status: 200,
      description: 'List of user ring sizes',
      schema: { example: { ringSizes: [] } },
    }),
  );
}

export function ApiCreateRingSizeDocs() {
  return applyDecorators(
    ApiTags('Ring Sizes'),
    ApiOperation({
      summary: 'Create a ring size profile',
      description: 'Save finger size measurement result for the current user.',
    }),
    ApiResponse({
      status: 201,
      description: 'Created ring size profile',
    }),
  );
}

export function ApiUpdateRingSizeDocs() {
  return applyDecorators(
    ApiTags('Ring Sizes'),
    ApiOperation({
      summary: 'Update ring size profile',
      description: 'Update an existing ring size record for the current user.',
    }),
    ApiResponse({
      status: 200,
      description: 'Updated ring size profile',
    }),
  );
}

export function ApiDeleteRingSizeDocs() {
  return applyDecorators(
    ApiTags('Ring Sizes'),
    ApiOperation({
      summary: 'Delete ring size profile',
      description: 'Delete a ring size record.',
    }),
    ApiResponse({
      status: 200,
      description: 'Deletion result',
      schema: { example: { success: true } },
    }),
  );
}

export function ApiSetDefaultRingSizeDocs() {
  return applyDecorators(
    ApiTags('Ring Sizes'),
    ApiOperation({
      summary: 'Set default ring size profile',
      description: 'Set a ring size record as default for the current user.',
    }),
    ApiResponse({
      status: 200,
      description: 'Updated default ring size profile',
    }),
  );
}
