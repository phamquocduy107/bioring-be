import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimDesignDraftDto {
  @ApiProperty({
    type: String,
    example: 'RS-A7B9X2',
    description: 'Design code từ MF-01 (web design)',
  })
  @IsNotEmpty()
  @IsString()
  designCode!: string;
}
