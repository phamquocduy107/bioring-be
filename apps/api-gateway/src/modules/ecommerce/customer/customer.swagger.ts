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

export function ApiListGuestCustomersDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List guest customers',
      description: 'Paginated guest (walk-in) customer list with search.',
    }),
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 20 }),
    ApiQuery({ name: 'search', required: false, example: 'nguyen' }),
    ApiResponse({
      status: 200,
      description: 'Guest customer list',
      schema: {
        example: {
          data: [
            {
              id: 'uuid-1',
              name: 'Nguyen Van A',
              email: 'guest@example.com',
              phone: '0901234567',
              status: 'active',
              total_orders: 3,
              total_spent: 25000000,
              last_order_date: '2026-07-10T08:00:00.000Z',
              join_date: '2026-06-01T08:00:00.000Z',
              digital_assets: {
                has_voice: true,
                has_fingerprint: false,
                has_heartbeat: false,
              },
              qr_memory_status: 'active',
              service_tickets: [
                {
                  id: 'tkt-1',
                  ticket_code: 'ST-001',
                  service_type: 'resize',
                  status: 'resolved',
                  created_at: '2026-07-01T09:00:00Z',
                },
              ],
              warranty: {
                is_active: true,
                expiry_date: '2027-06-01T00:00:00Z',
                used_free_count: 0,
              },
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
