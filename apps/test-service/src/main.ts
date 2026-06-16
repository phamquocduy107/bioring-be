import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TestServiceModule } from './test-service.module';

const GRPC_URL = process.env.TEST_SERVICE_GRPC_URL ?? '0.0.0.0:50052';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TestServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'test',
        protoPath: join(process.cwd(), 'proto/test.proto'),
        url: GRPC_URL,
      },
    },
  );

  await app.listen();
  console.log(`[TestService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
