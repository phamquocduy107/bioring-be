import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';

const ADMIN_USERS_NOTE = 'Requires `user.read` permission';
const ADMIN_BLOCK_NOTE = 'Requires `user.block` permission';
const ADMIN_WRITE_NOTE = 'Requires `user.write` permission';

export function ApiGetUsersDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List users (paginated)',
      description: ADMIN_USERS_NOTE,
    }),
    ApiAuthFailures(),
    ApiQuery({ name: 'page', required: false, type: 'number', example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: 'number', example: 10 }),
    ApiQuery({
      name: 'role',
      required: false,
      type: 'string',
      example: 'JEWELER',
      description:
        'Filter by role name (e.g. JEWELER, MANAGER, DELIVERY_STAFF)',
    }),
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
              lastLogin: '2026-07-16T10:00:00.000Z',
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
    ApiOperation({ summary: 'Get user by ID', description: ADMIN_USERS_NOTE }),
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
          user: {
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
            lastLogin: '2026-07-16T10:00:00.000Z',
          },
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
    ApiOperation({ summary: 'Ban user', description: ADMIN_BLOCK_NOTE }),
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
    ApiOperation({ summary: 'Unban user', description: ADMIN_BLOCK_NOTE }),
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
    ApiOperation({
      summary: 'Assign role to user',
      description: ADMIN_WRITE_NOTE,
    }),
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

export function ApiCreateUserDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create staff user',
      description:
        'Creates a new user (staff/customer-team). Optionally assign role in one call. Requires `user.write` permission.',
    }),
    ApiAuthFailures(),
    ApiBody({
      schema: {
        example: {
          email: 'staff@bioring.com',
          fullName: 'Nguyen Van A',
          phone: '0909123456',
          roleId: '660e8400-e29b-41d4-a716-446655440001',
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'User created',
      schema: {
        example: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'staff@bioring.com',
            fullName: 'Nguyen Van A',
            phone: '0909123456',
            status: 'ACTIVE',
            customerType: null,
            isVip: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            roles: ['STAFF'],
            lastLogin: '',
          },
        },
      },
    }),
    ApiResponse({ status: 409, description: 'Email already exists' }),
  );
}

export function ApiUpdateUserDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update user info',
      description:
        'Update user email, fullName, phone, or status. Requires `user.write` permission.',
    }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        example: {
          fullName: 'Nguyen Van B',
          phone: '0909987654',
          status: 'ACTIVE',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'User updated',
      schema: {
        example: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'staff@bioring.com',
            fullName: 'Nguyen Van B',
            phone: '0909987654',
            status: 'ACTIVE',
            customerType: null,
            isVip: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            roles: ['STAFF'],
            lastLogin: '2026-07-16T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'User not found' }),
    ApiResponse({ status: 409, description: 'Email already in use' }),
  );
}
