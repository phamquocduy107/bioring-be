import { Injectable } from '@nestjs/common';

@Injectable()
export class SampleService {
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
