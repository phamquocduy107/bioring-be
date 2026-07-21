import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteServiceTicketDto {
  @ApiPropertyOptional({
    description: 'Result note',
    example: 'Đã thay đá mới, đánh bóng lại',
  })
  @IsOptional()
  @IsString()
  resultNote?: string;

  @ApiPropertyOptional({
    description: 'Cost update (if actual cost differs from quotation)',
    example: 500000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costUpdate?: number;
}
