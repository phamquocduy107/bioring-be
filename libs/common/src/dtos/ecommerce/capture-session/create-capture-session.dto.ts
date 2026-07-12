import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCaptureSessionDto {
  @ApiProperty({ description: 'Order ID', format: 'uuid' })
  @IsUUID('4')
  orderId!: string;

  @ApiPropertyOptional({ description: 'IoT Device ID', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  deviceId?: string;
}
