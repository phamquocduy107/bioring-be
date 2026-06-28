import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardThemeDto {
  @ApiProperty({ example: 'VALENTINE' })
  @IsNotEmpty()
  @IsString()
  themeCode!: string;

  @ApiProperty({ example: 'Valentine Theme' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBgUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  styleConfig?: string;
}
