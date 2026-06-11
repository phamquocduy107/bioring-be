import {
  Catch,
  RpcExceptionFilter,
  ArgumentsHost,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch()
export class FitRpcExceptionFilter implements RpcExceptionFilter {
  private readonly logger = new Logger(FitRpcExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    // 1. Mặc định là lỗi 500
    let errorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal Server Error',
    };

    // 2. Xử lý lỗi DB phổ biến theo mã lỗi
    if (typeof exception?.code === 'string') {
      switch (exception.code) {
        case 'P2025':
        case 'P2001':
          errorResponse = {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Resource not found',
          };
          break;

        case 'P2002':
          errorResponse = {
            statusCode: HttpStatus.CONFLICT,
            message: `Unique constraint failed on field: ${exception.meta?.target}`,
          };
          break;

        case 'P2003':
          errorResponse = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Foreign key constraint violation',
          };
          break;

        default:
          this.logger.error(
            `Database Error: ${exception.code} - ${exception.message}`,
          );
          errorResponse = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Database Error: ${exception.code}`,
          };
          break;
      }
    }
    // 3. Xử lý HttpException → tự động chuyển sang RpcException
    else if (exception instanceof HttpException) {
      const response = exception.getResponse();
      errorResponse = {
        statusCode: exception.getStatus(),
        message:
          typeof response === 'string'
            ? response
            : (response as any).message || exception.message,
      };
    }
    // 4. Xử lý RpcException
    else if (exception instanceof RpcException) {
      const error = exception.getError();
      errorResponse =
        typeof error === 'string'
          ? { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: error }
          : (error as any);
    }
    // 5. Lỗi lạ khác
    else {
      this.logger.error(exception);
      if (exception.message) errorResponse.message = exception.message;
    }

    // Gửi lỗi đã được đóng gói về Gateway
    return throwError(() => new RpcException(errorResponse));
  }
}
