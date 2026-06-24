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

  private readonly grpcToHttpStatus: Record<number, number> = {
    1: HttpStatus.INTERNAL_SERVER_ERROR, // CANCELLED
    2: HttpStatus.INTERNAL_SERVER_ERROR, // UNKNOWN
    3: HttpStatus.BAD_REQUEST, // INVALID_ARGUMENT
    4: HttpStatus.GATEWAY_TIMEOUT, // DEADLINE_EXCEEDED
    5: HttpStatus.NOT_FOUND, // NOT_FOUND
    6: HttpStatus.CONFLICT, // ALREADY_EXISTS
    7: HttpStatus.FORBIDDEN, // PERMISSION_DENIED
    8: HttpStatus.TOO_MANY_REQUESTS, // RESOURCE_EXHAUSTED
    9: HttpStatus.BAD_REQUEST, // FAILED_PRECONDITION
    10: HttpStatus.CONFLICT, // ABORTED
    11: HttpStatus.BAD_REQUEST, // OUT_OF_RANGE
    12: HttpStatus.NOT_IMPLEMENTED, // UNIMPLEMENTED
    13: HttpStatus.INTERNAL_SERVER_ERROR, // INTERNAL
    14: HttpStatus.SERVICE_UNAVAILABLE, // UNAVAILABLE
    15: HttpStatus.INTERNAL_SERVER_ERROR, // DATA_LOSS
    16: HttpStatus.UNAUTHORIZED, // UNAUTHENTICATED
  };

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';

    if (response.headersSent) {
      this.logger.warn(
        'Headers already sent, skipping exception filter response.',
      );
      return;
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      message =
        typeof responseBody === 'object' && responseBody !== null
          ? 'message' in responseBody
            ? String((responseBody as Record<string, string>).message ?? '')
            : JSON.stringify(responseBody)
          : typeof responseBody === 'string'
            ? responseBody
            : 'Http Error';
    } else if (this.isGrpcServiceError(exception)) {
      const err = exception as Record<string, unknown>;
      const grpcCode = Number(err.code);
      const grpcDetails = (err.details as string) ?? '';
      status =
        this.grpcToHttpStatus[grpcCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      message = grpcDetails || 'gRPC Service Error';

      try {
        const parsed = JSON.parse(grpcDetails) as Record<string, unknown>;
        if (typeof parsed.statusCode === 'number') status = parsed.statusCode;
        if (typeof parsed.message === 'string') message = parsed.message;
      } catch {
        // details is not JSON — use as-is
      }
    } else if (this.isRpcError(exception)) {
      const errorObj = exception as Record<string, unknown>;
      const realError = (errorObj.error as Record<string, unknown>) || errorObj;

      status = Number(
        realError.statusCode ??
          realError.status ??
          HttpStatus.INTERNAL_SERVER_ERROR,
      );
      message =
        typeof realError.message === 'string'
          ? realError.message
          : 'Microservice Error';
    } else if (this.isPrismaNotFoundError(exception)) {
      status = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
    } else {
      this.logger.error(exception);
    }

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

  private isRpcError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;

    const err = exception as Record<string, unknown>;

    const isFlatError = 'status' in err || 'statusCode' in err;

    const isNestedError =
      'error' in err &&
      typeof err.error === 'object' &&
      err.error !== null &&
      ('status' in (err.error as Record<string, unknown>) ||
        'statusCode' in (err.error as Record<string, unknown>));

    return isFlatError || isNestedError;
  }

  private isPrismaNotFoundError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;
    const err = exception as Record<string, unknown>;
    if (err.name === 'EntityNotFoundError') return true;
    if (err.code === 'P2025') return true;
    return false;
  }

  private isGrpcServiceError(exception: unknown): boolean {
    if (!exception || typeof exception !== 'object') return false;
    const err = exception as Record<string, unknown>;
    return typeof err.code === 'number' && typeof err.details === 'string';
  }
}
