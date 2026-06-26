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

  private readonly httpStatusToGrpcCode: Record<number, number> = {
    400: 3, // INVALID_ARGUMENT
    401: 16, // UNAUTHENTICATED
    403: 7, // PERMISSION_DENIED
    404: 5, // NOT_FOUND
    409: 6, // ALREADY_EXISTS
    429: 8, // RESOURCE_EXHAUSTED
    500: 13, // INTERNAL
    503: 14, // UNAVAILABLE
    504: 4, // DEADLINE_EXCEEDED
  };

  private grpcError(statusCode: number, message: string): Error {
    const grpcCode = this.httpStatusToGrpcCode[statusCode] ?? 2;
    const error = new Error(message);
    (error as unknown as Record<string, unknown>).code = grpcCode;
    (error as unknown as Record<string, unknown>).details = JSON.stringify({
      statusCode,
      message,
      code: grpcCode,
    });
    return error;
  }

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    void _host;

    // HttpException → create plain error with `code` (gRPC status) + `details` (JSON)
    // @grpc/grpc-js serverErrorToStatus() needs `code` to map to correct gRPC status code
    if (exception instanceof HttpException) {
      return throwError(() =>
        this.grpcError(exception.getStatus(), exception.message),
      );
    }

    // Lỗi DB phổ biến theo mã lỗi
    const err = exception as Record<string, unknown> | null;
    if (err && typeof err.code === 'string') {
      switch (err.code) {
        case 'P2025':
        case 'P2001':
          return throwError(() =>
            this.grpcError(HttpStatus.NOT_FOUND, 'Resource not found'),
          );

        case 'P2002':
          return throwError(() =>
            this.grpcError(
              HttpStatus.CONFLICT,
              `Unique constraint failed on field: ${err.meta && typeof err.meta === 'object' && 'target' in err.meta ? String((err.meta as { target?: string }).target ?? '') : ''}`,
            ),
          );

        case 'P2003':
          this.logger.error(
            'Foreign key constraint violation: ' +
              'field=' +
              String(
                err.meta && typeof err.meta === 'object' && 'field' in err.meta
                  ? ((err.meta as { field?: string }).field ?? '')
                  : '',
              ) +
              ' ' +
              'constraint=' +
              String(
                err.meta &&
                  typeof err.meta === 'object' &&
                  'constraint' in err.meta
                  ? ((err.meta as { constraint?: string }).constraint ?? '')
                  : '',
              ),
          );
          return throwError(() =>
            this.grpcError(
              HttpStatus.BAD_REQUEST,
              'Foreign key constraint violation',
            ),
          );

        default:
          this.logger.error(
            'Database Error: ' +
              String(err.code) +
              ' - ' +
              (typeof err.message === 'string' ? String(err.message) : ''),
          );
          return throwError(() =>
            this.grpcError(
              HttpStatus.BAD_REQUEST,
              'Database Error: ' + String(err.code),
            ),
          );
      }
    }

    if (exception instanceof RpcException) {
      const error = exception.getError();
      const errorResponse =
        typeof error === 'string'
          ? { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: error }
          : (error as { statusCode: number; message: string });
      return throwError(() =>
        this.grpcError(
          errorResponse.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
          errorResponse.message ?? 'Internal Server Error',
        ),
      );
    }

    // Lỗi lạ khác
    this.logger.error(exception);
    return throwError(() =>
      this.grpcError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        err && typeof err.message === 'string'
          ? err.message
          : 'Internal Server Error',
      ),
    );
  }
}
