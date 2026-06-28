import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCardThemeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBgUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  styleConfig?: string;
}
