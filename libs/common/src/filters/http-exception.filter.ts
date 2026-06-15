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
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
          ? String((responseBody as Record<string, string>).message ?? '')
          : typeof responseBody === 'string'
            ? responseBody
            : 'Http Error';
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
}
