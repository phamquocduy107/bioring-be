import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const type = context.getType();

    if (type === 'http') {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest<{
        method: string;
        url: string;
        get?: (name: string) => string | undefined;
      }>();
      const method = request.method;
      const url = request.url;
      const userAgent = request.get ? (request.get('user-agent') ?? '') : '';

      return next
        .handle()
        .pipe(
          tap(() =>
            this.logger.log(
              `[HTTP] ${method} ${url} ${userAgent} - ${Date.now() - now}ms`,
            ),
          ),
        );
    } else if (type === 'rpc') {
      return next
        .handle()
        .pipe(
          tap(() =>
            this.logger.log(`[RPC] Handler executed in ${Date.now() - now}ms`),
          ),
        );
    }

    return next.handle();
  }
}
