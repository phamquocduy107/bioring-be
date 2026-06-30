import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'Payment phase',
    example: 'DEPOSIT_2',
    enum: ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'],
  })
  @IsIn(['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'])
  paymentPhase!: string;

  @ApiPropertyOptional({ description: 'Return URL after PayOS payment' })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ description: 'Cancel URL if user cancels payment' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
