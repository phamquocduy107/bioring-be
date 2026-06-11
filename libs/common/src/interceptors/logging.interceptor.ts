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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const type = context.getType();

    // 1. Nếu là HTTP (Gateway)
    if (type === 'http') {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest();
      const method = request.method;
      const url = request.url;
      // Chỉ gọi request.get() khi chắc chắn là HTTP
      const userAgent = request.get ? request.get('user-agent') : '';

      return next
        .handle()
        .pipe(
          tap(() =>
            this.logger.log(
              `[HTTP] ${method} ${url} ${userAgent} - ${Date.now() - now}ms`,
            ),
          ),
        );
    }

    // 2. Nếu là RPC
    else if (type === 'rpc') {
      const ctx = context.switchToRpc();
      const data = ctx.getData();
      return next
        .handle()
        .pipe(
          tap(() =>
            this.logger.log(`[RPC] Handler executed in ${Date.now() - now}ms`),
          ),
        );
    }

    // 3. Trường hợp khác (mặc định)
    return next.handle();
  }
}
