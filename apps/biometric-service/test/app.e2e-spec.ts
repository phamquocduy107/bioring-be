import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'node:path';
import { Transport } from '@nestjs/microservices';
import { BiometricServiceModule } from './../src/biometric-service.module';

describe('BiometricServiceController (e2e)', () => {
  let app: INestMicroservice;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BiometricServiceModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'biometric',
        protoPath: join(process.cwd(), 'proto/biometric.proto'),
        url: 'localhost:50054',
      },
    });
    await app.init();
  });

  it('should initialize the microservice', () => {
    expect(app).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
