import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PaginationMeta {
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() lastPage!: number;
}

export class OrderResponse {
  @ApiProperty({ description: 'Order object' })
  order!: Record<string, unknown>;
}

export class OrderListResponse {
  @ApiProperty({ description: 'List of orders', example: [] })
  orders!: Record<string, unknown>[];

  @ApiPropertyOptional({ type: PaginationMeta })
  meta?: PaginationMeta;
}

export class OrderCreateResponse {
  @ApiProperty({ description: 'Created order' })
  order!: Record<string, unknown>;
}

export class ReviewResponse {
  @ApiProperty({ description: 'Reviewed order' })
  order!: Record<string, unknown>;
}
