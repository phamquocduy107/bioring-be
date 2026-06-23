import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/prisma';
import { generateDesignCode } from './design-code.util';
import { randomUUID } from 'node:crypto';

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
export class DesignService {
  constructor(private readonly prisma: PrismaService) {}

  async createDesignDraft(data: {
    productId?: string;
    ringStyle?: string;
    ringShape?: string;
    ringSize?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    customizationConfig?: string;
    guestSessionId?: string;
  }) {
    if (!data.productId) throw new BadRequestException('productId is required');

    const product = await this.prisma.products.findUnique({
      where: { id: data.productId },
      include: { materials: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    let customizationConfig: Record<string, unknown> | null = null;
    if (data.customizationConfig) {
      try {
        customizationConfig = JSON.parse(data.customizationConfig) as Record<
          string,
          unknown
        >;
      } catch {
        throw new BadRequestException('customizationConfig must be valid JSON');
      }
      this.validateCustomizationConfig(customizationConfig);
    }

    let designCode = generateDesignCode();
    let isUnique = false;
    while (!isUnique) {
      const existing = await this.prisma.design_drafts.findUnique({
        where: { design_code: designCode },
      });
      if (!existing) {
        isUnique = true;
      } else {
        designCode = generateDesignCode();
      }
    }

    const materialPrice = product.materials?.current_price_per_gram
      ? Number(product.materials.current_price_per_gram) * 5
      : 0;

    let gemstonePrice = 0;
    if (data.selectedGemstoneId) {
      const gemstone = await this.prisma.gemstones.findUnique({
        where: { id: data.selectedGemstoneId },
      });
      gemstonePrice = gemstone?.price ? Number(gemstone.price) : 0;
    }

    const estimatedPrice =
      Number(product.base_price ?? 0) + materialPrice + gemstonePrice;

    const draft = await this.prisma.design_drafts.create({
      data: {
        id: randomUUID(),
        product_id: data.productId,
        guest_session_id: data.guestSessionId ?? null,
        design_code: designCode,
        design_source: 'WEB',
        ring_style: data.ringStyle ?? null,
        ring_shape: data.ringShape ?? null,
        ring_size: data.ringSize ?? null,
        selected_material_id: data.selectedMaterialId ?? null,
        selected_gemstone_id: data.selectedGemstoneId ?? null,
        customization_config: customizationConfig as Prisma.InputJsonValue,
        estimated_price: estimatedPrice,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'DRAFT',
      },
    });

    return {
      draft: await this.includeRelations(draft),
      designCode,
    };
  }

  async getDesignDraftByCode(designCode: string) {
    const draft = await this.prisma.design_drafts.findUnique({
      where: { design_code: designCode },
    });

    if (!draft) throw new NotFoundException('Design draft not found');

    return { draft: await this.includeRelations(draft) };
  }

  async getMyDrafts(guestSessionId: string) {
    const drafts = await this.prisma.design_drafts.findMany({
      where: { guest_session_id: guestSessionId },
      orderBy: { created_at: 'desc' },
    });

    const result = await Promise.all(
      drafts.map((d) => this.includeRelations(d)),
    );

    return { drafts: result };
  }

  async updateDesignDraft(data: {
    id?: string;
    ringStyle?: string;
    ringShape?: string;
    ringSize?: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    customizationConfig?: string;
    guestSessionId?: string;
  }) {
    if (!data.id) throw new BadRequestException('id is required');

    const existing = await this.prisma.design_drafts.findUnique({
      where: { id: data.id },
    });
    if (!existing) throw new NotFoundException('Design draft not found');

    if (
      existing.guest_session_id &&
      existing.guest_session_id !== data.guestSessionId
    ) {
      throw new ForbiddenException('You do not own this design draft');
    }

    let customizationConfig: Record<string, unknown> | null = null;
    if (data.customizationConfig) {
      try {
        customizationConfig = JSON.parse(data.customizationConfig) as Record<
          string,
          unknown
        >;
      } catch {
        throw new BadRequestException('customizationConfig must be valid JSON');
      }
      this.validateCustomizationConfig(customizationConfig);
    }

    const updateData: Prisma.design_draftsUncheckedUpdateInput = {};
    if (data.ringStyle !== undefined) updateData.ring_style = data.ringStyle;
    if (data.ringShape !== undefined) updateData.ring_shape = data.ringShape;
    if (data.ringSize !== undefined) updateData.ring_size = data.ringSize;
    if (data.selectedMaterialId !== undefined)
      updateData.selected_material_id = data.selectedMaterialId;
    if (data.selectedGemstoneId !== undefined)
      updateData.selected_gemstone_id = data.selectedGemstoneId;
    if (customizationConfig !== null)
      updateData.customization_config =
        customizationConfig as Prisma.InputJsonValue;

    if (data.selectedMaterialId || data.selectedGemstoneId) {
      const product = await this.prisma.products.findUnique({
        where: { id: existing.product_id! },
        include: { materials: true },
      });
      if (product) {
        const materialPrice = product.materials?.current_price_per_gram
          ? Number(product.materials.current_price_per_gram) * 5
          : 0;
        let gemstonePrice = 0;
        const gemstoneId =
          data.selectedGemstoneId ?? existing.selected_gemstone_id;
        if (gemstoneId) {
          const gemstone = await this.prisma.gemstones.findUnique({
            where: { id: gemstoneId },
          });
          gemstonePrice = gemstone?.price ? Number(gemstone.price) : 0;
        }
        updateData.estimated_price =
          Number(product.base_price ?? 0) + materialPrice + gemstonePrice;
      }
    }

    const draft = await this.prisma.design_drafts.update({
      where: { id: data.id },
      data: updateData,
    });

    return { draft: await this.includeRelations(draft) };
  }

  async claimDesignDraft(designCode: string, userId: string) {
    const draft = await this.prisma.design_drafts.findUnique({
      where: { design_code: designCode },
    });
    if (!draft) throw new NotFoundException('Design draft not found');

    const updated = await this.prisma.design_drafts.update({
      where: { id: draft.id },
      data: {
        user_id: userId,
        guest_session_id: null,
      },
    });

    return { draft: await this.includeRelations(updated) };
  }

  private validateCustomizationConfig(config: Record<string, unknown>): void {
    if (
      config === null ||
      typeof config !== 'object' ||
      Array.isArray(config)
    ) {
      throw new BadRequestException('customizationConfig must be an object');
    }

    if (
      config.engravedType !== undefined &&
      config.engravedType !== null &&
      config.engravedType !== 'fp' &&
      config.engravedType !== 'sw'
    ) {
      throw new BadRequestException('engravedType must be "fp", "sw", or null');
    }

    const positions = config.engravingPositions as
      | Record<string, unknown>
      | undefined;
    if (
      positions &&
      typeof positions === 'object' &&
      !Array.isArray(positions)
    ) {
      const fp = positions.fp as Record<string, unknown> | undefined;
      if (fp && typeof fp === 'object') {
        const pos = fp.position as Record<string, unknown> | undefined;
        if (pos && typeof pos === 'object') {
          if (typeof pos.x !== 'number' || pos.x < 0 || pos.x > 1)
            throw new BadRequestException(
              'fp.position.x must be a number between 0 and 1',
            );
          if (typeof pos.y !== 'number' || pos.y < 0 || pos.y > 1)
            throw new BadRequestException(
              'fp.position.y must be a number between 0 and 1',
            );
        }
      }

      const sw = positions.sw as Record<string, unknown> | undefined;
      if (sw && typeof sw === 'object') {
        const pos = sw.position as Record<string, unknown> | undefined;
        if (pos && typeof pos === 'object') {
          if (
            typeof pos.startAngle !== 'number' ||
            pos.startAngle < 0 ||
            pos.startAngle > 360
          )
            throw new BadRequestException(
              'sw.position.startAngle must be a number between 0 and 360',
            );
          if (typeof pos.width !== 'number' || pos.width < 0 || pos.width > 360)
            throw new BadRequestException(
              'sw.position.width must be a number between 0 and 360',
            );
        }
      }
    }
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

  private async includeRelations(
    draft: Prisma.design_draftsGetPayload<object>,
  ) {
    const product = draft.product_id
      ? await this.prisma.products.findUnique({
          where: { id: draft.product_id },
          include: {
            product_materials: { include: { materials: true } },
            product_gemstones: { include: { gemstones: true } },
            materials: true,
          },
        })
      : null;

    const selectedMaterial = draft.selected_material_id
      ? await this.prisma.materials.findUnique({
          where: { id: draft.selected_material_id },
        })
      : null;

    const selectedGemstone = draft.selected_gemstone_id
      ? await this.prisma.gemstones.findUnique({
          where: { id: draft.selected_gemstone_id },
        })
      : null;

    return {
      id: draft.id,
      userId: draft.user_id ?? '',
      productId: draft.product_id ?? '',
      designCode: draft.design_code ?? '',
      designSource: draft.design_source ?? '',
      ringStyle: draft.ring_style ?? '',
      ringShape: draft.ring_shape ?? '',
      ringSize: draft.ring_size ?? '',
      selectedMaterialId: draft.selected_material_id ?? '',
      selectedGemstoneId: draft.selected_gemstone_id ?? '',
      customizationConfig: draft.customization_config
        ? JSON.stringify(draft.customization_config)
        : '',
      estimatedPrice: draft.estimated_price ? Number(draft.estimated_price) : 0,
      status: draft.status ?? '',
      createdAt: draft.created_at?.toISOString() ?? '',
      updatedAt: draft.updated_at?.toISOString() ?? '',
      product: product ? this.mapProduct(product) : null,
      selectedMaterial: selectedMaterial
        ? {
            id: selectedMaterial.id,
            name: selectedMaterial.name,
            purity: selectedMaterial.purity ?? '',
            color: selectedMaterial.color ?? '',
            currentPricePerGram: selectedMaterial.current_price_per_gram
              ? Number(selectedMaterial.current_price_per_gram)
              : 0,
          }
        : null,
      selectedGemstone: selectedGemstone
        ? {
            id: selectedGemstone.id,
            type: selectedGemstone.type,
            carat: selectedGemstone.carat ? Number(selectedGemstone.carat) : 0,
            cut: selectedGemstone.cut ?? '',
            color: selectedGemstone.color ?? '',
            clarity: selectedGemstone.clarity ?? '',
            certificationCode: selectedGemstone.certification_code ?? '',
            price: selectedGemstone.price ? Number(selectedGemstone.price) : 0,
            isAvailable: selectedGemstone.is_available ?? true,
          }
        : null,
    };
  }
}
