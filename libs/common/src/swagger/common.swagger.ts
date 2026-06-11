import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiAuthFailures() {
  return applyDecorators(
    ApiResponse({ status: 401, description: 'Chưa đăng nhập (Unauthorized)' }),
    ApiResponse({
      status: 403,
      description: 'Không có quyền truy cập (Forbidden)',
    }),
  );
}
