import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

const DOCUMENT_TYPE_VALUES = [
  'policy',
  'package',
  'ring_guide',
  'gemstone_guide',
  'custom_design',
  'general',
] as const;

const RETRIEVAL_TYPE_VALUES = [
  'policy',
  'package',
  'ring_guide',
  'gemstone_guide',
  'custom_design',
  'general',
] as const;

/**
 * Body multipart/form-data cho upload knowledge document.
 * documentType/retrievalTypes optional để backward compatible với client cũ.
 * Backend tự map retrievalTypes từ documentType nếu client không gửi.
 */
export class UploadDocumentDto {
  @ApiPropertyOptional({
    description:
      'Loại tài liệu, dùng để filter Qdrant search theo chat intent.\n' +
      '- policy: Chính sách bảo hành, đổi trả, thanh toán, giao hàng\n' +
      '- package: Gói dịch vụ, quyền lợi gói, giá gói\n' +
      '- ring_guide: Hướng dẫn chọn nhẫn, phong cách, chất liệu\n' +
      '- gemstone_guide: Hướng dẫn chọn đá, màu đá, ý nghĩa đá\n' +
      '- custom_design: Thiết kế riêng, biometric, vân tay, giọng nói\n' +
      '- general: Tài liệu chung',
    enum: DOCUMENT_TYPE_VALUES,
    default: 'general',
  })
  @IsOptional()
  @IsString()
  @IsIn([...DOCUMENT_TYPE_VALUES], {
    message: `documentType must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}`,
  })
  documentType?: string;

  @ApiPropertyOptional({
    description:
      'Optional: chọn NHIỀU retrieval type (array). Một tài liệu có thể phục vụ nhiều intent. ' +
      'Nếu bỏ trống, backend tự map từ documentType. ' +
      'Swagger multipart: Add item nhiều lần, hoặc nhập CSV `custom_design,package,policy`.',
    isArray: true,
    enum: RETRIEVAL_TYPE_VALUES,
    uniqueItems: true,
    example: ['custom_design', 'package', 'policy', 'ring_guide'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    normalizeRetrievalTypesInput(value),
  )
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn([...RETRIEVAL_TYPE_VALUES], {
    each: true,
    message: `retrievalTypes items must be one of: ${RETRIEVAL_TYPE_VALUES.join(', ')}`,
  })
  retrievalTypes?: string[];
}

/** multipart gửi array dưới nhiều dạng: JSON string, CSV, hoặc field lặp lại. */
function normalizeRetrievalTypesInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fall through to CSV parsing
      }
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}
