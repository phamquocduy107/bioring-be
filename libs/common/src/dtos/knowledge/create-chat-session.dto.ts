import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateChatSessionDto {
  @ApiPropertyOptional({ description: 'Chat session title' })
  @IsOptional()
  @IsString()
  title?: string;
}
