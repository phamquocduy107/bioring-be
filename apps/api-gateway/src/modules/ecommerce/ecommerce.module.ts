import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EcommerceController } from './ecommerce.controller';
import { EcommerceService } from './ecommerce.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ECOMMERCE_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'ecommerce',
          protoPath: join(process.cwd(), 'proto/ecommerce.proto'),
          url: process.env.ECOMMERCE_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [EcommerceController],
  providers: [EcommerceService],
})
export class EcommerceModule {}
