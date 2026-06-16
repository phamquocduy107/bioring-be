import { Injectable } from '@nestjs/common';

type PingRequest = {
  data?: string;
};

@Injectable()
export class TestServiceService {
  ping(data: PingRequest): { pong: boolean; receivedAt: string; data: string } {
    return {
      pong: true,
      receivedAt: new Date().toISOString(),
      data: data.data ?? '',
    };
  }
}
