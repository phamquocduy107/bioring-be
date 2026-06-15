import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './ecommerce-service.controller';
import { AppService } from './ecommerce-service.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return pong', () => {
      const data = { data: 'test data' };
      const response = appController.ping(data);
      expect(response).toHaveProperty('pong', true);
      expect(response).toHaveProperty('receivedAt');
      expect(response).toHaveProperty('data', 'test data (processed by ecommerce-service)');
    });
  });
});
