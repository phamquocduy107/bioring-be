import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AudioProcessingClient } from './audio-processing.client';

@Module({
  controllers: [AudioController],
  providers: [AudioService, AudioProcessingClient],
})
export class AudioModule {}
