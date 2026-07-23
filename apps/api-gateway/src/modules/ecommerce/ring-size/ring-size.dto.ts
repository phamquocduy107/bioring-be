import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRingSizeDto {
  @ApiPropertyOptional({
    description: 'Human readable label (e.g. Ngón áp út tay trái)',
    example: 'Ngón áp út tay trái',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Hand side (LEFT | RIGHT)',
    example: 'LEFT',
  })
  @IsOptional()
  @IsString()
  handSide?: string;

  @ApiPropertyOptional({
    description: 'Finger type (THUMB | INDEX | MIDDLE | RING | PINKY)',
    example: 'RING',
  })
  @IsOptional()
  @IsString()
  fingerType?: string;

  @ApiPropertyOptional({
    description: 'Ring size system (VN | US | EU | JP)',
    example: 'VN',
  })
  @IsOptional()
  @IsString()
  sizeSystem?: string;

  @ApiPropertyOptional({
    description: 'Ring size value (e.g. 7 or 14)',
    example: '7',
  })
  @IsOptional()
  @IsString()
  ringSize?: string;

  @ApiPropertyOptional({
    description: 'Inner diameter in mm',
    example: 17.3,
  })
  @IsOptional()
  @IsNumber()
  diameterMm?: number;

  @ApiPropertyOptional({
    description: 'Finger circumference in mm',
    example: 54.4,
  })
  @IsOptional()
  @IsNumber()
  circumferenceMm?: number;

  @ApiPropertyOptional({
    description:
      'Measurement method (PAPER_STRIP | RING_RULER | EXISTING_RING | CAMERA_AI)',
    example: 'PAPER_STRIP',
  })
  @IsOptional()
  @IsString()
  measurementMethod?: string;

  @ApiPropertyOptional({
    description: 'Measurement source (SELF | STORE_STAFF)',
    example: 'SELF',
  })
  @IsOptional()
  @IsString()
  measurementSource?: string;

  @ApiPropertyOptional({
    description: 'Step-by-step measurement guide result or raw steps data',
  })
  @IsOptional()
  @IsObject()
  guideStepResult?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Reference photo URL',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'AI measurement confidence score (0 - 100)',
    example: 95.5,
  })
  @IsOptional()
  @IsNumber()
  confidenceScore?: number;

  @ApiPropertyOptional({
    description: 'Set as default size profile',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateRingSizeDto extends CreateRingSizeDto {}
