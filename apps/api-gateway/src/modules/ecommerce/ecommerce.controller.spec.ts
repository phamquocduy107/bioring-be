import { Test, TestingModule } from '@nestjs/testing';
import { EcommerceController } from './ecommerce.controller';
import { EcommerceService } from './ecommerce.service';

describe('EcommerceController', () => {
  let controller: EcommerceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EcommerceController],
      providers: [EcommerceService],
    }).compile();

    controller = app.get<EcommerceController>(EcommerceController);
  });

  describe('root', () => {
    it('should return health status', () => {
      const health = controller.getHealth();
      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('timestamp');
    });
  });
});
