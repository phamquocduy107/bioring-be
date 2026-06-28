import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AudioService } from './audio.service';

@Controller()
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @GrpcMethod('BiometricService', 'ProcessAudio')
  async processAudio(data: {
    audioUrl: string;
    engravingVersionId: string;
  }) {
    return this.audioService.processAudio(data.audioUrl, data.engravingVersionId);
  }
}
