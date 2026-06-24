import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';

const READ_NOTE = 'Requires `role.read` permission';
const WRITE_NOTE = 'Requires `role.write` permission';

export function ApiGetRolesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all roles', description: READ_NOTE }),
    ApiAuthFailures(),
    ApiResponse({
      status: 200,
      description: 'List of roles',
      schema: {
        example: {
          roles: [
            {
              id: '660e8400-e29b-41d4-a716-446655440001',
              name: 'ADMIN',
              description: 'Administrator',
            },
            {
              id: '660e8400-e29b-41d4-a716-446655440002',
              name: 'CUSTOMER',
              description: 'Customer',
            },
          ],
        },
      },
    }),
  );
}

export function ApiGetRoleWithPermissionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get role with permissions',
      description: READ_NOTE,
    }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      type: 'string',
      format: 'uuid',
      example: '660e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Role with permissions',
      schema: {
        example: {
          role: {
            id: '660e8400-e29b-41d4-a716-446655440001',
            name: 'ADMIN',
            description: 'Administrator',
            permissions: [
              {
                id: '770e8400-e29b-41d4-a716-446655440001',
                slug: 'users.read',
                description: 'Read users',
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Role not found',
      schema: { example: { message: 'Role not found' } },
    }),
  );
}

export function ApiCreateRoleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create role', description: WRITE_NOTE }),
    ApiAuthFailures(),
    ApiBody({
      schema: {
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'MANAGER' },
          description: { type: 'string', example: 'Manager role' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Role created',
      schema: {
        example: {
          role: {
            id: '660e8400-e29b-41d4-a716-446655440003',
            name: 'MANAGER',
            description: 'Manager role',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid input (e.g. missing name)',
    }),
    ApiResponse({
      status: 409,
      description: 'Role name already exists',
      schema: { example: { message: 'Role name already exists' } },
    }),
  );
}

export function ApiUpdateRoleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update role', description: WRITE_NOTE }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      type: 'string',
      format: 'uuid',
      example: '660e8400-e29b-41d4-a716-446655440003',
    }),
    ApiBody({
      schema: {
        properties: {
          name: { type: 'string', example: 'SUPER_MANAGER' },
          description: { type: 'string', example: 'Updated description' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Role updated',
      schema: {
        example: {
          role: {
            id: '660e8400-e29b-41d4-a716-446655440003',
            name: 'SUPER_MANAGER',
            description: 'Updated description',
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Role not found',
      schema: { example: { message: 'Role not found' } },
    }),
    ApiResponse({
      status: 409,
      description: 'Role name already exists',
      schema: { example: { message: 'Role name already exists' } },
    }),
  );
}

export function ApiDeleteRoleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete role', description: WRITE_NOTE }),
    ApiAuthFailures(),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      type: 'string',
      format: 'uuid',
      example: '660e8400-e29b-41d4-a716-446655440003',
    }),
    ApiResponse({
      status: 200,
      description: 'Role deleted',
      schema: { example: { success: true } },
    }),
    ApiResponse({
      status: 404,
      description: 'Role not found',
      schema: { example: { message: 'Role not found' } },
    }),
    ApiResponse({
      status: 403,
      description: 'Cannot delete role assigned to users',
      schema: {
        example: { message: 'Cannot delete role that is assigned to users' },
      },
    }),
  );
}

export function ApiGetPermissionsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all permissions', description: READ_NOTE }),
    ApiAuthFailures(),
    ApiResponse({
      status: 200,
      description: 'List of permissions',
      schema: {
        example: {
          permissions: [
            {
              id: '770e8400-e29b-41d4-a716-446655440001',
              slug: 'users.read',
              description: 'Read users',
            },
            {
              id: '770e8400-e29b-41d4-a716-446655440002',
              slug: 'users.write',
              description: 'Create/update users',
            },
          ],
        },
      },
    }),
  );
}

export function ApiAssignPermissionsToRoleDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Assign permissions to role',
      description: WRITE_NOTE,
    }),
    ApiAuthFailures(),
    ApiBody({
      schema: {
        required: ['roleId', 'permissionIds'],
        properties: {
          roleId: {
            type: 'string',
            format: 'uuid',
            example: '660e8400-e29b-41d4-a716-446655440001',
          },
          permissionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            example: [
              '770e8400-e29b-41d4-a716-446655440001',
              '770e8400-e29b-41d4-a716-446655440002',
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Permissions assigned',
      schema: { example: { success: true } },
    }),
    ApiResponse({
      status: 404,
      description: 'Role or permissions not found',
      schema: { example: { message: 'Some permissions not found' } },
    }),
  );
}
