import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { JewelerService } from './jeweler.service';

@Controller()
export class JewelerController {
  constructor(private readonly service: JewelerService) {}

  @GrpcMethod('EcommerceService', 'GetMyPerformance')
  async getMyPerformance(data: { jewelerId: string; from_date?: string }) {
    return this.service.getMyPerformance(data.jewelerId, data.from_date);
  }

  @GrpcMethod('EcommerceService', 'GetMyCurrentTask')
  async getMyCurrentTask(data: { jewelerId: string }) {
    return this.service.getMyCurrentTask(data.jewelerId);
  }
}
