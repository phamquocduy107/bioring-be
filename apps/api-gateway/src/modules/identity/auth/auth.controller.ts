import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '@app/common';
import type { RequestWithUser } from '@app/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from '../identity.service';
import { GoogleOauthGuard } from './guards/google.guard';
import {
  ApiGoogleAuthDocs,
  ApiGoogleAuthCallbackDocs,
  ApiRefreshTokenDocs,
  ApiLogoutDocs,
} from './auth.swagger';

@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  @ApiGoogleAuthDocs()
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  @ApiGoogleAuthCallbackDocs()
  async googleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user;
    const rawState = req.query.state;

    let platform = 'web';
    let appRedirect: string | undefined;

    if (rawState) {
      try {
        const decoded = JSON.parse(
          Buffer.from(rawState, 'base64url').toString('utf-8'),
        ) as { platform?: string; appRedirect?: string };
        platform = decoded.platform || 'web';
        appRedirect = decoded.appRedirect;
      } catch {
        platform = rawState;
      }
    }

    if (platform === 'mobile' && appRedirect) {
      const redirect = new URL(appRedirect);
      redirect.searchParams.set('token', accessToken);
      redirect.searchParams.set('refreshToken', refreshToken);
      return res.redirect(redirect.toString());
    }

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    return res.redirect(`${frontendUrl}?token=${accessToken}`);
  }

  @Post('refresh')
  @ApiRefreshTokenDocs()
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies?.['refresh_token'];
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    const result = await this.identityService.refreshToken({
      oldRefreshToken,
      deviceAgent: req.headers['user-agent'] ?? '',
      ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @ApiLogoutDocs()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (refreshToken) {
      await this.identityService.logout({ refreshToken });
    }

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }
}
