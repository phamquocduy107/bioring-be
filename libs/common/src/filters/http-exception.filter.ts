import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    // Tránh lỗi khi headers đã được gửi khi hủy Google OAuth
    if (response.headersSent) {
      this.logger.warn(
        'Headers already sent, skipping exception filter response.',
      );
      return;
    }

    // 1. Xử lý lỗi HTTP thông thường
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      message =
        typeof responseBody === 'object' && 'message' in responseBody
          ? (responseBody as any).message
          : responseBody;
    }

    // 2. Xử lý lỗi từ Microservice (RPC)
    else if (this.isRpcError(exception)) {
      const errorObj = exception as any;

      // Lấy object thật bên trong nếu có
      const realError = errorObj.error || errorObj;

      // Lấy status từ object thật bên trong
      status = Number(realError.statusCode || realError.status);
      message = realError.message || 'Microservice Error';
    }

    // 3. Lỗi DB (Prisma)
    else if (this.isNotFoundError(exception)) {
      status = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
    } else {
      // Log lỗi 500 thực sự để debug
      this.logger.error(exception);
    }

    // Kiểm tra an toàn lần cuối
    if (isNaN(status) || typeof status !== 'number') {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private isRpcError(exception: any): boolean {
    if (!exception || typeof exception !== 'object') return false;

    // Check nếu là lỗi phẳng
    const isFlatError = 'status' in exception || 'statusCode' in exception;

    // Check nếu là lỗi lồng nhau
    const isNestedError =
      'error' in exception &&
      typeof exception.error === 'object' &&
      ('status' in exception.error || 'statusCode' in exception.error);

    return isFlatError || isNestedError;
  }

  private isNotFoundError(exception: any): boolean {
    if (exception.name === 'EntityNotFoundError') return true;
    if (exception.code === 'P2025') return true;
    return false;
  }
}
