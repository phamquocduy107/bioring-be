import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AudioProcessingClient {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'AUDIO_PROCESSING_URL',
      'http://localhost:5051',
    );
  }

  async processAudio(
    audioUrl: string,
    engravingVersionId: string,
  ): Promise<{ waveformUrl: string; durationMs: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/process-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, engravingVersionId }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new HttpException(
          `Audio processing failed: ${err}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const json = (await response.json()) as {
        waveformUrl: string;
        durationMs: number;
      };
      return json;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `Audio processing service unreachable: ${(error as Error).message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
