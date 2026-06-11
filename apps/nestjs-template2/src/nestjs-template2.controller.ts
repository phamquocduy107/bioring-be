import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './nestjs-template2.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Ví dụ: ping message pattern
   * Gọi từ gateway: this.client.send('ping', {})
   */
  @MessagePattern('ping')
  ping(@Payload() data: any) {
    return this.appService.ping(data);
  }
}
