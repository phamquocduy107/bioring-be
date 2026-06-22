import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BiometricServiceService } from './biometric-service.service';

type PingRequest = {
  data?: string;
};

@Controller()
export class BiometricServiceController {
  constructor(
    private readonly biometricServiceService: BiometricServiceService,
  ) {}

  @GrpcMethod('BiometricService', 'Ping')
  ping(data: PingRequest) {
    return this.biometricServiceService.ping(data);
  }
}
