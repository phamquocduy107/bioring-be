import { IsOptional, IsPositive, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogFilterDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;

  @ApiPropertyOptional({ type: String, example: 'mat-gold-18k' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiPropertyOptional({ type: Number, example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;
}
