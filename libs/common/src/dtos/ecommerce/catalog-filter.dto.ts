import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../pagination.dto';

export class CatalogFilterDto extends PaginationDto {
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
