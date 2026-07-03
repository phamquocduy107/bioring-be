import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description:
      'Engraving ID — created from ClaimDesignDraft. Server derives packageType from selected_biometrics column.',
    example: 'c0a80121-0000-4000-8000-000000000001',
  })
  @IsUUID('4')
  engravingId!: string;
}
