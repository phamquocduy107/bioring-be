import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SkipTimeout } from '@app/common';
import { AudioService } from './audio.service';

@Controller()
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ProcessAudio')
  async processAudio(data: {
    audioUrl: string;
    engravingVersionId: string;
  }) {
    return this.audioService.processAudio(data.audioUrl, data.engravingVersionId);
  }
}
