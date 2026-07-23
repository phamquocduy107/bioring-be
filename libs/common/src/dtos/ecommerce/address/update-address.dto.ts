import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAddressDto {
  @ApiPropertyOptional({
    description: 'Recipient name',
    example: 'Nguyen Van A',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Full address',
    example: '123 Nguyen Hue, Bến Nghé',
  })
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiPropertyOptional({ description: 'Ward', example: 'Bến Nghé' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ description: 'District', example: 'Quận 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'TP Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({
    description: 'Set as default address',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
