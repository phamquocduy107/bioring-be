import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';

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
        },
      },
    ]),
  ],
  controllers: [BiometricController],
  providers: [BiometricService],
})
export class BiometricModule {}
