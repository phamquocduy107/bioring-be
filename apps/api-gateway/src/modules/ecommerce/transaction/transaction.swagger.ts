import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export function ApiListTransactionsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List all transactions (paginated)',
      description: 'Returns all payments across orders. Requires order.read permission.',
    }),
    ApiQuery({ name: 'page', type: Number, required: false, example: 1 }),
    ApiQuery({ name: 'limit', type: Number, required: false, example: 20 }),
    ApiQuery({ name: 'status', type: String, required: false, example: 'SUCCESS' }),
    ApiQuery({ name: 'method', type: String, required: false, example: 'PAYOS' }),
    ApiResponse({
      status: 200,
      description: 'Paginated transactions',
      schema: {
        example: {
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              transactionId: 'PAY-txn_abc123',
              orderId: '550e8400-e29b-41d4-a716-446655440001',
              orderNumber: 'BIORING-A7B9X2',
              customer: { id: '550e8400-...', name: 'Nguyễn Văn A', email: 'a@b.com' },
              method: 'PAYOS',
              amount: 3960000,
              status: 'SUCCESS',
              createdAt: '2026-07-01T10:00:00.000Z',
            },
          ],
          meta: { total: 50, page: 1, limit: 20, lastPage: 3 },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function ApiTransactionOverviewDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Transaction overview',
      description: 'Financial summary for current month vs last month. Requires order.read permission.',
    }),
    ApiResponse({
      status: 200,
      description: 'Transaction overview',
      schema: {
        example: {
          grossRevenue: 125000000,
          netRevenue: 120000000,
          pendingCod: 5000000,
          refunded: 2000000,
          grossChange: 12.5,
          netChange: 10.2,
          pendingChange: -5.0,
          refundedChange: 0.0,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}
