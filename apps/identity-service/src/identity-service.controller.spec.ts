import { Test, TestingModule } from '@nestjs/testing';
import { IdentityServiceController } from './identity-service.controller';
import { IdentityServiceService } from './identity-service.service';

describe('IdentityServiceController', () => {
  let controller: IdentityServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [IdentityServiceController],
      providers: [IdentityServiceService],
    }).compile();

    controller = app.get<IdentityServiceController>(IdentityServiceController);
  });

  describe('root', () => {
    it('should return pong', () => {
      const data = { data: 'test data' };
      const response = controller.ping(data);
      expect(response).toHaveProperty('pong', true);
      expect(response).toHaveProperty('receivedAt');
      expect(response).toHaveProperty(
        'data',
        'test data Response from Identity Service',
      );
    });
  });
});
