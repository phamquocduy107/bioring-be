import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiHealthDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Health check endpoint' }),
    ApiResponse({
      status: 200,
      description: 'API Gateway health status',
      schema: {
        example: {
          status: 'ok',
          message: 'API Gateway is healthy',
          timestamp: '2026-06-24T10:00:00.000Z',
        },
      },
    }),
  );
}

export function ApiPingMicroserviceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Ping biometric service through gRPC' }),
    ApiResponse({
      status: 200,
      description: 'gRPC ping response',
      schema: {
        example: {
          pong: true,
          receivedAt: '2026-06-24T10:00:00.000Z',
          data: 'ping from api-gateway',
        },
      },
    }),
  );
}
