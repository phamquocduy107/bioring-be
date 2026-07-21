import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BIOMETRIC_GRPC_CHANNEL_OPTIONS } from '@app/common';
import { BiometricServiceModule } from './biometric-service.module';

const GRPC_URL = process.env.BIOMETRIC_GRPC_URL ?? '0.0.0.0:50053';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BiometricServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'biometric',
        protoPath: join(process.cwd(), 'proto/biometric.proto'),
        url: GRPC_URL,
        channelOptions: BIOMETRIC_GRPC_CHANNEL_OPTIONS,
      },
    },
  );

  await app.listen();
  console.log(`[BiometricService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
