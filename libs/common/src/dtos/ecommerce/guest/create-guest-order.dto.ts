import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestOrderDto {
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

  @ApiPropertyOptional({
    description:
      'Danh sách biometrics đã chọn. Lưu thẳng vào version khi tạo order, bỏ qua bước PATCH config riêng cho walk-in flow.',
    example: ['SW', 'FP'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedBiometrics?: string[];
}
