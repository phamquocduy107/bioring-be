import { Module } from '@nestjs/common';
import { NestjsTemplate2Controller } from './nestjs-template2.controller';
import { NestjsTemplate2Service } from './nestjs-template2.service';

@Module({
  imports: [],
  controllers: [NestjsTemplate2Controller],
  providers: [NestjsTemplate2Service],
})
export class NestjsTemplate2Module {}
