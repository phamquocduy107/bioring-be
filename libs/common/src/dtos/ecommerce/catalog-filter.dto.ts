import { IsOptional, IsPositive, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CatalogFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;
}
