import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BIOMETRIC_GRPC_CHANNEL_OPTIONS } from '@app/common';
import { BiometricService } from './biometric.service';
import {
  AdminBiometricAssetsController,
  MeBiometricAssetsController,
  MeEngravingBiometricsController,
} from './biometric.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'BIOMETRIC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'biometric',
          protoPath: join(process.cwd(), 'proto/biometric.proto'),
          url: process.env.BIOMETRIC_GRPC_URL ?? 'localhost:50053',
          channelOptions: BIOMETRIC_GRPC_CHANNEL_OPTIONS,
        },
      },
    ]),
  ],
  controllers: [
    AdminBiometricAssetsController,
    MeBiometricAssetsController,
    MeEngravingBiometricsController,
  ],
  providers: [BiometricService],
})
export class BiometricModule {}
