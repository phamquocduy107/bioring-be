import { ApiProperty } from '@nestjs/swagger';

export class GemstoneResponse {
  @ApiProperty({ example: 'b1111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'Kim cương' })
  type!: string;

  @ApiProperty({ example: 0.5 })
  carat!: number;

  @ApiProperty({ example: 'Round Brilliant' })
  cut!: string;

  @ApiProperty({ example: 'D' })
  color!: string;

  @ApiProperty({ example: 'VS1' })
  clarity!: string;

  @ApiProperty({ example: 'GIA-123456' })
  certificationCode!: string;

  @ApiProperty({ example: 15000000 })
  price!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}
