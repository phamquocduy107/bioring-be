import { MINIO_CLIENT } from '@app/common';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MinioService } from './minio.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MINIO_CLIENT,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('MinIO');
        const endPoint = configService.get<string>(
          'MINIO_ENDPOINT',
          'localhost',
        );
        const port = Number(configService.get<string>('MINIO_PORT', '9000'));
        const useSSL =
          configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
        const accessKey = configService.get<string>(
          'MINIO_ACCESS_KEY',
          'minioadmin',
        );
        const secretKey = configService.get<string>(
          'MINIO_SECRET_KEY',
          'minioadmin',
        );

        const client = new Minio.Client({
          endPoint,
          port,
          useSSL,
          accessKey,
          secretKey,
        });

        logger.log(
          `MinIO client configured (${endPoint}:${port}, ssl=${useSSL})`,
        );
        return client;
      },
      inject: [ConfigService],
    },
    MinioService,
  ],
  exports: [MinioService, MINIO_CLIENT],
})
export class MinioModule {}
