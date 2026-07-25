import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGuestOrderDto {
  @ApiProperty({ description: 'Guest code (GUE-XXXXXX)' })
  @IsString()
  @MaxLength(50)
  guestCode!: string;

  @ApiProperty({
    description: 'Engraving ID đã tạo từ bước trước',
    format: 'uuid',
  })
  @IsString()
  engravingId!: string;
}
