import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

@Module({
  imports: [PrismaModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
