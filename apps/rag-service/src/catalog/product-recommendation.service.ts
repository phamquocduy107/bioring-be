import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { MAX_PRODUCT_CANDIDATES } from '../chat/chat.types';
import type { ProductCandidate } from './catalog.types';

@Injectable()
export class ProductRecommendationService {
  private readonly logger = new Logger(ProductRecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search catalog rings via shared Prisma products table (ecommerce catalog).
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
        and.push({
          OR: [
            {
              materials: { name: { contains: material, mode: 'insensitive' } },
            },
            {
              product_materials: {
                some: {
                  materials: {
                    name: { contains: material, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        });
      }

      const stoneName = this.toString(productFilters.stoneName);
      const stoneColor = this.toString(productFilters.stoneColor);
      if (stoneName || stoneColor) {
        and.push({
          product_gemstones: {
            some: {
              gemstones: {
                AND: [
                  stoneName
                    ? { type: { contains: stoneName, mode: 'insensitive' } }
                    : {},
                  stoneColor
                    ? { color: { contains: stoneColor, mode: 'insensitive' } }
                    : {},
                ],
              },
            },
          },
        });
      }

      const style = this.toString(productFilters.style);
      const purpose = this.toString(productFilters.purpose);
      if (style || purpose) {
        const keywords = [style, purpose].filter(Boolean) as string[];
        and.push({
          OR: keywords.flatMap((keyword) => [
            { name: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ]),
        });
      }

      if (and.length) {
        where.AND = and;
      }

      const products = await this.prisma.products.findMany({
        where,
        take: MAX_PRODUCT_CANDIDATES,
        orderBy: { created_at: 'desc' },
        include: {
          materials: true,
          product_gemstones: { include: { gemstones: true } },
          product_materials: { include: { materials: true } },
        },
      });

      return products.map((product) => {
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
          style: this.toString(productFilters.style) ?? undefined,
          purpose: this.toString(productFilters.purpose) ?? undefined,
          stoneName: primaryGem?.type ?? stoneName ?? undefined,
          stoneColor: primaryGem?.color ?? stoneColor ?? undefined,
          imageUrl: product.thumbnail_url ?? undefined,
          tags: [
            materialName,
            primaryGem?.type,
            primaryGem?.color,
            this.toString(productFilters.style),
            this.toString(productFilters.purpose),
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

  private buildReason(
    filters: Record<string, unknown>,
    productName: string,
  ): string {
    const bits: string[] = [];
    if (filters.budgetMax != null) {
      bits.push(`phù hợp ngân sách ≤ ${String(filters.budgetMax)}`);
    }
    if (filters.style) bits.push(`phong cách ${String(filters.style)}`);
    if (filters.stoneColor || filters.stoneName) {
      bits.push(
        `đá ${[filters.stoneName, filters.stoneColor].filter(Boolean).join(' ')}`,
      );
    }
    return bits.length
      ? `${productName}: ${bits.join(', ')}.`
      : `${productName} từ catalog BIORING.`;
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
