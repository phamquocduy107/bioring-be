import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CardThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [cardThemes, total] = await Promise.all([
      this.prisma.card_themes.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.card_themes.count(),
    ]);

    return {
      cardThemes: cardThemes.map(this.mapTheme),
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    const theme = await this.prisma.card_themes.findUnique({
      where: { id },
    });
    if (!theme) throw new NotFoundException('Card theme not found');

    return { cardTheme: this.mapTheme(theme) };
  }

  async create(data: {
    themeCode: string;
    name: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }) {
    const existing = await this.prisma.card_themes.findUnique({
      where: { theme_code: data.themeCode },
    });
    if (existing) {
      throw new ConflictException('Card theme code already exists');
    }

    const theme = await this.prisma.card_themes.create({
      data: {
        id: randomUUID(),
        theme_code: data.themeCode,
        name: data.name,
        default_bg_url: data.defaultBgUrl ?? null,
        style_config: data.styleConfig
          ? (JSON.parse(data.styleConfig) as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return { cardTheme: this.mapTheme(theme) };
  }

  async update(data: {
    id: string;
    themeCode?: string;
    name?: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }) {
    const theme = await this.prisma.card_themes.findUnique({
      where: { id: data.id },
    });
    if (!theme) throw new NotFoundException('Card theme not found');

    if (data.themeCode) {
      const existing = await this.prisma.card_themes.findUnique({
        where: { theme_code: data.themeCode },
      });
      if (existing && existing.id !== data.id) {
        throw new ConflictException('Card theme code already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.themeCode !== undefined) updateData.theme_code = data.themeCode;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.defaultBgUrl !== undefined)
      updateData.default_bg_url = data.defaultBgUrl;
    if (data.styleConfig !== undefined) {
      try {
        updateData.style_config = JSON.parse(data.styleConfig);
      } catch {
        updateData.style_config = data.styleConfig;
      }
    }

    const updated = await this.prisma.card_themes.update({
      where: { id: data.id },
      data: updateData,
    });

    return { cardTheme: this.mapTheme(updated) };
  }

  async delete(id: string) {
    const theme = await this.prisma.card_themes.findUnique({
      where: { id },
    });
    if (!theme) throw new NotFoundException('Card theme not found');

    await this.prisma.card_themes.delete({ where: { id } });

    return { success: true };
  }

  private mapTheme(theme: {
    id: string;
    theme_code: string;
    name: string;
    default_bg_url?: string | null;
    style_config?: any;
    is_active?: boolean | null;
    created_at?: Date | null;
  }) {
    return {
      id: theme.id,
      themeCode: theme.theme_code,
      name: theme.name,
      defaultBgUrl: theme.default_bg_url ?? '',
      styleConfig: theme.style_config
        ? JSON.stringify(theme.style_config)
        : '',
      isActive: theme.is_active ?? false,
      createdAt: theme.created_at?.toISOString() ?? '',
    };
  }
}
