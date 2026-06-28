import { Injectable } from '@nestjs/common';
import { AudioProcessingClient } from './audio-processing.client';

@Injectable()
export class AudioService {
  constructor(private readonly audioClient: AudioProcessingClient) {}

  async processAudio(audioUrl: string, engravingVersionId: string) {
    const result = await this.audioClient.processAudio(
      audioUrl,
      engravingVersionId,
    );

    return {
      waveformUrl: result.waveformUrl,
      durationMs: result.durationMs,
    };
  }
}
