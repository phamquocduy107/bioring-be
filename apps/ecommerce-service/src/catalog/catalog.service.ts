import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';

type ProductWithRelations = Prisma.productsGetPayload<{
  include: {
    product_materials: { include: { materials: true } };
    product_gemstones: { include: { gemstones: true } };
    materials: true;
  };
}>;

type ProductMaterialWithMaterial = Prisma.product_materialsGetPayload<{
  include: { materials: true };
}>;

type ProductGemstoneWithGemstone = Prisma.product_gemstonesGetPayload<{
  include: { gemstones: true };
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(data: {
    page?: number;
    limit?: number;
    materialId?: string;
    maxPrice?: number;
  }) {
    const page = data.page ?? 1;
    const limit = data.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.productsWhereInput = { is_active: true };
    if (data.materialId) where.base_material_id = data.materialId;
    if (data.maxPrice) where.base_price = { lte: data.maxPrice };

    const [products, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        skip,
        take: limit,
        include: {
          product_materials: { include: { materials: true } },
          product_gemstones: { include: { gemstones: true } },
          materials: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.products.count({ where }),
    ]);

    return {
      products: products.map((p) => this.mapProduct(p)),
      total,
      page,
      limit,
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        product_materials: { include: { materials: true } },
        product_gemstones: { include: { gemstones: true } },
        materials: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    return { product: this.mapProduct(product) };
  }

  async getMaterials() {
    const materials = await this.prisma.materials.findMany({
      orderBy: { name: 'asc' },
    });

    return {
      materials: materials.map((m) => ({
        id: m.id,
        name: m.name,
        purity: m.purity ?? '',
        color: m.color ?? '',
        currentPricePerGram: m.current_price_per_gram
          ? Number(m.current_price_per_gram)
          : 0,
      })),
    };
  }

  async getGemstones() {
    const gemstones = await this.prisma.gemstones.findMany({
      where: { is_available: true },
      orderBy: { type: 'asc' },
    });

    return {
      gemstones: gemstones.map((g) => ({
        id: g.id,
        type: g.type,
        carat: g.carat ? Number(g.carat) : 0,
        cut: g.cut ?? '',
        color: g.color ?? '',
        clarity: g.clarity ?? '',
        certificationCode: g.certification_code ?? '',
        price: g.price ? Number(g.price) : 0,
        isAvailable: g.is_available ?? true,
      })),
    };
  }

  private mapProduct(product: ProductWithRelations) {
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      baseMaterialId: product.base_material_id ?? '',
      basePrice: product.base_price ? Number(product.base_price) : 0,
      thumbnailUrl: product.thumbnail_url ?? '',
      model3dUrl: product.model_3d_url ?? '',
      availableMaterials: (product.product_materials ?? []).map(
        (pm: ProductMaterialWithMaterial) => ({
          id: pm.materials.id,
          name: pm.materials.name,
          purity: pm.materials.purity ?? '',
          color: pm.materials.color ?? '',
          currentPricePerGram: pm.materials.current_price_per_gram
            ? Number(pm.materials.current_price_per_gram)
            : 0,
        }),
      ),
      availableGemstones: (product.product_gemstones ?? []).map(
        (pg: ProductGemstoneWithGemstone) => ({
          id: pg.gemstones.id,
          type: pg.gemstones.type,
          carat: pg.gemstones.carat ? Number(pg.gemstones.carat) : 0,
          cut: pg.gemstones.cut ?? '',
          color: pg.gemstones.color ?? '',
          clarity: pg.gemstones.clarity ?? '',
          certificationCode: pg.gemstones.certification_code ?? '',
          price: pg.gemstones.price ? Number(pg.gemstones.price) : 0,
          isAvailable: pg.gemstones.is_available ?? true,
        }),
      ),
    };
  }
}
