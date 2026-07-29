import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../pagination.dto';

export class ListEngravingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', example: 'PENDING' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @ApiPropertyOptional({ description: 'Filter engravings without an order' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withoutOrder?: boolean;
}
