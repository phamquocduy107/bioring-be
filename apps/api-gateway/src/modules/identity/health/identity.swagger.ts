import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiGetHealthDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Health check — gateway status' }),
    ApiResponse({
      status: 200,
      description: 'Gateway is healthy',
      schema: {
        example: {
          status: 'ok',
          message: 'API Gateway is healthy',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      },
    }),
  );
}

export function ApiPingMicroserviceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Ping identity microservice via gRPC' }),
    ApiResponse({
      status: 200,
      description: 'Ping result from identity service',
      schema: {
        example: {
          pong: true,
          receivedAt: '2026-01-01T00:00:00.000Z',
          data: 'ping from api-gateway',
        },
      },
    }),
    ApiResponse({
      status: 502,
      description: 'Identity service unreachable',
      schema: {
        example: {
          pong: false,
          receivedAt: '2026-01-01T00:00:00.000Z',
          data: 'IDENTITY_SERVICE gRPC client is not initialized',
        },
      },
    }),
  );
}
