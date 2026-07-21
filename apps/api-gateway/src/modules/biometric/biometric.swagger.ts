import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiAuthFailures } from '@app/common';
import {
  ApproveBiometricAssetDto,
  AssignBiometricAssetDto,
  ConfirmBiometricPlacementDto,
  ReprocessBiometricOptionsDto,
} from './biometric-gateway.dto';

const ASSET_STATUS = [
  'PENDING',
  'READY_FOR_REVIEW',
  'ASSET_APPROVED',
  'PLACEMENT_CONFIRMED',
  'ASSIGNED',
] as const;

const BIOMETRIC_TYPE = ['FP', 'SW', 'HB'] as const;

const viewerFilesExample = {
  overlayPng:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/overlay.png',
  alphaMap:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/alpha.png',
  heightmap:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/height.png',
  normalMap:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/normal.png',
  roughnessMap:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/roughness.png',
  aoMap:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/ao.png',
};

const fingerprintAssetExample = {
  assetId: '550e8400-e29b-41d4-a716-446655440001',
  artifactId: 'fp_a1b2c3d4e5f6',
  assetType: 'FP',
  status: 'READY_FOR_REVIEW',
  manifestUrl:
    'https://minio.example/personalization/review/fingerprint/fp_a1b2/manifest.json',
  reviewFiles: {
    viewerFiles: viewerFilesExample,
    productionFiles: {
      svg: 'https://minio.example/personalization/review/fingerprint/fp_a1b2/production.svg',
    },
    sourceFiles: {
      raw: 'https://minio.example/personalization/review/fingerprint/fp_a1b2/input.png',
    },
  },
  approvedFiles: null,
  assignedUserId: null,
  engravingId: null,
  createdAt: '2026-07-21T08:00:00.000Z',
  updatedAt: '2026-07-21T08:00:00.000Z',
};

const soundwaveAssetExample = {
  ...fingerprintAssetExample,
  assetId: '550e8400-e29b-41d4-a716-446655440002',
  artifactId: 'sw_f1e2d3c4b5a6',
  assetType: 'SW',
  status: 'READY_FOR_REVIEW',
  manifestUrl:
    'https://minio.example/personalization/review/soundwave/sw_f1e2/manifest.json',
  reviewFiles: {
    viewerFiles: {
      overlayPng: 'https://minio.example/.../waveform-overlay.png',
    },
    productionFiles: {
      svg: 'https://minio.example/.../waveform.svg',
    },
    sourceFiles: {
      raw: 'https://minio.example/.../audio.mp3',
    },
  },
};

const heartbeatAssetExample = {
  assetId: '550e8400-e29b-41d4-a716-446655440003',
  artifactId: 'hb_c3d4e5f6a7b8',
  assetType: 'HB',
  status: 'ASSET_APPROVED',
  reviewFiles: null,
  approvedFiles: {
    productionFiles: {},
    sourceFiles: {
      raw: 'https://minio.example/personalization/approved/heartbeat/hb_c3d4/raw.png',
    },
  },
  assignedUserId: null,
  engravingId: null,
};

const approvedViewerAssetExample = {
  assetId: fingerprintAssetExample.assetId,
  artifactId: fingerprintAssetExample.artifactId,
  assetType: 'FP',
  status: 'ASSET_APPROVED',
  viewerFiles: viewerFilesExample,
  placement: { rotation: 0, scale: 1, offsetU: 0, offsetV: 0 },
};

const biometricChecklistExample = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  engravingId: '550e8400-e29b-41d4-a716-446655440003',
  biometricType: 'SW',
  requiredChannel: 'ENGRAVING',
  biometricAssetId: '550e8400-e29b-41d4-a716-446655440011',
  rawFileUrl:
    'https://minio.example/personalization/approved/soundwave/sw_f1e2/audio.mp3',
  processedSvgUrl:
    'https://minio.example/personalization/approved/soundwave/sw_f1e2/waveform.svg',
  status: 'CAPTURED',
  artifactId: 'sw_f1e2d3c4b5a6',
  extraData: { startMs: 0, endMs: 3000 },
};

const grpcUnavailableExample = {
  statusCode: 400,
  message: 'BIOMETRIC_SERVICE is not available',
  error: 'Bad Request',
};

const pythonEngineErrorExample = {
  statusCode: 502,
  message: 'Personalization engine request failed',
  error: 'Bad Gateway',
};

function assetIdParam() {
  return ApiParam({
    name: 'assetId',
    type: String,
    format: 'uuid',
    description: 'biometric_assets.id (UUID)',
    example: fingerprintAssetExample.assetId,
  });
}

function engravingIdParam() {
  return ApiParam({
    name: 'engravingId',
    type: String,
    format: 'uuid',
    description: 'Engraving ID owned by customer or linked order',
    example: biometricChecklistExample.engravingId,
  });
}

const fingerprintPresetExample = {
  code: 'standard',
  title: 'Chuẩn mặc định',
  whenToUse: 'Dùng cho đa số ảnh vân tay rõ, ít nhiễu.',
  options: {
    minArea: 15,
    adaptiveC: 4,
    erodeSize: 10,
    applyMorphology: false,
    turdsize: 3,
    opttolerance: 0.06,
  },
  explanation: {
    minArea: 'Lọc nhiễu nhỏ vừa phải, vẫn giữ được nét mảnh.',
    adaptiveC: 'Giữ độ dày vân ở mức cân bằng.',
  },
};

const fingerprintPresetsResponseExample = {
  presets: [
    fingerprintPresetExample,
    {
      code: 'keep_ridges',
      title: 'Giữ nhiều nét vân hơn',
      whenToUse: 'Dùng khi PNG/SVG bị mất nhiều nét hoặc đường vân bị đứt.',
      options: {
        minArea: 5,
        adaptiveC: 3,
        erodeSize: 6,
        applyMorphology: false,
        turdsize: 1,
        opttolerance: 0.03,
      },
      explanation: {},
    },
  ],
  parameterGuide: {
    minArea:
      'Lọc connected-component nhỏ. Tăng lên sẽ xóa nhiễu tốt hơn nhưng dễ mất đoạn vân mảnh.',
    adaptiveC:
      'Điều chỉnh adaptive threshold. Giảm xuống giúp vân dày/liền hơn.',
  },
};

const soundwavePresetExample = {
  code: 'ridge',
  title: 'Ridge waveform',
  whenToUse: 'Waveform dạng ridge nổi bật trên nhẫn.',
  options: {
    style: 'ridge',
    amplitudeScale: 1.0,
    lineWidth: 2,
  },
  explanation: {
    amplitudeScale: 'Biên độ sóng — tăng để waveform cao hơn.',
  },
};

const soundwavePresetsResponseExample = {
  presets: [
    soundwavePresetExample,
    {
      code: 'standard',
      title: 'Chuẩn (dùng khi process)',
      whenToUse: 'POST /soundwave/process luôn dùng preset standard.',
      options: { style: 'smooth', amplitudeScale: 0.85 },
      explanation: {},
    },
  ],
  parameterGuide: {
    amplitudeScale: 'Hệ số biên độ waveform sau khi normalize.',
    style: 'Kiểu vẽ: smooth, bars, ridge, dots, …',
  },
};

export function ApiAdminGetFingerprintPresetsDocs(): MethodDecorator &
  ClassDecorator {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — danh sách preset reprocess fingerprint',
      description:
        'Proxy Python `GET /fingerprint/presets`.\n\n' +
        'Dùng trước khi gọi `POST …/:assetId/reprocess` — chọn `preset` code rồi override từng field trong `options`.\n\n' +
        '`POST /fingerprint/process` luôn dùng preset `standard` mặc định.',
    }),
    ApiResponse({
      status: 200,
      description: 'Preset catalog + parameterGuide',
      schema: { example: fingerprintPresetsResponseExample },
    }),
    ApiResponse({
      status: 502,
      description: 'Python engine lỗi hoặc không chạy',
    }),
    ApiAuthFailures(),
  );
}

export function ApiAdminGetSoundwavePresetsDocs(): MethodDecorator &
  ClassDecorator {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — danh sách preset reprocess soundwave',
      description:
        'Proxy Python `GET /soundwave/presets`.\n\n' +
        'Dùng trước khi gọi `POST …/:assetId/reprocess` — chọn `preset` (bars, ridge, smooth_wave, …) và override options.\n\n' +
        'Segment audio (`segmentStartMs` / `segmentDurationMs`) chọn ở bước process, không nằm trong preset.',
    }),
    ApiResponse({
      status: 200,
      description: 'Preset catalog + parameterGuide',
      schema: { example: soundwavePresetsResponseExample },
    }),
    ApiResponse({
      status: 502,
      description: 'Python engine lỗi hoặc không chạy',
    }),
    ApiAuthFailures(),
  );
}

export function ApiAdminProcessFingerprintDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — upload ảnh vân tay → Python REVIEW pipeline',
      description:
        '**Workflow A — Step 1 (FP)**\n\n' +
        '1. Multipart upload PNG/JPG\n' +
        '2. Gateway → gRPC `ProcessFingerprint` → Python `POST /fingerprint/process`\n' +
        '3. Lưu artifact lên MinIO `personalization/review/fingerprint/{artifactId}/`\n' +
        '4. Tạo `biometric_assets` với `status=READY_FOR_REVIEW`\n\n' +
        '**Auth:** JWT staff + permission `OrderWrite`.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Ảnh vân tay PNG hoặc JPEG (max 50 MiB)',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Asset fingerprint ở trạng thái READY_FOR_REVIEW',
      schema: { example: { asset: fingerprintAssetExample } },
    }),
    ApiResponse({
      status: 400,
      description:
        'Thiếu file hoặc MIME type không hợp lệ (chỉ image/png, image/jpeg)',
      schema: {
        example: {
          statusCode: 400,
          message: 'file is required',
          error: 'Bad Request',
        },
      },
    }),
    ApiResponse({
      status: 502,
      description: 'Python personalization_engine lỗi',
      schema: { example: pythonEngineErrorExample },
    }),
    ApiAuthFailures(),
  );
}

export function ApiAdminProcessSoundwaveDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — upload audio → Python soundwave REVIEW pipeline',
      description:
        '**Workflow A — Step 1 (SW)**\n\n' +
        'Multipart file + optional `segmentStartMs` / `segmentDurationMs` (≤ 3000ms).\n' +
        'Python `POST /soundwave/process` → MinIO REVIEW → `biometric_assets` READY_FOR_REVIEW.\n\n' +
        '**Auth:** JWT staff + `OrderWrite`.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Audio wav/mp3/m4a (max 50 MiB)',
          },
          segmentStartMs: {
            type: 'integer',
            example: 0,
            description: 'Vị trí bắt đầu cắt audio (ms)',
          },
          segmentDurationMs: {
            type: 'integer',
            example: 3000,
            description: 'Độ dài đoạn audio cần khắc (ms, max 3000)',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Soundwave asset READY_FOR_REVIEW',
      schema: { example: { asset: soundwaveAssetExample } },
    }),
    ApiResponse({
      status: 400,
      description: 'Thiếu file hoặc không phải audio',
    }),
    ApiResponse({
      status: 502,
      description: 'Python engine lỗi',
      schema: { example: pythonEngineErrorExample },
    }),
    ApiAuthFailures(),
  );
}

export function ApiAdminStoreHeartbeatDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — lưu heartbeat raw → Python APPROVED trực tiếp',
      description:
        '**Workflow A (HB)** — không qua OpenCV pipeline.\n\n' +
        'Python `POST /heartbeat/store` → MinIO APPROVED ngay.\n' +
        '`biometric_assets.status = ASSET_APPROVED` (bỏ qua READY_FOR_REVIEW / approve).\n\n' +
        'Chỉ cần `assign` sau khi staff duyệt nội dung.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'File heartbeat raw (ảnh hoặc binary)',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Heartbeat asset ASSET_APPROVED',
      schema: { example: { asset: heartbeatAssetExample } },
    }),
    ApiResponse({ status: 400, description: 'Thiếu file' }),
    ApiResponse({ status: 502, description: 'Python engine lỗi' }),
    ApiAuthFailures(),
  );
}

export function ApiAdminGetBiometricAssetDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — lấy metadata biometric asset theo ID',
      description:
        'Trả về `biometric_assets` row + URLs review/approved từ MinIO. ' +
        'Hỗ trợ FP, SW, HB.',
    }),
    assetIdParam(),
    ApiResponse({
      status: 200,
      description: 'Asset metadata',
      schema: { example: { asset: fingerprintAssetExample } },
    }),
    ApiResponse({ status: 404, description: 'Asset không tồn tại' }),
    ApiResponse({
      status: 400,
      description: 'gRPC unavailable',
      schema: { example: grpcUnavailableExample },
    }),
    ApiAuthFailures(),
  );
}

export function ApiAdminReprocessBiometricAssetDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — reprocess asset (FP hoặc SW)',
      description:
        'Dispatch theo `asset_type`:\n' +
        '- FP → Python `POST /fingerprint/{artifactId}/reprocess`\n' +
        '- SW → Python `POST /soundwave/{artifactId}/reprocess`\n' +
        '- HB → **400** (heartbeat không hỗ trợ reprocess)\n\n' +
        'Overwrite file REVIEW trên MinIO, giữ nguyên `artifactId`.',
    }),
    assetIdParam(),
    ApiBody({ type: ReprocessBiometricOptionsDto }),
    ApiResponse({
      status: 200,
      description: 'Asset đã reprocess — REVIEW files mới',
      schema: { example: { asset: fingerprintAssetExample } },
    }),
    ApiResponse({
      status: 400,
      description: 'Heartbeat không thể reprocess hoặc options không hợp lệ',
    }),
    ApiResponse({ status: 404, description: 'Asset không tồn tại' }),
    ApiResponse({ status: 502, description: 'Python engine lỗi' }),
    ApiAuthFailures(),
  );
}

export function ApiAdminRegenerateBiometricTexturesDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — regenerate texture maps 3D (FP hoặc SW)',
      description:
        'Python reprocess-texture endpoint. Chỉ overwrite `viewerFiles` trong REVIEW ' +
        '(heightmap, normalMap, roughnessMap, aoMap, overlay, alpha). ' +
        'Không thay đổi production SVG.',
    }),
    assetIdParam(),
    ApiBody({
      type: ReprocessBiometricOptionsDto,
      required: false,
    }),
    ApiResponse({
      status: 200,
      description: 'Texture maps REVIEW đã cập nhật',
      schema: { example: { asset: fingerprintAssetExample } },
    }),
    ApiResponse({
      status: 400,
      description: 'Asset type không hỗ trợ textures (HB)',
    }),
    ApiResponse({ status: 404, description: 'Asset không tồn tại' }),
    ApiResponse({ status: 502, description: 'Python engine lỗi' }),
    ApiAuthFailures(),
  );
}

export function ApiAdminApproveBiometricAssetDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — publish REVIEW → APPROVED (FP hoặc SW)',
      description:
        '**Workflow A — Step approve**\n\n' +
        '1. Python `publish-approved` — copy REVIEW → APPROVED trên MinIO\n' +
        '2. Python `cleanup-review` (best-effort)\n' +
        '3. `biometric_assets.status = ASSET_APPROVED`\n\n' +
        'Heartbeat đã APPROVED từ bước store — endpoint này chỉ áp dụng FP/SW.',
    }),
    assetIdParam(),
    ApiBody({ type: ApproveBiometricAssetDto }),
    ApiResponse({
      status: 200,
      description: 'Asset ASSET_APPROVED',
      schema: {
        example: {
          asset: {
            ...fingerprintAssetExample,
            status: 'ASSET_APPROVED',
            approvedFiles: fingerprintAssetExample.reviewFiles,
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Asset chưa READY_FOR_REVIEW hoặc type HB',
    }),
    ApiResponse({ status: 404, description: 'Asset không tồn tại' }),
    ApiResponse({ status: 502, description: 'Python publish/cleanup lỗi' }),
    ApiAuthFailures(),
  );
}

export function ApiAdminAssignBiometricAssetDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Staff — gán asset đã approve cho customer + engraving',
      description:
        '**Workflow A — Step assign**\n\n' +
        '1. Cập nhật `biometric_assets.assigned_user_id`, `engraving_id`\n' +
        '2. Upsert `engraving_biometrics` checklist row\n\n' +
        'Áp dụng cho FP, SW (sau approve) và HB (sau store).',
    }),
    assetIdParam(),
    ApiBody({ type: AssignBiometricAssetDto }),
    ApiResponse({
      status: 200,
      description: 'Asset đã assign',
      schema: {
        example: {
          asset: {
            ...fingerprintAssetExample,
            status: 'ASSIGNED',
            assignedUserId: '550e8400-e29b-41d4-a716-446655440002',
            engravingId: biometricChecklistExample.engravingId,
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Asset chưa APPROVED hoặc userId thiếu',
    }),
    ApiResponse({
      status: 404,
      description: 'Asset / engraving / user không tồn tại',
    }),
    ApiAuthFailures(),
  );
}

export function ApiMeGetBiometricViewerAssetsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Customer — lấy approved viewer assets (FP hoặc SW)',
      description:
        'Trả overlay + texture maps + placement để render 3D ring viewer.\n\n' +
        '**Ownership:** `assigned_user_id = JWT sub` hoặc owner của engraving liên kết.\n\n' +
        'Nguồn: Python `approved-viewer-assets` hoặc cache DB.',
    }),
    assetIdParam(),
    ApiResponse({
      status: 200,
      description: 'Approved viewer payload',
      schema: { example: { asset: approvedViewerAssetExample } },
    }),
    ApiResponse({
      status: 403,
      description: 'Asset không thuộc user hiện tại',
    }),
    ApiResponse({
      status: 404,
      description: 'Asset không tồn tại hoặc chưa APPROVED',
    }),
    ApiAuthFailures(),
  );
}

export function ApiMeConfirmBiometricPlacementDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Customer — xác nhận vị trí FP/SW trên model 3D',
      description:
        'Lưu placement transform (rotation, scale, offsetU/V) sau khi customer chỉnh trên ring viewer.\n' +
        'Cập nhật `status = PLACEMENT_CONFIRMED`.',
    }),
    assetIdParam(),
    ApiBody({ type: ConfirmBiometricPlacementDto }),
    ApiResponse({
      status: 200,
      description: 'Placement confirmed',
      schema: {
        example: {
          asset: {
            ...approvedViewerAssetExample,
            status: 'PLACEMENT_CONFIRMED',
            placement: { rotation: 45, scale: 1, offsetU: 0.1, offsetV: -0.05 },
          },
        },
      },
    }),
    ApiResponse({ status: 403, description: 'Không phải owner' }),
    ApiResponse({ status: 404, description: 'Asset không tồn tại' }),
    ApiAuthFailures(),
  );
}

export function ApiMeListEngravingBiometricsDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Customer — danh sách biometric checklist của engraving',
      description:
        'Trả `engraving_biometrics` rows kèm URL resolve từ `biometric_assets`.\n\n' +
        'Dùng trên mobile/web để hiển thị trạng thái SW/FP/HB trên order.',
    }),
    engravingIdParam(),
    ApiResponse({
      status: 200,
      description: 'Checklist biometrics',
      schema: {
        example: {
          biometrics: [
            biometricChecklistExample,
            {
              ...biometricChecklistExample,
              id: '550e8400-e29b-41d4-a716-446655440012',
              biometricType: 'FP',
              status: 'PENDING',
              biometricAssetId: null,
              rawFileUrl: '',
              processedSvgUrl: '',
              artifactId: '',
              extraData: {},
            },
          ],
        },
      },
    }),
    ApiResponse({ status: 403, description: 'Engraving không thuộc user' }),
    ApiResponse({ status: 404, description: 'Engraving không tồn tại' }),
    ApiAuthFailures(),
  );
}

export function ApiMeAttachEngravingBiometricDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Customer — gắn biometric vào engraving (Workflow B)',
      description:
        '**Workflow B — online customer upload**\n\n' +
        '1. Multipart `file` + `biometricType` (thường SW)\n' +
        '2. Optional `extraData` JSON cho segment audio SW\n' +
        '3. Auto process + publish qua Python\n' +
        '4. Tạo `biometric_assets` + upsert `engraving_biometrics`\n\n' +
        '**Điều kiện:** engraving thuộc user, order `AWAITING_SUBMIT` hoặc `REVISION_REQUIRED`, ' +
        'package có biometric type tương ứng.',
    }),
    ApiConsumes('multipart/form-data'),
    engravingIdParam(),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file', 'biometricType'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'File biometric (audio cho SW, ảnh cho FP/HB)',
          },
          biometricType: {
            type: 'string',
            enum: [...BIOMETRIC_TYPE],
            example: 'SW',
          },
          extraData: {
            type: 'string',
            example: '{"startMs":0,"endMs":3000}',
            description: 'JSON string — segment selection cho SW',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Biometric đã attach và process',
      schema: { example: { biometric: biometricChecklistExample } },
    }),
    ApiResponse({
      status: 400,
      description:
        'Thiếu file, sai order status, hoặc package không có type này',
    }),
    ApiResponse({ status: 403, description: 'Engraving không thuộc user' }),
    ApiResponse({ status: 404, description: 'Engraving không tồn tại' }),
    ApiResponse({
      status: 502,
      description: 'Python engine lỗi khi process/publish',
    }),
    ApiAuthFailures(),
  );
}

/** Re-export schema enums for Swagger UI reference. */
export const BIOMETRIC_SWAGGER = {
  ASSET_STATUS,
  BIOMETRIC_TYPE,
  fingerprintAssetExample,
  soundwaveAssetExample,
  heartbeatAssetExample,
} as const;
