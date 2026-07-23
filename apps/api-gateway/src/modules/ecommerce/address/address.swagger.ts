import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { CreateAddressDto, UpdateAddressDto } from '@app/common';

export function ApiListAddressesDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List user addresses',
      description: 'Get all saved addresses for the current user.',
    }),
    ApiOkResponse({
      description: 'List of addresses',
      schema: { example: { addresses: [] } },
    }),
  );
}

export function ApiCreateAddressDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Create address',
      description: 'Add a new delivery address for the current user.',
    }),
    ApiBody({ type: CreateAddressDto }),
    ApiCreatedResponse({
      description: 'Address created',
      schema: { example: { address: {} } },
    }),
  );
}

export function ApiUpdateAddressDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Update address',
      description: 'Update an existing delivery address.',
    }),
    ApiParam({ name: 'id', type: 'string', format: 'uuid' }),
    ApiBody({ type: UpdateAddressDto }),
    ApiOkResponse({
      description: 'Address updated',
      schema: { example: { address: {} } },
    }),
  );
}

export function ApiDeleteAddressDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Delete address',
      description: 'Delete a delivery address.',
    }),
    ApiParam({ name: 'id', type: 'string', format: 'uuid' }),
    ApiOkResponse({
      description: 'Address deleted',
      schema: { example: { success: true } },
    }),
  );
}
