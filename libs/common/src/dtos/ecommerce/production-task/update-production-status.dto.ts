import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductionTaskStatus } from '../../../enums/production-task-status.enum';

export class UpdateProductionStatusDto {
  @ApiProperty({ enum: ProductionTaskStatus, example: 'COMPLETED' })
  @IsEnum(ProductionTaskStatus)
  status: ProductionTaskStatus;

  @ApiPropertyOptional({ example: 'Ring production finished' })
  @IsOptional()
  @IsString()
  note?: string;
}
