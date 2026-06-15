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
      return next.handle() as Observable<Response<T>>;
    }

    return next.handle().pipe(
      map((data: unknown) => {
        const contextHttp = context.switchToHttp();
        const response = contextHttp.getResponse<{
          status: (code: number) => void;
        }>();

        let status = HttpStatus.OK;
        let message = 'Success';
        let resultData: unknown = data;
        let meta: unknown = undefined;

        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;

          if (Array.isArray(data)) {
            resultData = data;
          } else if ('data' in obj && 'meta' in obj) {
            message = typeof obj.message === 'string' ? obj.message : message;
            status =
              typeof obj.statusCode === 'number' ? obj.statusCode : status;
            resultData = obj.data;
            meta = obj.meta;
          } else {
            if (typeof obj.statusCode === 'number') status = obj.statusCode;
            if (typeof obj.message === 'string') message = obj.message;

            const rest = { ...obj };
            delete rest.statusCode;
            delete rest.message;
            resultData = Object.keys(rest).length > 0 ? rest : null;
          }
        }

        response.status(status);

        return {
          statusCode: status,
          message: message,
          data: resultData as T,
          meta: meta,
        } as Response<T>;
      }),
    );
  }
}
