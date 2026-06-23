import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const platform = (req.query.platform as string) || 'web';
    const appRedirect = req.query.app_redirect as string | undefined;

    const statePayload: Record<string, string> = { platform };
    if (appRedirect) {
      statePayload.appRedirect = appRedirect;
    }

    return {
      prompt: 'select_account consent' as const,
      access_type: 'offline' as const,
      state: Buffer.from(JSON.stringify(statePayload)).toString('base64url'),
    };
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    const res = context.switchToHttp().getResponse<Response>();
    const req = context.switchToHttp().getRequest<Request>();
    const rawState = (req.query.state as string) || '';

    if (user) return user;

    let platform = 'web';
    try {
      const decoded = JSON.parse(
        Buffer.from(rawState, 'base64url').toString('utf-8'),
      );
      platform = decoded.platform || 'web';
    } catch {
      platform = rawState || 'web';
    }

    if (platform === 'mobile') {
      const appRedirect = req.query.app_redirect as string;
      if (appRedirect) {
        const redirect = new URL(appRedirect);
        redirect.searchParams.set('status', 'cancelled');
        res.redirect(redirect.toString());
        return;
      }
    }

    if (err || !user) throw new UnauthorizedException('GOOGLE_AUTH_CANCELLED');
  }
}
