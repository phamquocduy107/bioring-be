import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

function guestSessionExample() {
  return {
    guest: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      guestCode: 'GUE-A7B9X2',
      fullName: 'Nguyễn Văn A',
      phone: '0909123456',
      email: 'guest@example.com',
      note: 'Khách muốn nhẫn bạc',
      createdAt: '2026-07-07T10:00:00.000Z',
    },
    order: {
      id: '550e8400-e29b-41d4-a716-446655440010',
      orderCode: '172000000042',
      guestCustomerId: '550e8400-e29b-41d4-a716-446655440001',
      designSource: 'WALK_IN',
      status: 'AWAITING_SUBMIT',
      totalPrice: 13200000,
      paidAmount: 0,
      remainingAmount: 13200000,
      engraving: {
        id: '550e8400-e29b-41d4-a716-446655440011',
        status: 'PENDING',
        versions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440012',
            engravingId: '550e8400-e29b-41d4-a716-446655440011',
            versionNumber: 1,
            status: 'PENDING',
          },
        ],
        biometrics: [],
        qrMemory: null,
      },
      createdAt: '2026-07-07T10:00:00.000Z',
    },
  };
}

function submitOrderExample() {
  return {
    order: {
      id: '550e8400-e29b-41d4-a716-446655440010',
      orderCode: '172000000042',
      status: 'PENDING_REVIEW',
    },
    isResubmit: false,
  };
}

function paymentExample() {
  return {
    payment: {
      id: '550e8400-e29b-41d4-a716-446655440050',
      orderId: '550e8400-e29b-41d4-a716-446655440010',
      paymentPhase: 'FULL',
      amount: 13200000,
      method: 'PAYOS',
      status: 'PENDING',
      payosTransactionId: 'PAYOS-123',
      paymentUrl: 'https://pay.payos.vn/...',
      paidAt: '',
      createdAt: '2026-07-07T10:00:00.000Z',
    },
    paymentUrl: 'https://pay.payos.vn/...',
  };
}

export function ApiGetGuestSessionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest xem session + order đang active',
      description:
        'Trả về thông tin guest + order (status AWAITING_SUBMIT hoặc REVISION_REQUIRED) kèm engraving, versions, biometrics.',
    }),
    ApiParam({
      name: 'guestCode',
      type: String,
      example: 'GUE-A7B9X2',
    }),
    ApiResponse({
      status: 200,
      description: 'Guest session details',
      schema: { example: guestSessionExample() },
    }),
    ApiResponse({ status: 404, description: 'Guest not found' }),
  );
}

export function ApiGuestUpdateConfigDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest cập nhật engraving config',
      description:
        'Cập nhật design config trên engraving version. guestCode trong query param để xác thực.',
    }),
    ApiParam({
      name: 'versionId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440012',
    }),
    ApiQuery({
      name: 'guestCode',
      type: String,
      example: 'GUE-A7B9X2',
    }),
    ApiBody({
      schema: {
        example: {
          selectedMaterialId: '550e8400-e29b-41d4-a716-446655440030',
          ringSize: '7',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Config updated',
    }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
    ApiResponse({ status: 404, description: 'Version not found' }),
  );
}

export function ApiGuestSubmitOrderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest submit / resubmit order',
      description:
        'Lần đầu: AWAITING_SUBMIT → PENDING_REVIEW. Resubmit sau reject: REVISION_REQUIRED → PENDING_REVIEW (reset engraving.status = PENDING).',
    }),
    ApiParam({
      name: 'orderId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
    }),
    ApiBody({
      schema: {
        example: { guestCode: 'GUE-A7B9X2' },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Order submitted',
      schema: { example: submitOrderExample() },
    }),
    ApiResponse({ status: 400, description: 'Order not in valid status' }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
  );
}

export function ApiGuestGetOrderDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest xem chi tiết order',
      description: 'guestCode trong query param để xác thực.',
    }),
    ApiParam({
      name: 'orderId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
    }),
    ApiQuery({
      name: 'guestCode',
      type: String,
      example: 'GUE-A7B9X2',
    }),
    ApiResponse({
      status: 200,
      description: 'Order details',
    }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
    ApiResponse({ status: 404, description: 'Order not found' }),
  );
}

export function ApiGuestInitiatePaymentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest thanh toán FULL (100%)',
      description:
        'Khởi tạo thanh toán PayOS với phase=FULL, amount=total_price. Chỉ dành cho walk-in guest.',
    }),
    ApiParam({
      name: 'orderId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
    }),
    ApiBody({
      schema: {
        example: {
          guestCode: 'GUE-A7B9X2',
          returnUrl: 'bioring://payment/result',
          cancelUrl: 'bioring://payment/cancel',
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Payment initiated',
      schema: { example: paymentExample() },
    }),
    ApiResponse({ status: 400, description: 'FULL payment not allowed' }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
  );
}

export function ApiGuestUpdateQrMemoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest cập nhật QR memory card',
      description:
        'Cập nhật cardTitle, greetingMessage, recipientEmail cho memory card.',
    }),
    ApiParam({
      name: 'engravingId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440011',
    }),
    ApiBody({
      schema: {
        example: {
          guestCode: 'GUE-A7B9X2',
          cardTitle: 'Our Special Ring',
          greetingMessage: 'Thank you for being with me!',
          recipientEmail: 'friend@example.com',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'QR memory updated',
    }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
  );
}

export function ApiGuestSetShippingInfoDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Guest chọn hình thức nhận hàng + nhập địa chỉ',
      description:
        'Guest chọn PICKUP hoặc DELIVERY, nếu DELIVERY thì nhập tên, SĐT, địa chỉ. Tạo shipment PENDING (chưa kích hoạt, chờ Manager approve order + production xong).',
    }),
    ApiParam({
      name: 'orderId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
    }),
    ApiBody({
      schema: {
        example: {
          guestCode: 'GUE-A7B9X2',
          deliveryMethod: 'DELIVERY',
          recipientName: 'Nguyễn Văn A',
          recipientPhone: '0909123456',
          shippingAddressText: '123 Đường ABC, Quận 1, TP.HCM',
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Shipping info saved',
      schema: {
        example: {
          id: '550e8400-e29b-41d4-a716-446655440060',
          orderId: '550e8400-e29b-41d4-a716-446655440010',
          deliveryMethod: 'DELIVERY',
          status: 'PENDING',
          recipientName: 'Nguyễn Văn A',
          recipientPhone: '0909123456',
          shippingAddressText: '123 Đường ABC, Quận 1, TP.HCM',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid delivery method or already set',
    }),
    ApiResponse({ status: 403, description: 'Invalid guest code' }),
  );
}
