import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from '../../identity.service';
import type { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly identityService: IdentityService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const deviceAgent = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const socialUser = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0]?.value,
      provider: 'google',
      deviceAgent,
      ipAddress,
    };

    const result = await this.identityService.googleLogin(socialUser);
    return result;
  }
}
