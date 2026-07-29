import { ApiProperty } from '@nestjs/swagger';

export class ClaimDeliveryDto {
  @ApiProperty({ example: 'PICKUP' })
  deliveryMethod?: string;
}
