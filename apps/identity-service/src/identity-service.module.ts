import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  CommonModule,
  CustomValidationPipe,
  FitRpcExceptionFilter,
  LoggingInterceptor,
  TimeoutInterceptor,
} from '@app/common';
import { PrismaModule } from '@app/prisma';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { RbacController } from './controllers/rbac.controller';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { RbacService } from './services/rbac.service';

@Module({
  imports: [CommonModule, PrismaModule],
  controllers: [AuthController, UsersController, RbacController],
  providers: [
    AuthService,
    UsersService,
    RbacService,
    {
      provide: APP_FILTER,
      useClass: FitRpcExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: CustomValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class IdentityServiceModule {}
