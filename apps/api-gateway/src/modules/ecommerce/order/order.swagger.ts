import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

function orderExample() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    orderCode: 'BIORING-A7B9X2',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    designDraftId: '550e8400-e29b-41d4-a716-446655440002',
    captureRoute: 'ONLINE',
    designSource: 'MOBILE',
    status: 'AWAITING_SUBMIT',
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
    engraving: {
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
  };
}

export function ApiCreateOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Create order from engraving',
      description:
        'Creates an order linked to 1 engraving. Server derives packageType from selected_biometrics column. SW → AWAITING_SUBMIT, có FP/HB → AWAITING_DEPOSIT_1. Requires JWT auth. 1 order = 1 engraving.',
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
        '1 order = 1 engraving. Approve → engraving version approved + qr_memories biometric_display_settings updated + order → AWAITING_DEPOSIT. Reject → version REJECTED + branched + order → REVISION_REQUIRED.',
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
        'Creates a payment request via PayOS. paymentPhase = DEPOSIT_1 (IoT fee), DEPOSIT_2 (30% min 3000), or REMAINING.',
    }),
    ApiResponse({
      status: 201,
      description: 'Payment initiated',
      schema: {
        example: {
          payment: {
            id: '550e8400-e29b-41d4-a716-446655440010',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            paymentPhase: 'DEPOSIT_2',
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
    ApiResponse({
      status: 200,
      description: 'Webhook processed (success: true/false)',
    }),
  );
}

export function ApiSubmitOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Submit order for review',
      description:
        'Moves order from AWAITING_SUBMIT or REVISION_REQUIRED to PENDING_REVIEW.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Order submitted',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid order status' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiAttachBiometricDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Attach biometric data (unified)',
      description:
        'Uploads biometric file for an engraving. Order must be in AWAITING_SUBMIT status.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440003',
    }),
    ApiResponse({
      status: 201,
      description: 'Biometric attached',
      schema: {
        example: {
          biometric: {
            id: '550e8400-e29b-41d4-a716-446655440050',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            biometricType: 'FP',
            requiredChannel: 'ENGRAVING',
            rawFileUrl: 'https://res.cloudinary.com/.../fingerprint.png',
            processedSvgUrl: 'https://res.cloudinary.com/.../fingerprint.svg',
            extraData: '',
            status: 'CAPTURED',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Engraving not found' }),
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

export function ApiGetProductionTasksDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get production tasks (manager)',
      description:
        'Paginated list of production tasks, filterable by status, orderId, jewelerId.',
    }),
    ApiResponse({
      status: 200,
      description: 'Production tasks list',
      schema: {
        example: {
          data: [
            {
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
          ],
          total: 1,
          page: 1,
          limit: 10,
          lastPage: 1,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

// ===== MF-05: Delivery, Pickup & QR Memory =====

const deliveryExample = {
  id: '550e8400-e29b-41d4-a716-446655440060',
  orderId: '550e8400-e29b-41d4-a716-446655440001',
  deliveryMethod: 'DELIVERY',
  status: 'PENDING',
  trackingCode: '',
  trackingUrl: '',
  recipientName: 'Nguyen Van A',
  recipientPhone: '0909123456',
  shippingAddressText: '123 đường ABC',
  estimatedDeliveryAt: '',
  deliveredAt: '',
  createdAt: '2026-07-03T10:00:00.000Z',
};

const warrantyExample = {
  id: '550e8400-e29b-41d4-a716-446655440070',
  engravingId: '550e8400-e29b-41d4-a716-446655440003',
  orderId: '550e8400-e29b-41d4-a716-446655440001',
  warrantyCode: 'WAR-BIORING-A7B9X2',
  warrantyType: 'STANDARD',
  issueDate: '2026-07-03T10:00:00.000Z',
  expiryDate: '2027-07-03T10:00:00.000Z',
  activatedAt: '2026-07-03T10:00:00.000Z',
  status: 'ACTIVE',
  warrantyScope: '{"description":"1 năm bảo hành chính hãng","coverage":["manufacturing_defect"]}',
};

export function ApiQcAcceptOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'QC accept order (manager)',
      description:
        'Manager accepts/rejects product after production. PASS → READY_FOR_DELIVERY, FAIL → IN_PRODUCTION (reset task). Luôn ghi qa_checks record.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'QC result processed',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid input / wrong status' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiInitiateDeliveryDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Initiate delivery (manager)',
      description:
        'Creates shipment record. PICKUP → READY_FOR_PICKUP, DELIVERY → vẫn READY_FOR_DELIVERY (chờ staff start). Yêu cầu remainingAmount = 0.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 201,
      description: 'Delivery initiated',
      schema: { example: deliveryExample },
    }),
    ApiResponse({ status: 400, description: 'Invalid input / wrong status' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiUpdateShipmentStatusDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Update shipment status (staff)',
      description:
        'SHIPPING (chỉ DELIVERY): start delivery → order SHIPPING. DELIVERED: confirm nhận → tự động warranty + unlock QR + COMPLETED.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Shipment status updated',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid transition' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Order or shipment not found' }),
  );
}

export function ApiGetDeliveryInfoDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get delivery info',
      description: 'Returns shipment details for an order.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Delivery info',
      schema: { example: deliveryExample },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}

export function ApiGetWarrantyInfoDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get warranty info',
      description: 'Returns warranty details for an order.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Warranty info',
      schema: { example: { warranty: warrantyExample } },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}

export function ApiGetProductionInfoDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get production & QC info',
      description:
        'Returns production task + latest QA check for an order.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: 200,
      description: 'Production info',
      schema: {
        example: {
          task: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            assignedJewelerId: '550e8400-e29b-41d4-a716-446655440030',
            assignedJewelerName: 'Nguyễn Văn A',
            status: 'COMPLETED',
            note: '',
            startedAt: '2026-06-24T10:00:00.000Z',
            completedAt: '2026-06-24T11:30:00.000Z',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
          qaCheck: {
            id: '550e8400-e29b-41d4-a716-446655440080',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            result: 'PASS',
            checklist: '{"engraving":true,"material":true,"size":true}',
            proofImages: ['https://cloudinary.com/img1.jpg'],
            note: 'Sản phẩm đạt yêu cầu',
            checkedAt: '2026-07-03T10:00:00.000Z',
            checkedByManagerId: '550e8400-e29b-41d4-a716-446655440090',
          },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}

export function ApiLookupOrderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lookup order by code (public)',
      description:
        'Public endpoint for walk-in guests to check order status using order_code.',
    }),
    ApiResponse({
      status: 200,
      description: 'Order found',
      schema: { example: { order: orderExample() } },
    }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}
