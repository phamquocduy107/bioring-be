import { Injectable } from '@nestjs/common';

type PingRequest = {
  data?: string;
};

@Injectable()
export class IdentityServiceService {
  ping(data: PingRequest): { pong: boolean; receivedAt: string; data: string } {
    return {
      pong: true,
      receivedAt: new Date().toISOString(),
      data: (data.data ?? '') + ' Response from Identity Service',
    };
  }
}
