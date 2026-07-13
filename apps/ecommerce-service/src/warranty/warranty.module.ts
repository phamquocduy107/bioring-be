import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { PayOSService } from '@app/common/payment/payos.service';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';

@Module({
  imports: [PrismaModule],
  controllers: [WarrantyController],
  providers: [WarrantyService, PayOSService],
})
export class WarrantyModule {}
