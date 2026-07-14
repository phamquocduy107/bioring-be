import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';

export function ApiListDevicesDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'List devices', description: 'Paginated IoT device list.' }),
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 20 }),
    ApiQuery({ name: 'status', required: false, example: 'online' }),
    ApiQuery({ name: 'search', required: false, example: 'ABC' }),
    ApiResponse({ status: 200, description: 'Device list' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiGetDeviceDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Get device by ID' }),
    ApiParam({ name: 'id' }),
    ApiResponse({ status: 200, description: 'Device info' }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}

export function ApiCreateDeviceDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Create device' }),
    ApiBody({ schema: { example: { device_name: 'Scanner-01', mac_address: 'AA:BB:CC:DD:EE:FF', device_type: 'SCANNER' } } }),
    ApiResponse({ status: 201, description: 'Created' }),
  );
}

export function ApiUpdateDeviceDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Update device' }),
    ApiParam({ name: 'id' }),
    ApiBody({ schema: { example: { device_name: 'Scanner-01', status: 'ONLINE' } } }),
    ApiResponse({ status: 200, description: 'Updated' }),
  );
}

export function ApiDeleteDeviceDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Delete device' }),
    ApiParam({ name: 'id' }),
    ApiResponse({ status: 200, description: 'Deleted', schema: { example: { success: true } } }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}
