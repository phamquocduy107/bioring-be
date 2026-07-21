import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiListTransactionsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'List all transactions (paginated)',
      description:
        'Returns all payments across orders. Requires order.read permission.',
    }),
    ApiQuery({ name: 'page', type: Number, required: false, example: 1 }),
    ApiQuery({ name: 'limit', type: Number, required: false, example: 20 }),
    ApiQuery({
      name: 'status',
      type: String,
      required: false,
      example: 'SUCCESS',
    }),
    ApiQuery({
      name: 'method',
      type: String,
      required: false,
      example: 'PAYOS',
    }),
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
              customer: {
                id: '550e8400-...',
                name: 'Nguyễn Văn A',
                email: 'a@b.com',
              },
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
      description:
        'Financial summary for current month vs last month. Requires order.read permission.',
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

export function ApiForcePaidDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Force mark payment as PAID',
      description:
        'Admin override — sets payment status to PAID and updates order amounts. Requires order.write permission.',
    }),
    ApiResponse({
      status: 200,
      description: 'Payment forced to PAID',
      schema: {
        example: {
          payment: {
            id: '550e8400-...',
            orderId: '550e8400-...',
            paymentPhase: 'REMAINING',
            amount: 5000000,
            method: 'PAYOS',
            status: 'PAID',
            paidAt: '2026-07-15T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Payment not found' }),
  );
}

export function ApiSyncPaymentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Sync payment status from PayOS',
      description:
        'Queries PayOS API for current transaction status and updates the payment record. Requires order.write permission.',
    }),
    ApiResponse({
      status: 200,
      description: 'Payment status synced',
      schema: {
        example: {
          payment: { id: '550e8400-...', status: 'PAID' },
          payosStatus: 'PAID',
          orderCode: '172000000042',
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Payment or order not found' }),
  );
}

export function ApiRefundDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Refund payment',
      description:
        'Marks payment as REFUNDED and adjusts order paid/remaining amounts. Requires order.write permission.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          reason: { type: 'string', example: 'Khách hàng yêu cầu hoàn tiền' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Payment refunded',
      schema: {
        example: {
          payment: {
            id: '550e8400-...',
            orderId: '550e8400-...',
            status: 'REFUNDED',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Payment already refunded' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Payment not found' }),
  );
}

export function ApiUpdateShippingFeeDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Update shipping fee',
      description:
        'Updates extra_fee on the order associated with this payment. Requires order.write permission.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: { amount: { type: 'number', example: 50000 } },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Shipping fee updated',
      schema: { example: { success: true } },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Payment or order not found' }),
  );
}
