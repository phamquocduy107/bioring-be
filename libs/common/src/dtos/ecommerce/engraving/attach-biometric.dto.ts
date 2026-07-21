import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachBiometricDto {
  @ApiProperty({
    description: 'Biometric type',
    enum: ['SW', 'FP', 'HB'],
    example: 'FP',
  })
  @IsIn(['SW', 'FP', 'HB'])
  biometricType!: string;

  @ApiPropertyOptional({
    description:
      'Optional JSON string with extra data. For SW audio: {"startMs":0,"endMs":1000} defines the segment to engrave.',
    example: '{"startMs":0,"endMs":1000}',
  })
  @IsOptional()
  @IsString()
  extraData?: string;
}
