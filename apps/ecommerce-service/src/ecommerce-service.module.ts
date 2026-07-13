import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { CardThemeModule } from './card-theme/card-theme.module';
import { GuestModule } from './guest/guest.module';
import { AdminModule } from './admin/admin.module';
import { CaptureSessionModule } from './capture-session/capture-session.module';
import { NotificationModule as EcommerceNotificationModule } from './notification/notification.module';
import { CustomerModule } from './customer/customer.module';
import { WarrantyModule } from './warranty/warranty.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CommonModule,
    PrismaModule,
    CatalogModule,
    DesignModule,
    OrderModule,
    EngravingModule,
    MemoryCardModule,
    CardThemeModule,
    GuestModule,
    CaptureSessionModule,
    AdminModule,
    EcommerceNotificationModule,
    CustomerModule,
    WarrantyModule,
    AuditModule,
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
