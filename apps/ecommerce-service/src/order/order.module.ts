import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import { BIOMETRIC_GRPC_CHANNEL_OPTIONS } from '@app/common';
import { PrismaModule } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    PrismaModule,
    ClientsModule.register([
      {
        name: 'BIOMETRIC_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'biometric',
          protoPath: join(process.cwd(), 'proto/biometric.proto'),
          url: process.env.BIOMETRIC_GRPC_URL ?? 'localhost:50053',
          channelOptions: BIOMETRIC_GRPC_CHANNEL_OPTIONS,
        },
      },
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService, PayOSService],
  exports: [OrderService],
})
export class OrderModule {}
