import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

function guestCustomerExample() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    guestCode: 'GUE-A7B9X2',
    fullName: 'Nguyễn Văn A',
    phone: '0909123456',
    email: 'guest@example.com',
    note: 'Khách muốn nhẫn bạc',
    createdAt: '2026-07-07T10:00:00.000Z',
  };
}

function guestOrderExample() {
  return {
    order: {
      id: '550e8400-e29b-41d4-a716-446655440010',
      orderCode: '172000000042',
      userId: '',
      guestCustomerId: '550e8400-e29b-41d4-a716-446655440001',
      designSource: 'WALK_IN',
      status: 'AWAITING_SUBMIT',
      totalPrice: 13200000,
      paidAmount: 0,
      remainingAmount: 13200000,
      createdAt: '2026-07-07T10:00:00.000Z',
    },
    engraving: {
      id: '550e8400-e29b-41d4-a716-446655440011',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      productId: '550e8400-e29b-41d4-a716-446655440020',
      status: 'PENDING',
    },
    version: {
      id: '550e8400-e29b-41d4-a716-446655440012',
      engravingId: '550e8400-e29b-41d4-a716-446655440011',
      versionNumber: 1,
      selectedMaterialId: '',
      selectedGemstoneId: '',
      ringSize: '',
      ringStyle: '',
      ringShape: '',
      customizationConfig: '{}',
      selectedBiometrics: '',
      status: 'PENDING',
      createdAt: '2026-07-07T10:00:00.000Z',
    },
  };
}

export function ApiCreateGuestSessionDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Tạo guest session cho khách vãng lai',
      description:
        'Staff nhập thông tin khách (tên, SĐT, email). Hệ thống sinh guest_code GUE-XXXXXX để guest dùng trên tablet.',
    }),
    ApiBody({
      schema: {
        example: {
          fullName: 'Nguyễn Văn A',
          phone: '0909123456',
          email: 'guest@example.com',
          note: 'Khách muốn nhẫn bạc',
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Guest session created (normal)',
      schema: {
        example: {
          guest: guestCustomerExample(),
          isMember: false,
          isExistingGuest: false,
          message: '',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Email is a registered member (not a walk-in)',
      schema: {
        example: {
          guest: {
            id: '',
            guestCode: '',
            fullName: '',
            phone: '',
            email: 'member@gmail.com',
            note: '',
            createdAt: '',
          },
          isMember: true,
          isExistingGuest: false,
          message: 'Email already registered as member',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Email belongs to existing guest session',
      schema: {
        example: {
          guest: guestCustomerExample(),
          isMember: false,
          isExistingGuest: true,
          message: 'Guest already exists. Create new?',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function ApiCreateGuestOrderDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Tạo order cho guest (gộp createEngraving + createOrder)',
      description:
        'Staff tạo order cho khách vãng lai. Hệ thống tự động tạo engraving + version v1 + qr_memories + order (AWAITING_SUBMIT).',
    }),
    ApiBody({
      schema: {
        example: {
          guestCode: 'GUE-A7B9X2',
          productId: '550e8400-e29b-41d4-a716-446655440020',
          selectedBiometrics: ['SW', 'FP'],
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Guest order created',
      schema: { example: guestOrderExample() },
    }),
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Guest not found' }),
  );
}
