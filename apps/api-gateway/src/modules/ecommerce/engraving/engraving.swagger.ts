import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

export function ApiCreateEngravingDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Create a new engraving (from mobile without design code)',
      description:
        'Tạo engraving mới trên mobile (khi user không có design code). ' +
        'System tạo Engraving + EngravingVersion v1 rỗng + qr_memories default. ' +
        'Trả về engravingId, versionId, qrCode.',
    }),
    ApiResponse({
      status: 201,
      description: 'Engraving created successfully.',
      schema: {
        example: {
          engraving: {
            id: '550e8400-e29b-41d4-a716-446655440003',
            orderId: '',
            userId: '550e8400-e29b-41d4-a716-446655440002',
            productId: '',
            uniqueProductId: '',
            approvedVersionId: '',
            status: 'PENDING',
            versions: [],
            biometrics: [],
          },
          engravingVersion: {
            id: '550e8400-e29b-41d4-a716-446655440004',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            versionNumber: 1,
            selectedMaterialId: '',
            selectedGemstoneId: '',
            ringSize: '',
            ringStyle: '',
            ringShape: '',
            customizationConfig: '',
            status: 'PENDING',
            managerId: '',
            managerNote: '',
            reviewedAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
          qrCode: 'a1b2c3d4e5f6',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function ApiUpdateEngravingVersionConfigDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Update engraving version config (incremental save)',
      description:
        'Saves/updates customizationConfig for an engraving version. Triggers audio processing if sw.audioUrl is present. ' +
        'Đây là save tạm, không đẩy đi duyệt. Dùng POST /resubmit để gửi duyệt.',
    }),
    ApiParam({
      name: 'versionId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440004',
    }),
    ApiResponse({
      status: 200,
      description: 'Config saved successfully.',
      schema: {
        example: {
          version: {
            id: '550e8400-e29b-41d4-a716-446655440004',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            versionNumber: 1,
            selectedMaterialId: 'mat-gold-18k',
            selectedGemstoneId: 'gmt-diamond-05',
            ringSize: '7',
            ringStyle: 'CLASSIC',
            ringShape: 'ROUND',
            customizationConfig:
              '{"engravedType":"sw","selectedBiometrics":["SW"],"engravingPositions":{"sw":{"enabled":true,"status":"captured","audioUrl":"https://res.cloudinary.com/.../audio.mp3","position":{"startAngle":45,"width":180}}},"memoryCard":false}',
            status: 'PENDING',
            managerId: '',
            managerNote: '',
            reviewedAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
          orderId: '',
          orderStatus: '',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Version not found' }),
  );
}

export function ApiGetMyEngravingsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get my engravings (paginated)',
      description:
        'Lấy danh sách engraving của user hiện tại. Có thể lọc theo status và orderId.',
    }),
    ApiQuery({ name: 'page', type: Number, required: false, example: 1 }),
    ApiQuery({ name: 'limit', type: Number, required: false, example: 10 }),
    ApiQuery({ name: 'status', type: String, required: false, example: 'PENDING' }),
    ApiQuery({ name: 'orderId', type: String, required: false, format: 'uuid' }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of engravings.',
      schema: {
        example: {
          engravings: [
            {
              id: '550e8400-e29b-41d4-a716-446655440003',
              orderId: '550e8400-e29b-41d4-a716-446655440001',
              userId: '550e8400-e29b-41d4-a716-446655440002',
              productId: '',
              uniqueProductId: '',
              approvedVersionId: '',
              status: 'PENDING',
              versions: [],
              biometrics: [],
              qrMemory: null,
              currentVersion: {
                id: '550e8400-e29b-41d4-a716-446655440004',
                versionNumber: 1,
                status: 'PENDING',
              },
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  );
}

export function ApiGetEngravingDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Get engraving detail by ID',
      description: 'Lấy chi tiết engraving kèm versions, biometrics, qrMemory, currentVersion.',
    }),
    ApiParam({
      name: 'versionId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440004',
    }),
    ApiResponse({
      status: 200,
      description: 'Engraving detail.',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Engraving not found' }),
  );
}

export function ApiResubmitEngravingVersionDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Resubmit engraving version for manager review',
      description:
        'Gửi duyệt version đang ở trạng thái REVISION_REQUIRED. ' +
        'Chuyển version → PENDING và order → PENDING_REVIEW để manager duyệt lại.',
    }),
    ApiParam({
      name: 'versionId',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440004',
    }),
    ApiResponse({
      status: 200,
      description:
        'Version resubmitted. orderId + orderStatus trả về nếu tìm thấy order.',
      schema: {
        example: {
          version: {
            id: '550e8400-e29b-41d4-a716-446655440004',
            engravingId: '550e8400-e29b-41d4-a716-446655440003',
            versionNumber: 2,
            selectedMaterialId: 'mat-gold-18k',
            selectedGemstoneId: 'gmt-diamond-05',
            ringSize: '7',
            ringStyle: 'CLASSIC',
            ringShape: 'ROUND',
            customizationConfig:
              '{"engravedType":"sw","selectedBiometrics":["SW"],"engravingPositions":{"sw":{"enabled":true,"status":"captured","position":{"startAngle":45,"width":180}}},"memoryCard":false}',
            status: 'PENDING',
            managerId: '',
            managerNote: '',
            reviewedAt: '',
            createdAt: '2026-06-24T10:00:00.000Z',
          },
          orderId: '550e8400-e29b-41d4-a716-446655440001',
          orderStatus: 'PENDING_REVIEW',
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Version không phải REVISION_REQUIRED',
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 404, description: 'Version not found' }),
  );
}
