import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiListCustomersDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List customers',
      description: 'Paginated customer list with search, filter, sort.',
    }),
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 20 }),
    ApiQuery({ name: 'search', required: false, example: 'nguyen' }),
    ApiQuery({ name: 'status', required: false, example: 'active' }),
    ApiQuery({ name: 'sort_by', required: false, example: 'totalSpent' }),
    ApiQuery({ name: 'sort_order', required: false, example: 'desc' }),
    ApiResponse({
      status: 200,
      description: 'Customer list',
      schema: {
        example: {
          data: [
            {
              id: 'uuid-1',
              name: 'Nguyen Van A',
              email: 'a@example.com',
              phone: '0901234567',
              avatar: null,
              status: 'active',
              total_orders: 5,
              total_spent: 25000000,
              last_order_date: '2026-07-10T08:00:00.000Z',
              join_date: '2026-01-15T08:00:00.000Z',
              location: 'Hanoi',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          last_page: 1,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
