import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from '../services/auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('IdentityService', 'GoogleLogin')
  async googleLogin(data: {
    email: string;
    firstName: string;
    lastName?: string;
    picture?: string;
    provider: string;
    deviceAgent?: string;
    ipAddress?: string;
  }) {
    return this.authService.handleGoogleLogin(data);
  }

  @GrpcMethod('IdentityService', 'RefreshToken')
  async refreshToken(data: {
    oldRefreshToken: string;
    deviceAgent?: string;
    ipAddress?: string;
  }) {
    return this.authService.refreshToken(data);
  }

  @GrpcMethod('IdentityService', 'Logout')
  async logout(data: { refreshToken: string }) {
    return this.authService.logout(data.refreshToken);
  }

  @GrpcMethod('IdentityService', 'Ping')
  async ping(data: { data: string }) {
    return {
      pong: true,
      receivedAt: new Date().toISOString(),
      data: data.data ?? '',
    };
  }
}
