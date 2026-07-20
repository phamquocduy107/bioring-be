import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class BulkBiometricItemDto {
  @ApiProperty({ description: 'Biometric type', enum: ['SW', 'FP', 'HB'], example: 'FP' })
  @IsIn(['SW', 'FP', 'HB'])
  biometricType!: string;

  @ApiProperty({ description: 'Cloudinary URL of the raw biometric file', example: 'https://res.cloudinary.com/.../fingerprint.png' })
  @IsString()
  rawFileUrl!: string;

  @ApiPropertyOptional({ description: 'Optional JSON string with extra data' })
  @IsOptional()
  @IsString()
  extraData?: string;
}

export class AttachBiometricsBulkDto {
  @ApiProperty({ description: 'List of biometrics to upload', type: [BulkBiometricItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkBiometricItemDto)
  biometrics!: BulkBiometricItemDto[];
}
