import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { TestServiceService } from './test-service.service';

type PingRequest = {
  data?: string;
};

@Controller()
export class TestServiceController {
  constructor(private readonly testServiceService: TestServiceService) {}

  @GrpcMethod('TestService', 'Ping')
  ping(data: PingRequest) {
    const responseData = data.data + ' (processed by test service)';
    return this.testServiceService.ping({ ...data, data: responseData });
  }
}
