import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductSalesDto {
  @ApiProperty({ example: 'prod-classic-band', description: 'Product ID' })
  id!: string;

  @ApiProperty({ example: 'Classic Band', description: 'Product name' })
  name!: string;

  @ApiProperty({ example: 42, description: 'Order count' })
  orderCount!: number;
}

export class TopProductsDto {
  @ApiProperty({ type: [ProductSalesDto], description: 'Top selling products' })
  data!: ProductSalesDto[];
}

export class TopProductsQueryDto {
  @ApiPropertyOptional({ example: 10, description: 'Limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
