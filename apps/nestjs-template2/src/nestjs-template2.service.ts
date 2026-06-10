import { Injectable } from '@nestjs/common';

@Injectable()
export class NestjsTemplate2Service {
  getHello(): string {
    return 'Hello World!';
  }
}
