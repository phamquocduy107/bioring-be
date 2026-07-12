import { ApiProperty } from '@nestjs/swagger';

export class StatusCountDto {
  @ApiProperty({ example: 'COMPLETED', description: 'Order status' })
  status!: string;

  @ApiProperty({ example: 89, description: 'Count' })
  count!: number;
}

export class OrdersByStatusDto {
  @ApiProperty({
    type: [StatusCountDto],
    description: 'Orders grouped by status',
  })
  data!: StatusCountDto[];
}
