import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';

export function ApiGetUsersDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List users (paginated)' }),
    ApiAuthFailures(),
    ApiQuery({ name: 'page', required: false, type: 'number', example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: 'number', example: 10 }),
    ApiResponse({
      status: 200,
      description: 'Paginated user list',
      schema: {
        example: {
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              email: 'user@gmail.com',
              fullName: 'John Doe',
              phone: '0987654321',
              status: 'ACTIVE',
              customerType: null,
              isVip: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              roles: ['CUSTOMER'],
            },
          ],
          meta: { total: 1, page: 1, limit: 10, lastPage: 1 },
        },
      },
    }),
  );
}

export function ApiGetUserByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get user by ID' }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: 200,
      description: 'User details',
      schema: {
        example: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@gmail.com',
          fullName: 'John Doe',
          phone: '0987654321',
          avatarUrl: null,
          status: 'ACTIVE',
          customerType: null,
          isVip: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          roles: ['CUSTOMER'],
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: { example: { message: 'User not found' } },
    }),
  );
}

export function ApiBanUserDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Ban user' }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: 200,
      description: 'User banned',
      schema: { example: { success: true } },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: { example: { message: 'User not found' } },
    }),
  );
}

export function ApiUnbanUserDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Unban user' }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: 200,
      description: 'User unbanned',
      schema: { example: { success: true } },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: { example: { message: 'User not found' } },
    }),
  );
}

export function ApiAssignRoleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Assign role to user' }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiQuery({
      name: 'roleId',
      required: true,
      description: 'Role UUID',
      type: 'string',
      format: 'uuid',
      example: '660e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Role assigned',
      schema: { example: { success: true } },
    }),
    ApiResponse({
      status: 404,
      description: 'User or role not found',
      schema: { example: { message: 'User not found' } },
    }),
    ApiResponse({
      status: 409,
      description: 'User already has this role',
      schema: { example: { message: 'User already has this role' } },
    }),
  );
}
