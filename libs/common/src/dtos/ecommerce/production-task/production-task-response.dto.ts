import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductionTaskResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  orderId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003' })
  engravingId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440030' })
  assignedJewelerId: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @ApiPropertyOptional()
  assignedJewelerName?: string;

  @ApiPropertyOptional({ example: 'Ring production - ORD-001' })
  taskName?: string;

  @ApiPropertyOptional({ example: 'Production of custom ring with SW engraving' })
  taskDescription?: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiPropertyOptional({ example: '' })
  note?: string;

  @ApiProperty({ example: '2026-06-24T10:00:00.000Z' })
  startedAt: string;

  @ApiPropertyOptional({ example: '2026-06-24T11:30:00.000Z' })
  completedAt?: string;

  @ApiProperty({ example: '2026-06-24T10:00:00.000Z' })
  createdAt: string;
}
