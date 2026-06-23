import { Module, OnModuleInit } from '@nestjs/common';
import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { RbacService } from '@app/common';
import { IdentityController } from './health/identity.controller';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { RbacController } from './rbac/rbac.controller';
import { IdentityService } from './identity.service';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { GoogleOauthGuard } from './auth/guards/google.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'google' }),
    ClientsModule.register([
      {
        name: 'IDENTITY_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'identity',
          protoPath: join(process.cwd(), 'proto/identity.proto'),
          url: process.env.IDENTITY_GRPC_URL ?? 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [
    IdentityController,
    AuthController,
    UsersController,
    RbacController,
  ],
  providers: [IdentityService, GoogleStrategy, GoogleOauthGuard],
  exports: [IdentityService],
})
export class IdentityModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly identityService: IdentityService,
  ) {}

  onModuleInit() {
    this.rbacService.setPermissionResolver(async (userId: string) => {
      try {
        const result = await this.identityService.getUserPermissions(userId);
        return result.permissionSlugs ?? [];
      } catch {
        return [];
      }
    });
  }
}
