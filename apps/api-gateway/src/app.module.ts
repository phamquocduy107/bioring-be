import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
  TimeoutInterceptor,
  TransformInterceptor,
} from '@app/common';
import { SampleModule } from './modules/sample/sample.module';

@Module({
  imports: [
    CommonModule,
    RedisModule,
    BullConfigModule,
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    EventEmitterModule.forRoot(),
    ClientsModule.register([
      {
        name: 'SAMPLE_SERVICE', // Tên tham chiếu đến microservice
        transport: Transport.TCP,
        options: {
          port: Number(process.env.SERVICE_PORT ?? 3001),
        },
      },
    ]),
    SampleModule,
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
  ],
})
export class AppModule {}
