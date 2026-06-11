import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from '@app/common';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL');

        if (!url) {
          throw new Error('REDIS_URL is not found in environment variables');
        }

        const client = new Redis(url);

        client.on('connect', () => console.log('Redis connected successfully'));
        client.on('error', (err) => console.error('Redis error', err));

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
