import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetCaptureSessionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Order ID', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orderId?: string;
}
