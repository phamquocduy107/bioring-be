import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export function ApiGetMyCurrentTaskDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get my current production task',
      description:
        'Returns the single IN_PROGRESS task for the current jeweler (most recently started). Empty object if none.',
    }),
    ApiResponse({
      status: 200,
      description: 'Current task or empty',
      schema: {
        example: {
          id: 'uuid-1',
          order_id: 'uuid-2',
          order_code: 'BIORING-ABC123',
          status: 'IN_PROGRESS',
          started_at: '2026-07-28T08:00:00.000Z',
          customer_name: 'Nguyen Van A',
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiGetMyPerformanceDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get my jeweler performance',
      description:
        "Current jeweler's performance stats — completed today/shift, QA pass rate, avg hours, recent tasks.",
    }),
    ApiQuery({ name: 'from_date', required: false, example: '2026-07-01' }),
    ApiResponse({
      status: 200,
      description: 'Performance stats',
      schema: {
        example: {
          completed_today: 3,
          completed_shift: 7,
          qa_pass_rate: 92.0,
          avg_hours: 6.4,
          recent_tasks: [
            {
              id: 'uuid-1',
              order_code: 'ORD-2026-X09',
              completed_at: '2026-07-14T08:00:00.000Z',
              qa_result: 'passed',
              duration_hours: 5.2,
            },
          ],
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}
