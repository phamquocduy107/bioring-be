import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  ping(data: any): { pong: boolean; receivedAt: string; data: any } {
    return {
      pong: true,
      receivedAt: new Date().toISOString(),
      data,
    };
  }
}
