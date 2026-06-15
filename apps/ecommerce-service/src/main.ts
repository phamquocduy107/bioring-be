import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
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
      },
    },
  );

  await app.listen();
  console.log(`[EcommerceService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
