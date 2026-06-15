import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SampleController } from './sample.controller';
import { SampleService } from './sample.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SAMPLE_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'sample',
          protoPath: join(process.cwd(), 'proto/sample.proto'),
          url: process.env.SAMPLE_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [SampleController],
  providers: [SampleService],
})
export class SampleModule {}
