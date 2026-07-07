import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { OrderModule } from '../order/order.module';
import { MemoryCardModule } from '../memory-card/memory-card.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  imports: [PrismaModule, OrderModule, MemoryCardModule],
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
