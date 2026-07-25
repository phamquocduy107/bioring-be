import 'dotenv/config';
import {
  KNOWLEDGE_GRPC_CHANNEL_OPTIONS,
  KNOWLEDGE_GRPC_LOADER_OPTIONS,
} from '@app/common';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RagServiceModule } from './rag-service.module';

const GRPC_URL = process.env.KNOWLEDGE_GRPC_URL ?? '0.0.0.0:50054';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    RagServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'knowledge',
        protoPath: join(process.cwd(), 'proto/knowledge.proto'),
        url: GRPC_URL,
        channelOptions: KNOWLEDGE_GRPC_CHANNEL_OPTIONS,
        loader: KNOWLEDGE_GRPC_LOADER_OPTIONS,
      },
    },
  );

  await app.listen();
  console.log(`[RagService] running on gRPC ${GRPC_URL}`);
}
void bootstrap();
