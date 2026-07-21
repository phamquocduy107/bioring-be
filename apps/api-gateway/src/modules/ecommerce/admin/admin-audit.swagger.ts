import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiListAuditLogsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List audit logs',
      description: 'Paginated audit log entries with filters.',
    }),
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 50 }),
    ApiQuery({ name: 'resource', required: false, example: 'order' }),
    ApiQuery({ name: 'from_date', required: false, example: '2026-06-01' }),
    ApiQuery({ name: 'to_date', required: false, example: '2026-07-01' }),
    ApiResponse({
      status: 200,
      description: 'Audit log entries',
      schema: {
        example: {
          data: [
            {
              id: 'uuid',
              timestamp: '2026-07-10T08:00:00.000Z',
              actor: {
                id: 'uuid',
                name: 'Admin User',
                email: 'admin@example.com',
              },
              action: 'SUBMIT',
              resource: 'order',
              resource_id: 'order-uuid',
              description: 'SUBMIT on order order-uuid',
              result: 'success',
              metadata: {
                newValue: { status: 'SUBMITTED' },
                oldValue: { status: 'AWAITING_SUBMIT' },
              },
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
          last_page: 1,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
