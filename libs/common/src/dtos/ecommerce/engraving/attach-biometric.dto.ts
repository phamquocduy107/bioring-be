import { IsIn, IsString } from 'class-validator';
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
}
