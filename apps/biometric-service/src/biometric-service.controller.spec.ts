import { Test, TestingModule } from '@nestjs/testing';
import { BiometricServiceController } from './biometric-service.controller';
import { BiometricServiceService } from './biometric-service.service';

describe('BiometricServiceController', () => {
  let controller: BiometricServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [BiometricServiceController],
      providers: [BiometricServiceService],
    }).compile();

    controller = app.get<BiometricServiceController>(
      BiometricServiceController,
    );
  });

  describe('root', () => {
    it('should return pong', () => {
      const data = { data: 'test data' };
      const response = controller.ping(data);
      expect(response).toHaveProperty('pong', true);
      expect(response).toHaveProperty('receivedAt');
      expect(response).toHaveProperty(
        'data',
        'test data Response from Biometric Service',
      );
    });
  });
});
