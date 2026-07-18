import { IsIn, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewWarrantyClaimDto {
  @ApiProperty({
    description: 'Action',
    enum: ['approve', 'quotation', 'reject'],
    example: 'approve',
  })
  @IsIn(['approve', 'quotation', 'reject'])
  action!: string;

  @ApiPropertyOptional({
    description: 'Extra fee (required when action=quotation)',
    example: 500000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraFee?: number;

  @ApiPropertyOptional({ description: 'Manager note', example: 'Cần thay đá mới' })
  @IsOptional()
  @IsString()
  managerNote?: string;
}
