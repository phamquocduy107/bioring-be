import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestSessionDto {
  @ApiProperty({ description: 'Họ tên khách', example: 'Nguyễn Văn A' })
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0909123456' })
  @IsString()
  @MaxLength(50)
  phone!: string;

  @ApiPropertyOptional({ description: 'Email', example: 'guest@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
