import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'node:path';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './../src/ecommerce-service.module';

describe('AppController (e2e)', () => {
  let app: INestMicroservice;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.GRPC,
      options: {
        package: 'ecommerce',
        protoPath: join(process.cwd(), 'proto/ecommerce.proto'),
        url: 'localhost:50052',
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
