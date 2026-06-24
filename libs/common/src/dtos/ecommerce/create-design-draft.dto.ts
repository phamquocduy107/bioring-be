import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDesignDraftDto {
  @ApiProperty({ type: String, example: 'prod-classic-band' })
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @ApiPropertyOptional({ type: String, example: 'CLASSIC' })
  @IsOptional()
  @IsString()
  ringStyle?: string;

  @ApiPropertyOptional({ type: String, example: 'ROUND' })
  @IsOptional()
  @IsString()
  ringShape?: string;

  @ApiPropertyOptional({ type: String, example: '7' })
  @IsOptional()
  @IsString()
  ringSize?: string;

  @ApiPropertyOptional({ type: String, example: 'mat-gold-18k' })
  @IsOptional()
  @IsUUID('4')
  selectedMaterialId?: string;

  @ApiPropertyOptional({ type: String, example: 'gmt-diamond-05' })
  @IsOptional()
  @IsUUID('4')
  selectedGemstoneId?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      '{"engravedType":"fp","engravingPositions":{"fp":{"enabled":true,"status":"pending","imageUrl":"https://cdn.bioring.com/placeholder/fingerprint-default.svg","position":{"x":0.5,"y":0.3,"rotation":45,"scale":1}}}}',
  })
  @IsOptional()
  @IsString()
  customizationConfig?: string;
}
