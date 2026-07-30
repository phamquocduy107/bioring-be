import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const EMAIL_TEST_TEMPLATES = [
  'orderApproved',
  'orderRejected',
  'paymentConfirmed',
  'invoicePayment',
  'invoiceFinal',
  'productionStarted',
  'readyForDelivery',
  'orderDelivered',
] as const;

export type EmailTestTemplate = (typeof EMAIL_TEST_TEMPLATES)[number];

export class SendTestEmailDto {
  @ApiProperty({ example: 'you@gmail.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({
    enum: EMAIL_TEST_TEMPLATES,
    example: 'invoicePayment',
  })
  @IsIn(EMAIL_TEST_TEMPLATES)
  template!: EmailTestTemplate;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
