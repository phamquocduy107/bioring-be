import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TestServiceController } from './test-service.controller';
import { TestServiceService } from './test-service.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TEST_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'test',
          protoPath: join(process.cwd(), 'proto/test.proto'),
          url: process.env.TEST_SERVICE_GRPC_URL ?? 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [TestServiceController],
  providers: [TestServiceService],
})
export class TestServiceModule {}
