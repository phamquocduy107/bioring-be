import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDesignDraftDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  ringStyle?: string;

  @IsOptional()
  @IsString()
  ringShape?: string;

  @IsOptional()
  @IsString()
  ringSize?: string;

  @IsOptional()
  @IsString()
  selectedMaterialId?: string;

  @IsOptional()
  @IsString()
  selectedGemstoneId?: string;

  @IsOptional()
  @IsString()
  customizationConfig?: string;
}
