import { applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
export function ApiGoogleAuthDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Google OAuth login — redirects to Google consent screen',
    }),
    ApiQuery({
      name: 'platform',
      required: false,
      description: "'mobile' for mobile app flow, defaults to 'web'",
      example: 'mobile',
    }),
    ApiQuery({
      name: 'app_redirect',
      required: false,
      description:
        'Custom scheme URL to redirect back to mobile app (e.g. myapp://callback)',
      example: 'bioringapp://auth/callback',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirect to Google OAuth consent screen',
    }),
  );
}

export function ApiGoogleAuthCallbackDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Google OAuth callback — handles redirect from Google',
    }),
    ApiQuery({
      name: 'code',
      required: false,
      description: 'Authorization code from Google',
    }),
    ApiQuery({
      name: 'state',
      required: false,
      description: 'Base64url-encoded JSON with platform and appRedirect',
    }),
    ApiResponse({
      status: 302,
      description:
        'Web: redirect to FRONTEND_URL with token param + httpOnly refresh_token cookie. Mobile: redirect to app_redirect with token & refreshToken query params.',
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication failed or cancelled',
    }),
  );
}

export function ApiRefreshTokenDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Refresh access token' }),
    ApiCookieAuth('refresh_token'),
    ApiResponse({
      status: 200,
      description: 'Token refreshed successfully',
      schema: {
        example: {
          accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Refresh token not found or invalid',
      schema: {
        example: { message: 'Refresh token not found in cookies' },
      },
    }),
  );
}

export function ApiLogoutDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Logout' }),
    ApiCookieAuth('refresh_token'),
    ApiResponse({
      status: 200,
      description: 'Logged out successfully',
      schema: {
        example: { message: 'Logged out successfully' },
      },
    }),
  );
}
