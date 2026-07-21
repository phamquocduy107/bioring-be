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
    description: 'Customer user ID to assign asset to',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    description: 'Engraving to link checklist row',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  engravingId?: string;

  @ApiPropertyOptional({
    description: 'Order item ID (optional traceability)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @ApiPropertyOptional({
    description: 'Ring model code for 3D viewer context',
    example: 'RING-CLASSIC-01',
  })
  @IsOptional()
  @IsString()
  modelCode?: string;

  @ApiPropertyOptional({
    description: 'Ring surface (outer | inner)',
    example: 'outer',
  })
  @IsOptional()
  @IsString()
  surface?: string;
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
