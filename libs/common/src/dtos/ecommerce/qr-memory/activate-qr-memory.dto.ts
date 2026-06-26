import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateQrMemoryDto {
  @ApiProperty({
    description: 'QR code from physical card',
    example: 'a1b2c3d4e5f6',
  })
  @IsString()
  qrCode!: string;

  @ApiProperty({ description: 'Access PIN', example: '123456' })
  @IsString()
  @MinLength(4)
  accessPin!: string;
}
