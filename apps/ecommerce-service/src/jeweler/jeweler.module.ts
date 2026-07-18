import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { JewelerController } from './jeweler.controller';
import { JewelerService } from './jeweler.service';

@Module({
  imports: [PrismaModule],
  controllers: [JewelerController],
  providers: [JewelerService],
})
export class JewelerModule {}
