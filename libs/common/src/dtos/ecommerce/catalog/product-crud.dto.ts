import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateProductBodyDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() base_material_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() base_price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnail_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model_3d_url?: string;
}

export class UpdateProductBodyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() base_material_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() base_price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnail_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model_3d_url?: string;
}
