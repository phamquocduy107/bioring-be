import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullConfigModule } from '@app/common/queue/bull-mq';
import { BullBoardModule } from '@bull-board/nestjs/dist/bull-board.module';
import { ExpressAdapter } from '@bull-board/express';
import { RedisModule } from '@app/redis';
import {
  AllExceptionsFilter,
  AuthGuard,
  CommonModule,
  CustomValidationPipe,
  LoggingInterceptor,
  PermissionRbacGuard,
  TimeoutInterceptor,
  TransformInterceptor,
} from '@app/common';
import { BiometricModule } from './modules/biometric/biometric.module';
import { EcommerceModule } from './modules/ecommerce/ecommerce.module';
import { IdentityModule } from './modules/identity/identity.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { TrackController } from './modules/track/track.controller';
import { PrismaModule } from '@app/prisma';


@Module({
  imports: [
    CommonModule,
    RedisModule,
    PrismaModule,
    BullConfigModule,
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    EventEmitterModule.forRoot(),
    BiometricModule,
    EcommerceModule,
    IdentityModule,
    KnowledgeModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionRbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    TrackController,
  ],
})
export class AppModule {}
