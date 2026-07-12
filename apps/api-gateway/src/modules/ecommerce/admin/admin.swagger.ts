import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiGetDashboardSummaryDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Dashboard summary',
      description: 'Total orders, completed orders, revenue, active users.',
    }),
    ApiResponse({
      status: 200,
      description: 'Summary',
      schema: {
        example: {
          totalOrders: 156,
          completedOrders: 89,
          totalRevenue: 1250000000,
          activeUsers: 342,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiGetOrdersByStatusDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Orders grouped by status',
      description: 'Returns count of orders for each status.',
    }),
    ApiResponse({
      status: 200,
      description: 'Orders by status',
      schema: {
        example: {
          data: [
            { status: 'COMPLETED', count: 89 },
            { status: 'AWAITING_SUBMIT', count: 12 },
            { status: 'PENDING_REVIEW', count: 7 },
          ],
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiGetRevenueTimelineDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Revenue timeline',
      description: 'Daily revenue for the last N days.',
    }),
    ApiQuery({ name: 'days', required: false, example: 7 }),
    ApiResponse({
      status: 200,
      description: 'Revenue timeline',
      schema: {
        example: {
          data: [
            { date: '2026-07-01', revenue: 45000000 },
            { date: '2026-07-02', revenue: 32000000 },
          ],
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiGetTopProductsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Top selling products',
      description: 'Most ordered products.',
    }),
    ApiQuery({ name: 'limit', required: false, example: 10 }),
    ApiResponse({
      status: 200,
      description: 'Top products',
      schema: {
        example: {
          data: [
            { id: 'prod-classic-band', name: 'Classic Band', orderCount: 42 },
            { id: 'prod-diamond-halo', name: 'Diamond Halo', orderCount: 28 },
          ],
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
