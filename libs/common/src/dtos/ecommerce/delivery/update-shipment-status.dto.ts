import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShipmentStatusDto {
  @ApiProperty({
    description: 'New status',
    example: 'DELIVERED',
    enum: ['SHIPPING', 'DELIVERED'],
  })
  @IsIn(['SHIPPING', 'DELIVERED'])
  status!: string;

  @ApiPropertyOptional({
    description: 'Receiver name (for DELIVERED)',
    example: 'Nguyen Van A',
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({
    description: 'Receiver phone (for DELIVERED)',
    example: '0909123456',
  })
  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @ApiPropertyOptional({
    description: 'Identity note (for PICKUP DELIVERED)',
    example: 'CMND 123456789',
  })
  @IsOptional()
  @IsString()
  identityNote?: string;

  @ApiPropertyOptional({
    description: 'Proof image URL (for PICKUP DELIVERED)',
  })
  @IsOptional()
  @IsString()
  proofImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Tracking code (for DELIVERY DELIVERED)',
    example: 'BIORING-DEL-001',
  })
  @IsOptional()
  @IsString()
  trackingCode?: string;
}
