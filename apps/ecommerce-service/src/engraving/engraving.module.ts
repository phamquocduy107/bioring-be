import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { EngravingController } from './engraving.controller';
import { EngravingService } from './engraving.service';
import { AudioProcessingClient } from './audio-processing.client';

@Module({
  imports: [PrismaModule],
  controllers: [EngravingController],
  providers: [EngravingService, AudioProcessingClient],
})
export class EngravingModule {}
