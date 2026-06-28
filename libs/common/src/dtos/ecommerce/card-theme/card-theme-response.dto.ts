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

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;
}

export class CardThemeListResponse {
  @ApiProperty({ type: [CardThemeResponse] })
  cardThemes!: CardThemeResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class CardThemeSingleResponse {
  @ApiProperty({ type: CardThemeResponse })
  cardTheme!: CardThemeResponse;
}

export class CardThemeDeleteResponse {
  @ApiProperty()
  success!: boolean;
}
