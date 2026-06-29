import { ApiProperty } from '@nestjs/swagger';

export class MaterialResponse {
  @ApiProperty({ example: 'a1111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'Vàng 18K' })
  name!: string;

  @ApiProperty({ example: '75%' })
  purity!: string;

  @ApiProperty({ example: 'Vàng' })
  color!: string;

  @ApiProperty({ example: 1600000 })
  currentPricePerGram!: number;
}
