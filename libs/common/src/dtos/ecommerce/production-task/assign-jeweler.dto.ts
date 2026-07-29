import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignJewelerDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440030' })
  @IsOptional()
  @IsUUID('4')
  jewelerId?: string;
}
