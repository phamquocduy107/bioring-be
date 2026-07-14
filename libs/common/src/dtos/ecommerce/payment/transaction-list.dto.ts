import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by status', example: 'SUCCESS' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by method', example: 'PAYOS' })
  @IsOptional()
  @IsString()
  method?: string;
}

class CustomerBriefDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  name!: string;

  @ApiProperty({ example: 'a@b.com' })
  email!: string;
}

export class PaymentTransactionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id!: string;

  @ApiProperty({ example: 'PAY-txn_abc123' })
  transactionId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  orderId!: string;

  @ApiProperty({ example: 'BIORING-A7B9X2' })
  orderNumber!: string;

  @ApiProperty({ type: CustomerBriefDto })
  customer!: CustomerBriefDto | null;

  @ApiProperty({ example: 'PAYOS' })
  method!: string;

  @ApiProperty({ example: 3960000 })
  amount!: number;

  @ApiProperty({ example: 'SUCCESS' })
  status!: string;

  @ApiProperty({ example: '2026-07-01T10:00:00.000Z' })
  createdAt!: string;
}

export class ListPaymentsResponseDto {
  @ApiProperty({ type: [PaymentTransactionDto] })
  data!: PaymentTransactionDto[];

  @ApiProperty({ example: 50 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  lastPage!: number;
}
