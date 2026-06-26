import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEngravingVersionConfigDto {
  @ApiPropertyOptional({
    description: 'Selected material ID',
    example: 'c0a80121-0000-4000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID('4')
  selectedMaterialId?: string;

  @ApiPropertyOptional({
    description: 'Selected gemstone ID',
    example: 'c0a80121-0000-4000-8000-000000000002',
  })
  @IsOptional()
  @IsUUID('4')
  selectedGemstoneId?: string;

  @ApiPropertyOptional({
    description: 'Ring size',
    example: '7',
  })
  @IsOptional()
  @IsString()
  ringSize?: string;

  @ApiPropertyOptional({
    description: 'Ring style',
    example: 'CLASSIC',
  })
  @IsOptional()
  @IsString()
  ringStyle?: string;

  @ApiPropertyOptional({
    description: 'Ring shape',
    example: 'ROUND',
  })
  @IsOptional()
  @IsString()
  ringShape?: string;

  @ApiPropertyOptional({
    description: 'JSON string of customization config',
    example:
      '{"engravedType":"sw","selectedBiometrics":["SW"],"engravingPositions":{"sw":{"enabled":true,"status":"captured","position":{"startAngle":45,"width":180}}}}',
  })
  @IsOptional()
  @IsString()
  customizationConfig?: string;

  @ApiPropertyOptional({
    description: 'Preview image URL',
    example: 'https://res.cloudinary.com/.../preview.png',
  })
  @IsOptional()
  @IsString()
  previewImageUrl?: string;

  @ApiPropertyOptional({
    description: '3D model URL',
    example: 'https://res.cloudinary.com/.../model.glb',
  })
  @IsOptional()
  @IsString()
  model3dUrl?: string;

  @ApiPropertyOptional({
    description: 'Production file URL',
    example: 'https://res.cloudinary.com/.../production.stl',
  })
  @IsOptional()
  @IsString()
  productionFileUrl?: string;
}
