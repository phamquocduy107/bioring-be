import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrderController],
  providers: [OrderService, PayOSService],
  exports: [OrderService],
})
export class OrderModule {}
