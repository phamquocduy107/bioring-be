import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../pagination.dto';
import { ProductionTaskStatus } from '../../../enums/production-task-status.enum';

export class GetProductionTasksQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductionTaskStatus })
  @IsOptional()
  @IsEnum(ProductionTaskStatus)
  status?: ProductionTaskStatus;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440030' })
  @IsOptional()
  @IsUUID('4')
  jewelerId?: string;
}
