import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachBiometricDto {
  @ApiProperty({
    description: 'Biometric type',
    enum: ['SW', 'FP', 'HB'],
    example: 'FP',
  })
  @IsIn(['SW', 'FP', 'HB'])
  biometricType!: string;

  @ApiProperty({
    description: 'Cloudinary URL of the raw biometric file',
    example: 'https://res.cloudinary.com/.../fingerprint.png',
  })
  @IsString()
  rawFileUrl!: string;

  @ApiProperty({
    description:
      'Optional JSON string with extra data. For SW audio: {"startMs":0,"endMs":1000} defines the segment to engrave.',
    example: '{"startMs":0,"endMs":1000}',
    required: false,
  })
  @IsOptional()
  @IsString()
  extraData?: string;
}
