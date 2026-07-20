import { ApiProperty } from '@nestjs/swagger';

export class TransactionOverviewDto {
  @ApiProperty({ example: 125000000 })
  grossRevenue!: number;

  @ApiProperty({ example: 120000000 })
  netRevenue!: number;

  @ApiProperty({ example: 5000000 })
  pendingCod!: number;

  @ApiProperty({ example: 2000000 })
  refunded!: number;

  @ApiProperty({ example: 12.5 })
  grossChange!: number;

  @ApiProperty({ example: 10.2 })
  netChange!: number;

  @ApiProperty({ example: -5.0 })
  pendingChange!: number;

  @ApiProperty({ example: 0.0 })
  refundedChange!: number;
}
