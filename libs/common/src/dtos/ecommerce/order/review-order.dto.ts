import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewOrderDto {
  @ApiProperty({
    description: 'Action',
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

  @ApiPropertyOptional({
    description: 'Engraving IDs to review (empty = all engravings)',
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  engravingIds?: string[];
}
