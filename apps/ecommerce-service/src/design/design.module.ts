import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';

@Module({
  imports: [PrismaModule],
  controllers: [DesignController],
  providers: [DesignService],
  exports: [DesignService],
})
export class DesignModule {}
