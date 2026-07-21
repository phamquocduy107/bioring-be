import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
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

export function ApiGetMeDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get current user profile + permissions',
      description:
        "Returns the authenticated user's profile and permission slugs for UI rendering.",
    }),
    ApiResponse({
      status: 200,
      description: 'Current user info',
      schema: {
        example: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'admin@bioring.com',
            fullName: 'Admin',
            phone: '0909123456',
            avatarUrl: null,
            status: 'ACTIVE',
            customerType: null,
            isVip: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            roles: ['ADMIN'],
          },
          permissions: [
            'user.read',
            'user.write',
            'order.read',
            'order.write',
            'dashboard.view',
          ],
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}
