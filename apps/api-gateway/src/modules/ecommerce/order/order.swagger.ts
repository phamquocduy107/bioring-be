import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

function orderExample() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    orderCode: 'BIORING-A7B9X2',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    designDraftId: '550e8400-e29b-41d4-a716-446655440002',
    captureRoute: 'ONLINE',
    designSource: 'MOBILE',
    status: 'PENDING_REVIEW',
    subtotal: 12000000,
    serviceFee: 1200000,
    extraFee: 0,
    discountAmount: 0,
    totalPrice: 13200000,
    paidAmount: 0,
    remainingAmount: 13200000,
    note: '',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T10:00:00.000Z',
    payments: [],
    engravings: [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        productId: 'prod-classic-band',
        uniqueProductId: 'RS-A7B9X2',
        approvedVersionId: '550e8400-e29b-41d4-a716-446655440004',
        status: 'ACTIVE',
        versions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            versionNumber: 1,
            selectedMaterialId: 'mat-gold-18k',
            selectedGemstoneId: 'gmt-diamond-05',
            ringSize: '7',
            ringStyle: 'CLASSIC',
            ringShape: 'ROUND',
            customizationConfig:
              '{"engravedType":"sw","selectedBiometrics":["SW"],"engravingPositions":{"sw":{"enabled":true,"status":"pending","position":{"startAngle":45,"width":180}}},"memoryCard":false}',
            status: 'PENDING',
            managerId: '',
            managerNote: '',
            reviewedAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
        ],
        biometrics: [],
      },
    ],
  };
}

export function ApiCreateOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Create order from engravings',
      description:
        'Creates an order linked to the given engraving IDs. Requires JWT auth. engravingIds must belong to the authenticated user.',
    }),
    ApiResponse({
      status: 201,
      description: 'Order created',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Engraving not found' }),
  );
}

export function ApiGetOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Get order by ID' }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Order detail',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiGetMyOrdersDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Get my orders (paginated)' }),
    ApiQuery({ name: 'page', type: Number, required: false, example: 1 }),
    ApiQuery({ name: 'limit', type: Number, required: false, example: 10 }),
    ApiResponse({
      status: 200,
      description: 'Paginated orders',
      schema: {
        example: {
          orders: [orderExample()],
          total: 1,
          page: 1,
          limit: 10,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function ApiReviewOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Review order (manager)',
      description:
        'APPROVED → order moves to AWAITING_DEPOSIT, engraving version approved. REJECTED → order moves to REVISION_REQUIRED, new version branched.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Order reviewed',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid action' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiInitiatePaymentDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Initiate PayOS payment',
      description:
        'Creates a payment request via PayOS. paymentPhase = DEPOSIT (30%) or REMAINING.',
    }),
    ApiResponse({
      status: 201,
      description: 'Payment initiated',
      schema: {
        example: {
          payment: {
            id: '550e8400-e29b-41d4-a716-446655440010',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            paymentPhase: 'DEPOSIT',
            amount: 3960000,
            method: 'PAYOS',
            status: 'PENDING',
            payosTransactionId: 'txn_abc123',
            paymentUrl: 'https://pay.payos.vn/checkout/abc123',
            paidAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
          paymentUrl: 'https://pay.payos.vn/checkout/abc123',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiPayOSWebhookDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'PayOS webhook callback',
      description: 'Public endpoint for PayOS to send payment status updates.',
    }),
    ApiResponse({ status: 200, description: 'Webhook processed (success: true/false)' }),
  );
}

export function ApiAssignJewelerDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Assign jeweler to order (manager)',
      description:
        'Creates a production task and sets order status to IN_PRODUCTION.',
    }),
    ApiResponse({
      status: 201,
      description: 'Jeweler assigned',
      schema: {
        example: {
          task: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            assignedJewelerId: '550e8400-e29b-41d4-a716-446655440030',
            assignedJewelerName: 'Nguyễn Văn A',
            status: 'IN_PROGRESS',
            note: '',
            startedAt: '2026-06-24T10:00:00.000Z',
            completedAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiUpdateProductionStatusDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Update production task status (manager)',
      description:
        'Sets task to COMPLETED, IN_PROGRESS, etc. COMPLETED → order moves to AWAITING_REMAINING or COMPLETED.',
    }),
    ApiResponse({
      status: 200,
      description: 'Production status updated',
      schema: {
        example: {
          task: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            assignedJewelerId: '550e8400-e29b-41d4-a716-446655440030',
            assignedJewelerName: 'Nguyễn Văn A',
            status: 'COMPLETED',
            note: 'Ring production finished',
            startedAt: '2026-06-24T10:00:00.000Z',
            completedAt: '2026-06-24T11:30:00.000Z',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Task not found' }),
  );
}
