import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  CommonModule,
  CustomValidationPipe,
  FitRpcExceptionFilter,
  LoggingInterceptor,
  TimeoutInterceptor,
} from '@app/common';
import { PrismaModule } from '@app/prisma';
import { CatalogModule } from './catalog/catalog.module';
import { DesignModule } from './design/design.module';
import { OrderModule } from './order/order.module';
import { EngravingModule } from './engraving/engraving.module';
import { MemoryCardModule } from './memory-card/memory-card.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    CatalogModule,
    DesignModule,
    OrderModule,
    EngravingModule,
    MemoryCardModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: FitRpcExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class AppModule {}
