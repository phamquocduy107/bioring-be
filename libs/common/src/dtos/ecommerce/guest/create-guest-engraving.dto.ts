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
}
