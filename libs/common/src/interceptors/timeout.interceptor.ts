import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { BYPASS_INTERCEPTORS, SKIP_TIMEOUT } from '../decorators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const bypass = this.reflector.get<boolean>(
      BYPASS_INTERCEPTORS,
      context.getHandler(),
    );
    if (bypass) {
      return next.handle();
    }

    const skipTimeout = this.reflector.get<boolean>(
      SKIP_TIMEOUT,
      context.getHandler(),
    );

    if (skipTimeout) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(5000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('Request xử lý quá lâu!'),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
