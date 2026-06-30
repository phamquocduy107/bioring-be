import { IsUUID, IsArray, ArrayNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PackageType } from '../../../enums/package-type.enum';

export class CreateOrderDto {
  @ApiProperty({
    description:
      'Engraving IDs — created from ClaimDesignDraft. All design data (selectedBiometrics, engravingPositions, memoryCard) was saved incrementally via PATCH config.',
    example: ['c0a80121-0000-4000-8000-000000000001'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  engravingIds!: string[];

  @ApiProperty({
    description: 'Package type — determines capture route and required biometrics',
    enum: PackageType,
    example: 'SW',
  })
  @IsEnum(PackageType)
  packageType!: PackageType;
}
