import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './sample-microservice.module';

const SERVICE_PORT = Number(process.env.SERVICE_PORT ?? 3001);

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        port: SERVICE_PORT,
      },
    },
  );

  await app.listen();
  console.log(`[Microservice] running on TCP port ${SERVICE_PORT}`);
}
bootstrap();
