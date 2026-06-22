import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { IdentityServiceModule } from './identity-service.module';

const GRPC_URL = process.env.IDENTITY_GRPC_URL ?? '0.0.0.0:50052';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    IdentityServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'identity',
        protoPath: join(process.cwd(), 'proto/identity.proto'),
        url: GRPC_URL,
      },
    },
  );

  await app.listen();
  console.log(`[IdentityService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
