import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEngravingDto {
  @ApiPropertyOptional({
    description: 'Product ID (optional — để trống nếu tạo engraving rỗng)',
    example: 'c0a80121-0000-4000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID('4')
  productId?: string;
}
