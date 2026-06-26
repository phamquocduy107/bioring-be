import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig = {
  global: true,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): JwtModuleOptions => ({
    secret: configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
    signOptions: {
      expiresIn: Number(configService.get('JWT_ACCESS_TOKEN_EXPIRATION', '86400')),
    },
  }),
};
