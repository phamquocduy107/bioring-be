import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BulkReviewItem {
  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  id!: string;

  @ApiProperty({
    description:
      'Action — approve → AWAITING_DEPOSIT, reject → REVISION_REQUIRED',
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

export class BulkReviewOrderDto {
  @ApiProperty({
    description: 'List of orders to review',
    type: [BulkReviewItem],
    example: [
      { id: '550e8400-e29b-41d4-a716-446655440001', action: 'approve' },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        action: 'reject',
        note: 'Need revision',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkReviewItem)
  items!: BulkReviewItem[];
}
