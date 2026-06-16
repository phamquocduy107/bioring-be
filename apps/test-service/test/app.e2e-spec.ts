import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'node:path';
import { Transport } from '@nestjs/microservices';
import { TestServiceModule } from './../src/test-service.module';

describe('TestServiceController (e2e)', () => {
  let app: INestMicroservice;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestServiceModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'test',
        protoPath: join(process.cwd(), 'proto/test.proto'),
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
