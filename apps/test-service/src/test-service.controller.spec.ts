import { Test, TestingModule } from '@nestjs/testing';
import { TestServiceController } from './test-service.controller';
import { TestServiceService } from './test-service.service';

describe('TestServiceController', () => {
  let testServiceController: TestServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TestServiceController],
      providers: [TestServiceService],
    }).compile();

    testServiceController = app.get<TestServiceController>(TestServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(testServiceController.getHello()).toBe('Hello World!');
    });
  });
});
