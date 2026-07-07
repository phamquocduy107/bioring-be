import { IsIn, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QcAcceptOrderDto {
  @ApiProperty({ description: 'QC result', example: 'PASS', enum: ['PASS', 'FAIL'] })
  @IsIn(['PASS', 'FAIL'])
  result!: string;

  @ApiPropertyOptional({ description: 'Checklist JSON', example: '{"engraving":true,"material":true,"size":true}' })
  @IsOptional()
  @IsString()
  checklist?: string;

  @ApiPropertyOptional({ description: 'Proof image URLs', example: ['https://cloudinary.com/img1.jpg'] })
  @IsOptional()
  @IsArray()
  proofImages?: string[];

  @ApiPropertyOptional({ description: 'Manager note', example: 'Sản phẩm đạt yêu cầu' })
  @IsOptional()
  @IsString()
  note?: string;
}
