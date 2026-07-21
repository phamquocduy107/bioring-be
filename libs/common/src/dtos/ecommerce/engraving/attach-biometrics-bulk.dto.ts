import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * @deprecated Prefer sequential multipart POST /engravings/:id/biometrics.
 * Bulk over HTTP cannot carry multiple binary files cleanly.
 */
class BulkBiometricItemDto {
  @ApiProperty({
    description: 'Biometric type',
    enum: ['SW', 'FP', 'HB'],
    example: 'FP',
  })
  @IsIn(['SW', 'FP', 'HB'])
  biometricType!: string;

  @ApiPropertyOptional({ description: 'Optional JSON string with extra data' })
  @IsOptional()
  @IsString()
  extraData?: string;
}

/** @deprecated Use single multipart attach per biometric. */
export class AttachBiometricsBulkDto {
  @ApiProperty({
    description: 'List of biometrics to upload',
    type: [BulkBiometricItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkBiometricItemDto)
  biometrics!: BulkBiometricItemDto[];
}
