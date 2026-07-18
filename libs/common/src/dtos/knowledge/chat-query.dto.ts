import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';

export class ChatQueryDto {
  @ApiPropertyOptional({ description: 'Existing chat session ID' })
  @IsOptional()
  @IsString()
  chatSessionId?: string;

  @ApiPropertyOptional({
    description: 'Optional document IDs to scope the question',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @ApiProperty({ description: 'Question to ask' })
  @IsString()
  @IsNotEmpty()
  question: string;
}
