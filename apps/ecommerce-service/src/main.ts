import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BIOMETRIC_GRPC_CHANNEL_OPTIONS } from '@app/common';
import { AppModule } from './ecommerce-service.module';

const GRPC_URL = process.env.ECOMMERCE_GRPC_URL ?? '0.0.0.0:50051';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'ecommerce',
        protoPath: join(process.cwd(), 'proto/ecommerce.proto'),
        url: GRPC_URL,
        channelOptions: BIOMETRIC_GRPC_CHANNEL_OPTIONS,
      },
    },
  );

  await app.listen();
  console.log(`[EcommerceService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
