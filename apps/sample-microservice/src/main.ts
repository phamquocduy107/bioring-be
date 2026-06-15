import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './sample-microservice.module';

const GRPC_URL = process.env.SAMPLE_GRPC_URL ?? '0.0.0.0:50051';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'sample',
        protoPath: join(process.cwd(), 'proto/sample.proto'),
        url: GRPC_URL,
      },
    },
  );

  await app.listen();
  console.log(`[Microservice] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
