import { Test, TestingModule } from '@nestjs/testing';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';

describe('BiometricController', () => {
  let controller: BiometricController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiometricController],
      providers: [BiometricService],
    }).compile();

    controller = module.get<BiometricController>(BiometricController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
