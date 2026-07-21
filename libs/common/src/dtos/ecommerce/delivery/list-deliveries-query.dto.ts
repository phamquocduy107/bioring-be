import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListDeliveriesQueryDto {
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

  @ApiPropertyOptional({ example: 'in_transit' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({ example: '2026-07-14' })
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({ example: 'DH001' })
  @IsOptional()
  search?: string;
}
