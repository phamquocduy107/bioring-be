import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './sample-microservice.service';

type PingRequest = {
  data?: string;
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('SampleService', 'Ping')
  ping(data: PingRequest) {
    return this.appService.ping(data);
  }
}
