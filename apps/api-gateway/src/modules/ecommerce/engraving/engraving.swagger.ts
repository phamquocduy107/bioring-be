import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

const engravingVersionExample = {
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
  selectedMaterial: null,
  selectedGemstone: null,
};

const engravingResponseExample = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  orderId: '',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  productId: '',
  uniqueProductId: '',
  approvedVersionId: '',
  status: 'PENDING',
  versions: [],
  biometrics: [],
  qrMemory: null,
  currentVersion: null,
};

const customConfigExample =
  '{"engravedType":"sw","selectedBiometrics":["SW"],"engravingPositions":{"sw":{"enabled":true,"status":"pending","position":{"startAngle":90,"width":180,"height":3}}},"memoryCard":{"recipientEmail":"","cardTitle":"","greetingMessage":""},"ringPreviewUrl":"https://res.cloudinary.com/.../preview.png"}';

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
          engraving: { ...engravingResponseExample },
          engravingVersion: { ...engravingVersionExample },
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
        'Saves/updates customizationConfig for an engraving version. ' +
        'Gửi kèm audioUrl để trigger xử lý waveform (Python service). ' +
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
            ...engravingVersionExample,
            versionNumber: 1,
            selectedMaterialId: 'a1111111-1111-4111-8111-111111111111',
            selectedGemstoneId: 'b1111111-1111-4111-8111-111111111111',
            ringSize: '7',
            ringStyle: 'CLASSIC',
            ringShape: 'ROUND',
            customizationConfig: customConfigExample,
            selectedMaterial: {
              id: 'a1111111-1111-4111-8111-111111111111',
              name: 'Vàng 18K',
              purity: '75%',
              color: 'Vàng',
              currentPricePerGram: 1600000,
            },
            selectedGemstone: {
              id: 'b1111111-1111-4111-8111-111111111111',
              type: 'Kim cương',
              carat: 0.5,
              cut: 'Round Brilliant',
              color: 'D',
              clarity: 'VS1',
              certificationCode: 'GIA-123456',
              price: 15000000,
              isAvailable: true,
            },
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
              ...engravingResponseExample,
              orderId: '550e8400-e29b-41d4-a716-446655440001',
              currentVersion: { ...engravingVersionExample },
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
      description:
        'Lấy chi tiết engraving kèm versions, biometrics, qrMemory, currentVersion. ' +
        'Mỗi version trả về thêm selectedMaterial và selectedGemstone là object detail.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440003',
    }),
    ApiResponse({
      status: 200,
      description: 'Engraving detail with material and gemstone info.',
      schema: {
        example: {
          engraving: {
            ...engravingResponseExample,
            currentVersion: { ...engravingVersionExample },
          },
        },
      },
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
            ...engravingVersionExample,
            versionNumber: 2,
            selectedMaterialId: 'a1111111-1111-4111-8111-111111111111',
            selectedGemstoneId: 'b1111111-1111-4111-8111-111111111111',
            ringSize: '7',
            ringStyle: 'CLASSIC',
            ringShape: 'ROUND',
            customizationConfig: customConfigExample,
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
