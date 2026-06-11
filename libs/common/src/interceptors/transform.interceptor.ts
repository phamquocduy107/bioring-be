import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BYPASS_INTERCEPTORS } from '../decorators';
import { Reflector } from '@nestjs/core';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  constructor(private reflector: Reflector) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const bypass = this.reflector.get<boolean>(
      BYPASS_INTERCEPTORS,
      context.getHandler(),
    );
    if (bypass) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const contextHttp = context.switchToHttp();
        const response = contextHttp.getResponse();

        let status = HttpStatus.OK;
        let message = 'Success';
        let resultData = data;
        let meta = undefined;

        if (data && typeof data === 'object') {
          if (Array.isArray(data)) {
            resultData = data;
          } else {
            if ('data' in data && 'meta' in data) {
              message = data.message || message;
              status = data.statusCode || status;
              resultData = data.data;
              meta = data.meta;
            } else {
              if ('statusCode' in data) status = data.statusCode;
              if ('message' in data) message = data.message;

              const { statusCode, message: msg, ...rest } = data;
              resultData = rest;

              if (Object.keys(resultData).length === 0) {
                resultData = null;
              }
            }
          }
        }

        response.status(status);

        return {
          statusCode: status,
          message: message,
          data: resultData,
          meta: meta,
        };
      }),
    );
  }
}
