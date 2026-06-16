import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './ecommerce-service.service';

type PingRequest = {
  data?: string;
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('EcommerceService', 'Ping')
  ping(data: PingRequest) {
    return this.appService.ping(data);
  }
}
