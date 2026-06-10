import { Controller, Get } from '@nestjs/common';
import { NestjsTemplate2Service } from './nestjs-template2.service';

@Controller()
export class NestjsTemplate2Controller {
  constructor(private readonly nestjsTemplate2Service: NestjsTemplate2Service) {}

  @Get()
  getHello(): string {
    return this.nestjsTemplate2Service.getHello();
  }
}
