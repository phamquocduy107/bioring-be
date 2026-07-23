import { IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeliveryPreferenceDto {
  @ApiProperty({ description: 'Address ID', format: 'uuid' })
  @IsUUID('4')
  addressId!: string;

  @ApiProperty({
    description: 'Delivery method',
    example: 'DELIVERY',
    enum: ['DELIVERY', 'PICKUP'],
  })
  @IsIn(['DELIVERY', 'PICKUP'])
  method!: string;
}
