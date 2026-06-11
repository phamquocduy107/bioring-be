import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig } from './config/jwt.config';
import { appConfig } from './config/app.config';
import { RbacModule } from './rbac/rbac.module';

@Global()
@Module({
  imports: [
    RbacModule,
    ConfigModule.forRoot(appConfig),
    JwtModule.registerAsync(jwtConfig),
  ],
  exports: [JwtModule, ConfigModule, RbacModule],
})
export class CommonModule {}
