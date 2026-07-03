import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewOrderDto {
  @ApiProperty({
    description: 'Action — 1 order = 1 engraving, approve/reject trực tiếp',
    example: 'approve',
    enum: ['approve', 'reject'],
  })
  @IsIn(['approve', 'reject'])
  action!: string;

  @ApiPropertyOptional({
    description: 'Manager note',
    example: 'Design looks good. Proceed to deposit.',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
