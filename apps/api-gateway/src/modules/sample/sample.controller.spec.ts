import { Test, TestingModule } from '@nestjs/testing';
import { SampleController } from './sample.controller';
import { SampleService } from './sample.service';

describe('SampleController', () => {
  let sampleController: SampleController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SampleController],
      providers: [SampleService],
    }).compile();

    sampleController = app.get<SampleController>(SampleController);
  });

  describe('root', () => {
    it('should return health status', () => {
      const health = sampleController.getHealth();
      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('timestamp');
    });
  });
});
