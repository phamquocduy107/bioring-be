import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { RingSizeService } from './ring-size.service';
import { RingSizeController } from './ring-size.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RingSizeController],
  providers: [RingSizeService],
  exports: [RingSizeService],
})
export class RingSizeModule {}
