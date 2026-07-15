import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListGuestCustomersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'nguyen' })
  @IsOptional()
  search?: string;
}
