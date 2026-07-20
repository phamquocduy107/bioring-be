import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteCaptureSessionDto {
  @ApiPropertyOptional({
    description: 'Chất lượng capture (0-100)',
    example: 95,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  qualityScore?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú của staff',
    example: 'Vân tay rõ, chất lượng tốt',
  })
  @IsOptional()
  @IsString()
  staffNote?: string;
}
