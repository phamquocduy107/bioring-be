import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { MAX_PRODUCT_CANDIDATES } from '../chat/chat.types';
import type { ProductCandidate } from './catalog.types';

type ProductRow = Prisma.productsGetPayload<{
  include: {
    materials: true;
    product_gemstones: { include: { gemstones: true } };
    product_materials: { include: { materials: true } };
  };
}>;

@Injectable()
export class ProductRecommendationService {
  private readonly logger = new Logger(ProductRecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search catalog rings via shared Prisma products table (ecommerce catalog).
   *
   * Hard filters: is_active, budget, material, stone.
   * Soft rank: purpose/style keywords (không loại hết nếu name/desc không chứa từ khóa).
   */
  async searchRings(
    productFilters: Record<string, unknown>,
  ): Promise<ProductCandidate[]> {
    try {
      const where: Prisma.productsWhereInput = { is_active: true };
      const and: Prisma.productsWhereInput[] = [];

      const budgetMax = this.toNumber(productFilters.budgetMax);
      const budgetMin = this.toNumber(productFilters.budgetMin);
      if (budgetMax != null || budgetMin != null) {
        where.base_price = {
          ...(budgetMin != null ? { gte: budgetMin } : {}),
          ...(budgetMax != null ? { lte: budgetMax } : {}),
        };
      }

      const material = this.toString(productFilters.material);
      if (material) {
        const materialKeys = this.expandSearchKeywords(material);
        and.push({
          OR: materialKeys.flatMap((key) => [
            {
              materials: { name: { contains: key, mode: 'insensitive' } },
            },
            {
              product_materials: {
                some: {
                  materials: {
                    name: { contains: key, mode: 'insensitive' },
                  },
                },
              },
            },
          ]),
        });
      }

      const stoneName = this.toString(productFilters.stoneName);
      const stoneColor = this.toString(productFilters.stoneColor);
      if (stoneName || stoneColor) {
        const stoneNameKeys = this.expandSearchKeywords(stoneName);
        const stoneColorKeys = this.expandSearchKeywords(stoneColor);
        and.push({
          product_gemstones: {
            some: {
              gemstones: {
                AND: [
                  stoneNameKeys.length
                    ? {
                        OR: stoneNameKeys.map((k) => ({
                          type: { contains: k, mode: 'insensitive' as const },
                        })),
                      }
                    : {},
                  stoneColorKeys.length
                    ? {
                        OR: stoneColorKeys.map((k) => ({
                          color: { contains: k, mode: 'insensitive' as const },
                        })),
                      }
                    : {},
                ],
              },
            },
          },
        });
      }

      if (and.length) {
        where.AND = and;
      }

      // Lấy rộng hơn MAX rồi soft-rank theo purpose/style.
      const fetchLimit = Math.max(MAX_PRODUCT_CANDIDATES * 4, 20);
      const products = await this.prisma.products.findMany({
        where,
        take: fetchLimit,
        orderBy: { base_price: 'asc' },
        include: {
          materials: true,
          product_gemstones: { include: { gemstones: true } },
          product_materials: { include: { materials: true } },
        },
      });

      const style = this.toString(productFilters.style);
      const purpose = this.toString(productFilters.purpose);
      const ranked = this.rankByPreferences(products, { style, purpose });

      return ranked.slice(0, MAX_PRODUCT_CANDIDATES).map((product) => {
        const primaryGem = product.product_gemstones?.[0]?.gemstones;
        const materialName =
          product.materials?.name ??
          product.product_materials?.[0]?.materials?.name ??
          undefined;
        const shortDescription = product.description
          ? product.description.slice(0, 280)
          : undefined;

        return {
          id: product.id,
          name: product.name,
          shortDescription,
          price: product.base_price ? Number(product.base_price) : undefined,
          material: materialName,
          style: style ?? undefined,
          purpose: purpose ?? undefined,
          stoneName: primaryGem?.type ?? stoneName ?? undefined,
          stoneColor: primaryGem?.color ?? stoneColor ?? undefined,
          imageUrl: product.thumbnail_url ?? undefined,
          tags: [
            materialName,
            primaryGem?.type,
            primaryGem?.color,
            style,
            purpose,
          ].filter((tag): tag is string => !!tag),
          reason: this.buildReason(productFilters, product.name),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`searchRings failed: ${message}`);
      return [];
    }
  }

  /**
   * Ưu tiên sản phẩm có keyword purpose/style trong name/description,
   * nhưng vẫn giữ sản phẩm không khớp (score 0) để không trả rỗng oan.
   */
  private rankByPreferences(
    products: ProductRow[],
    prefs: { style: string | null; purpose: string | null },
  ): ProductRow[] {
    const styleKeys = this.expandSearchKeywords(prefs.style);
    const purposeKeys = this.expandSearchKeywords(prefs.purpose);
    if (!styleKeys.length && !purposeKeys.length) {
      return products;
    }

    const scored = products.map((product) => {
      const haystack =
        `${product.name ?? ''} ${product.description ?? ''}`.toLowerCase();
      let score = 0;
      for (const key of purposeKeys) {
        if (haystack.includes(key.toLowerCase())) score += 3;
      }
      for (const key of styleKeys) {
        if (haystack.includes(key.toLowerCase())) score += 2;
      }
      return { product, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = a.product.base_price ? Number(a.product.base_price) : 0;
      const pb = b.product.base_price ? Number(b.product.base_price) : 0;
      return pa - pb;
    });

    return scored.map((s) => s.product);
  }

  private buildReason(
    filters: Record<string, unknown>,
    productName: string,
  ): string {
    const bits: string[] = [];
    if (filters.budgetMax != null) {
      bits.push(`phù hợp ngân sách ≤ ${String(filters.budgetMax)}`);
    }
    if (filters.style) bits.push(`phong cách ${String(filters.style)}`);
    if (filters.purpose) bits.push(`dịp ${String(filters.purpose)}`);
    if (filters.stoneColor || filters.stoneName) {
      bits.push(
        `đá ${[filters.stoneName, filters.stoneColor].filter(Boolean).join(' ')}`,
      );
    }
    return bits.length
      ? `${productName}: ${bits.join(', ')}.`
      : `${productName} từ catalog BIORING.`;
  }

  private expandSearchKeywords(value: string | null): string[] {
    if (!value) return [];
    const v = value.trim().toLowerCase();
    const aliases: Record<string, string[]> = {
      engagement: ['engagement', 'cầu hôn', 'đính hôn'],
      wedding: ['wedding', 'cưới', 'nhẫn cưới'],
      anniversary: ['anniversary', 'kỷ niệm'],
      daily: ['daily', 'hằng ngày', 'hàng ngày'],
      minimal: ['minimal', 'tối giản', 'đơn giản', 'minimalist'],
      luxury: ['luxury', 'sang trọng'],
      vintage: ['vintage', 'cổ điển', 'classic'],
      statement: ['statement', 'nổi bật'],
      elegant: ['elegant', 'thanh lịch', 'elegance'],
      diamond: ['diamond', 'kim cương'],
      white_gold: ['white gold', 'vàng trắng'],
      rose_gold: ['rose gold', 'vàng hồng'],
      yellow_gold: ['yellow gold', 'vàng'],
      silver: ['silver', 'bạc'],
      platinum: ['platinum', 'bạch kim'],
    };
    return aliases[v] ?? [value];
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }
}
