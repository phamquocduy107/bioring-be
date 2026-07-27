import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestEngravingDto {
  @ApiProperty({ description: 'Guest code (GUE-XXXXXX)' })
  @IsString()
  @MaxLength(50)
  guestCode!: string;

  @ApiPropertyOptional({
    description: 'Product ID (nếu chọn mẫu ngay)',
    format: 'uuid',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Material ID' })
  @IsOptional()
  @IsString()
  selectedMaterialId?: string;

  @ApiPropertyOptional({ description: 'Gemstone ID' })
  @IsOptional()
  @IsString()
  selectedGemstoneId?: string;

  @ApiPropertyOptional({ description: 'Ring size', example: '7' })
  @IsOptional()
  @IsString()
  ringSize?: string;

  @ApiPropertyOptional({
    description: 'Selected biometrics (comma-separated, e.g. SW,FP)',
    example: 'SW,FP',
  })
  @IsOptional()
  @IsString()
  selectedBiometrics?: string;
}
