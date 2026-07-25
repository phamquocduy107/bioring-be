import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'P1017' ||
    err.code === 'P1001' ||
    err.code === 'P1002' ||
    err.code === 'P1008' ||
    (typeof err.message === 'string' &&
      (err.message.includes('Server has closed the connection') ||
        err.message.includes("Can't reach database server")))
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval?: NodeJS.Timeout;

  constructor() {
    super();
    return new Proxy(this, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver);
        if (
          typeof prop === 'string' &&
          !prop.startsWith('$') &&
          !prop.startsWith('_') &&
          original &&
          typeof original === 'object'
        ) {
          return new Proxy(original, {
            get(modelTarget, modelProp, modelReceiver) {
              const method = Reflect.get(modelTarget, modelProp, modelReceiver);
              if (typeof method === 'function') {
                return async (...args: any[]) => {
                  try {
                    return await method.apply(modelTarget, args);
                  } catch (error) {
                    if (isConnectionError(error)) {
                      target.logger.warn(
                        `Connection closed (${(error as any)?.code || 'P1017'}). Auto-reconnecting and retrying operation '${String(prop)}.${String(modelProp)}'...`,
                      );
                      try {
                        await (target as unknown as { $connect: () => Promise<void> }).$connect();
                      } catch {}
                      return await method.apply(modelTarget, args);
                    }
                    throw error;
                  }
                };
              }
              return method;
            },
          });
        }
        return original;
      },
    });
  }

  async onModuleInit() {
    try {
      await (this as unknown as { $connect: () => Promise<void> }).$connect();
    } catch (err) {
      this.logger.warn(`Initial database connection warning: ${err}`);
    }

    // Ping DB every 15 seconds to keep connection pool warm & handle reconnects automatically
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch {
        this.logger.warn('Database connection lost (P1017/P1001). Reconnecting...');
        try {
          await (this as unknown as { $connect: () => Promise<void> }).$connect();
        } catch {}
      }
    }, 15_000);
  }

  async forceReconnect() {
    try {
      await (this as unknown as { $disconnect: () => Promise<void> }).$disconnect();
    } catch {}
    await (this as unknown as { $connect: () => Promise<void> }).$connect();
    this.logger.log('Prisma forced reconnection completed.');
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    await (
      this as unknown as { $disconnect: () => Promise<void> }
    ).$disconnect();
  }
}
