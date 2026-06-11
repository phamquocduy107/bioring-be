import { Test, TestingModule } from '@nestjs/testing';
import { NestjsTemplate2Controller } from './nestjs-template2.controller';
import { NestjsTemplate2Service } from './nestjs-template2.service';

describe('NestjsTemplate2Controller', () => {
  let nestjsTemplate2Controller: NestjsTemplate2Controller;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [NestjsTemplate2Controller],
      providers: [NestjsTemplate2Service],
    }).compile();

    nestjsTemplate2Controller = app.get<NestjsTemplate2Controller>(
      NestjsTemplate2Controller,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(nestjsTemplate2Controller.getHello()).toBe('Hello World!');
    });
  });
});
