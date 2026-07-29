import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiGetMyCurrentDeliveryDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get my current delivery task',
      description:
        'Returns the active delivery (PENDING or SHIPPING) for the current staff. Empty object if none.',
    }),
    ApiResponse({
      status: 200,
      description: 'Current delivery or empty',
      schema: {
        example: {
          id: 'uuid-ship-1',
          order_id: 'uuid-order-1',
          order_code: 'BIORING-ABC123',
          status: 'SHIPPING',
          tracking_code: 'VNPOST123456',
          customer: { name: 'Nguyen Van A', phone: '090...', address: '123...' },
          payment_status: 'cod_pending',
          remaining_amount: 1500000,
          assigned_delivery_staff_id: 'uuid-staff-1',
          created_at: '2026-07-28T10:00:00.000Z',
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
