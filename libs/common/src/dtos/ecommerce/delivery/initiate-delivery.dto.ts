import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateDeliveryDto {
  @ApiProperty({ description: 'Delivery method', example: 'PICKUP', enum: ['PICKUP', 'DELIVERY'] })
  @IsIn(['PICKUP', 'DELIVERY'])
  deliveryMethod!: string;

  @ApiProperty({ description: 'Recipient name', example: 'Nguyen Van A' })
  @IsString()
  recipientName!: string;

  @ApiProperty({ description: 'Recipient phone', example: '0909123456' })
  @IsString()
  recipientPhone!: string;

  @ApiPropertyOptional({ description: 'Address ID (for DELIVERY)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  addressId?: string;

  @ApiPropertyOptional({ description: 'Shipping address text (for DELIVERY)', example: '123 đường ABC' })
  @IsOptional()
  @IsString()
  shippingAddressText?: string;

  @ApiPropertyOptional({ description: 'Assigned delivery staff ID (for DELIVERY)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assignedDeliveryStaffId?: string;
}
