import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DeviceController],
  providers: [DeviceService],
})
export class DeviceModule {}
