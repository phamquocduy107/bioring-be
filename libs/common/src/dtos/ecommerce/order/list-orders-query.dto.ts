import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../pagination.dto';

export class ListOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', example: 'PENDING_REVIEW' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by order code or customer name', example: 'BIORING' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO)', example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO)', example: '2026-12-31' })
  @IsOptional()
  @IsString()
  to_date?: string;
}
