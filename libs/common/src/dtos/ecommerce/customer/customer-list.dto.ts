import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerInfoDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() avatar!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() total_orders!: number;
  @ApiProperty() total_spent!: number;
  @ApiProperty() last_order_date!: string | null;
  @ApiProperty() join_date!: string;
  @ApiProperty() location!: string;
}

export class ListCustomersDto {
  @ApiProperty({ type: [CustomerInfoDto] })
  data!: CustomerInfoDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() last_page!: number;
}

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ example: 'nguyen' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'totalSpent' })
  @IsOptional()
  sort_by?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  sort_order?: 'asc' | 'desc';
}
