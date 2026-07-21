import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class BiometricServiceController {
  @GrpcMethod('BiometricService', 'Ping')
  ping(data: { data?: string }) {
    return {
      pong: true,
      receivedAt: new Date().toISOString(),
      data: data.data ?? '',
    };
  }
}
