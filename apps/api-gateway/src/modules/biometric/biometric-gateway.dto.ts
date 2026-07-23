import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ApproveBiometricAssetDto {
  @ApiPropertyOptional({
    description: 'Staff note when approving asset quality',
    example: 'Quality OK — ridges clear, no blur',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description:
      'Copy debug/work files to APPROVED stage (fingerprint pipeline only)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  copyDebugFiles?: boolean;
}

export class AssignBiometricAssetDto {
  @ApiProperty({
    description: 'Engraving ID to link asset to',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  engravingId!: string;

  @ApiPropertyOptional({
    description:
      'Customer user ID (optional — automatically derived from engraving if omitted)',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class ConfirmBiometricPlacementDto {
  @ApiProperty({
    description: 'Ring model code used in 3D preview',
    example: 'RING-CLASSIC-01',
  })
  @IsString()
  modelCode!: string;

  @ApiProperty({
    description: 'Ring surface where biometric is placed',
    example: 'outer',
  })
  @IsString()
  surface!: string;

  @ApiProperty({
    description: 'Placement transform (rotation, scale, UV offsets)',
    example: { rotation: 45, scale: 1, offsetU: 0.1, offsetV: -0.05 },
  })
  @IsObject()
  placement!: Record<string, unknown>;
}

export class ReprocessBiometricOptionsDto {
  @ApiPropertyOptional({
    description: 'Processing preset (fingerprint/soundwave pipeline)',
    example: 'standard',
  })
  @IsOptional()
  @IsString()
  preset?: string;

  @ApiPropertyOptional({
    description: 'Binarization threshold for fingerprint (FP only)',
    example: 128,
  })
  @IsOptional()
  threshold?: number;
}
