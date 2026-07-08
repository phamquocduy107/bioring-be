import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestOrderDto {
  @ApiProperty({ description: 'Guest Customer ID', format: 'uuid' })
  @IsUUID('4')
  guestCustomerId!: string;

  @ApiPropertyOptional({
    description: 'Product ID (nếu chọn mẫu ngay)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  productId?: string;
}
