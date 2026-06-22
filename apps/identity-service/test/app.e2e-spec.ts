import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'node:path';
import { Transport } from '@nestjs/microservices';
import { IdentityServiceModule } from './../src/identity-service.module';

describe('IdentityServiceController (e2e)', () => {
  let app: INestMicroservice;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IdentityServiceModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'identity',
        protoPath: join(process.cwd(), 'proto/identity.proto'),
        url: 'localhost:50053',
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
