import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignJewelerDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440030' })
  @IsUUID('4')
  jewelerId: string;
}
