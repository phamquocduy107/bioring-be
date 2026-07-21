import { IsUUID, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiveServiceTicketDto {
  @ApiProperty({ description: 'Claim ID', format: 'uuid' })
  @IsUUID('4')
  claimId!: string;

  @ApiPropertyOptional({
    description: 'Condition note',
    example: 'Nhẫn có vết xước nhẹ',
  })
  @IsOptional()
  @IsString()
  conditionNote?: string;

  @ApiPropertyOptional({
    description: 'Received images',
    example: ['https://cloudinary.com/received.jpg'],
  })
  @IsOptional()
  @IsArray()
  receivedImages?: string[];

  @ApiProperty({ description: 'Jeweler ID', format: 'uuid' })
  @IsUUID('4')
  jewelerId!: string;
}
