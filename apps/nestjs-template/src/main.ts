import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { RmqService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // =========================================================
  // 1. COOKIE PARSER
  // =========================================================
  app.use(cookieParser());

  // =========================================================
  // 2. RABBITMQ (uncomment nếu gateway cần consume RabbitMQ)
  // =========================================================
  // const rmqService = app.get<RmqService>(RmqService);
  // app.connectMicroservice(rmqService.getOptions('API_GATEWAY', false));

  // =========================================================
  // 3. SWAGGER
  // =========================================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('API Gateway documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // =========================================================
  // 4. CORS
  // =========================================================
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
  });

  // =========================================================
  // 5. KHỞI ĐỘNG
  // =========================================================
  // await app.startAllMicroservices(); // uncomment nếu dùng RabbitMQ
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  console.log(`[API Gateway] HTTP Server running on port ${port}`);
  console.log(`[API Gateway] Swagger docs at http://localhost:${port}/docs`);
}
bootstrap();
