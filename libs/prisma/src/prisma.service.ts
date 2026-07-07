import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    await (this as unknown as { $connect: () => Promise<void> }).$connect();
  }

  async onModuleDestroy() {
    await (
      this as unknown as { $disconnect: () => Promise<void> }
    ).$disconnect();
  }
}
