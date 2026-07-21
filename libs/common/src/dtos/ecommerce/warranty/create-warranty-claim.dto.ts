import { IsUUID, IsIn, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarrantyClaimDto {
  @ApiProperty({ description: 'Warranty ID', format: 'uuid' })
  @IsUUID('4')
  warrantyId!: string;

  @ApiProperty({ description: 'Order ID', format: 'uuid' })
  @IsUUID('4')
  orderId!: string;

  @ApiProperty({
    description: 'Service type',
    enum: ['WARRANTY', 'CLEANING', 'ADJUST_SIZE', 'REPAIR', 'OTHER'],
    example: 'WARRANTY',
  })
  @IsIn(['WARRANTY', 'CLEANING', 'ADJUST_SIZE', 'REPAIR', 'OTHER'])
  serviceType!: string;

  @ApiProperty({
    description: 'Issue description',
    example: 'Nhẫn bị trầy xước',
  })
  @IsString()
  issueDescription!: string;

  @ApiPropertyOptional({
    description: 'Proof images',
    example: ['https://cloudinary.com/img1.jpg'],
  })
  @IsOptional()
  @IsArray()
  proofImages?: string[];

  @ApiPropertyOptional({
    description: 'Proof videos',
    example: ['https://cloudinary.com/video1.mp4'],
  })
  @IsOptional()
  @IsArray()
  proofVideos?: string[];
}
