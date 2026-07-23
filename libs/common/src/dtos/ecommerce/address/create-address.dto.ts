import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ description: 'Recipient name', example: 'Nguyen Van A' })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ description: 'Phone number', example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    description: 'Full address',
    example: '123 Nguyen Hue, Bến Nghé',
  })
  @IsString()
  @IsNotEmpty()
  fullAddress!: string;

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
