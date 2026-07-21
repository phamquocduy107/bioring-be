import { Module } from '@nestjs/common';

import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import {
  CommonModule,
  CustomValidationPipe,
  FitRpcExceptionFilter,
  LoggingInterceptor,
  TimeoutInterceptor,
} from '@app/common';

import { EngineModule } from './engine/engine.module';

import { BiometricAssetModule } from './assets/biometric-asset.module';

import { AttachBiometricModule } from './attach/attach-biometric.module';
import { BiometricServiceController } from './biometric-service.controller';

@Module({
  imports: [
    CommonModule,
    EngineModule,
    BiometricAssetModule,
    AttachBiometricModule,
  ],
  controllers: [BiometricServiceController],

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
export class BiometricServiceModule {}
