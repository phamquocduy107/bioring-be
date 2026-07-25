import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQrMemoryDto {
  @ApiPropertyOptional({
    description: 'Card title',
    example: 'Our Special Ring',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cardTitle?: string;

  @ApiPropertyOptional({
    description: 'Greeting message',
    example: 'Thank you for being with me!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  greetingMessage?: string;

  @ApiPropertyOptional({
    description: 'Recipient email (optional, for shared ownership)',
    example: 'friend@example.com',
  })
  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @ApiPropertyOptional({
    description: 'Card theme ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @IsOptional()
  @IsUUID('4')
  cardThemeId?: string;

  @ApiPropertyOptional({
    description: 'Custom images JSON config',
    example: '{"images":[{"url":"https://...","position":"top"}]}',
  })
  @IsOptional()
  @IsString()
  customImages?: string;

  @ApiPropertyOptional({
    description: 'Biometric display settings JSON',
    example: '{"showWaveform":true,"playbackSpeed":1.0}',
  })
  @IsOptional()
  @IsString()
  biometricDisplaySettings?: string;

  @ApiPropertyOptional({
    description: 'Access PIN (4-10 chars). Hash will be stored. Omit to keep current PIN.',
    example: '2048',
    minLength: 4,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(10)
  accessPin?: string;
}
