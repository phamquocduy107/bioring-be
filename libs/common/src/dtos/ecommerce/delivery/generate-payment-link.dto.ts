import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class GeneratePaymentLinkDto {
  @ApiPropertyOptional({ example: 'https://bioring.vn/payment/success' })
  @IsOptional()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'https://bioring.vn/payment/cancel' })
  @IsOptional()
  cancelUrl?: string;
}
