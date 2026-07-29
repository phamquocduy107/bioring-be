import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SkipRemainingPaymentDto {
  @ApiProperty({
    description: 'Delivery method',
    example: 'DELIVERY',
    enum: ['DELIVERY', 'PICKUP'],
  })
  @IsIn(['DELIVERY', 'PICKUP'])
  deliveryMethod!: string;
}
