import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { IdentityServiceService } from './identity-service.service';

type PingRequest = {
  data?: string;
};

@Controller()
export class IdentityServiceController {
  constructor(
    private readonly identityServiceService: IdentityServiceService,
  ) {}

  @GrpcMethod('IdentityService', 'Ping')
  ping(data: PingRequest) {
    return this.identityServiceService.ping(data);
  }
}
