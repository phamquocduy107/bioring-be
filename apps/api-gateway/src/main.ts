import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('API Gateway');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    .addCookieAuth('guest-session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'guest_session_id',
      description:
        'Guest browser session (HttpOnly). Auto-set by guest chat endpoints.',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // =========================================================
  // 4. CORS — reflect request Origin (works with credentials locally)
  // Prefer same-origin demo: /demo/knowledge-chat-demo.html
  // =========================================================
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Static knowledge chat demo (same-origin → no CORS issues)
  app.useStaticAssets(join(process.cwd(), 'docs'), {
    prefix: '/demo/',
  });

  // =========================================================
  // 5. KHỞI ĐỘNG
  // =========================================================
  // await app.startAllMicroservices(); // uncomment nếu dùng RabbitMQ
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log(`HTTP Server running on port ${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
  logger.log(
    `Chat demo at http://localhost:${port}/demo/knowledge-chat-demo.html`,
  );
  logger.log(
    `Email previews at http://localhost:${port}/demo/email-previews/index.html`,
  );
}void bootstrap();
