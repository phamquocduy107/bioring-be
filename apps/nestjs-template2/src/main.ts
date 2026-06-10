import { NestFactory } from '@nestjs/core';
import { NestjsTemplate2Module } from './nestjs-template2.module';

async function bootstrap() {
  const app = await NestFactory.create(NestjsTemplate2Module);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
