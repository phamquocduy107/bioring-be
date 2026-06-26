import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CardThemeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  themeCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  defaultBgUrl?: string;

  @ApiPropertyOptional()
  styleConfig?: string;
}

export class QrMemoryResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  engravingId!: string;

  @ApiProperty()
  qrCode!: string;

  @ApiPropertyOptional()
  cardTitle?: string;

  @ApiPropertyOptional()
  greetingMessage?: string;

  @ApiPropertyOptional()
  recipientEmail?: string;

  @ApiPropertyOptional()
  customImages?: string;

  @ApiPropertyOptional()
  biometricDisplaySettings?: string;

  @ApiProperty()
  isLocked!: boolean;

  @ApiPropertyOptional({ type: CardThemeResponse })
  cardTheme?: CardThemeResponse;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class QrMemoryUpdateResponse {
  @ApiProperty({ type: QrMemoryResponse })
  qrMemory!: QrMemoryResponse;
}

export class QrMemoryActivateResponse {
  @ApiProperty({ type: QrMemoryResponse })
  qrMemory!: QrMemoryResponse;
}
