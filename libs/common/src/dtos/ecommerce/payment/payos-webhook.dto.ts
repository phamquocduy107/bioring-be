import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayOSWebhookDto {
  @ApiProperty({ description: 'PayOS order code (maps to our payment_code)' })
  @IsString()
  orderCode!: string;

  @ApiProperty({ description: 'PayOS transaction ID' })
  @IsString()
  transactionId!: string;

  @ApiProperty({ description: 'Payment code (our internal payment code)' })
  @IsOptional()
  @IsString()
  paymentCode?: string;

  @ApiProperty({ description: 'Payment status from PayOS' })
  @IsString()
  status!: string;

  @ApiProperty({ description: 'Amount paid' })
  @IsNumber()
  amount!: number;

  @ApiProperty({ description: 'Webhook signature for verification' })
  @IsString()
  signature!: string;

  @ApiPropertyOptional({ description: 'Raw data for HMAC verification' })
  @IsOptional()
  data?: string;
}
