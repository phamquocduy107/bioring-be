import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/prisma';
import { PackageCatalogService } from './package-catalog.service';
import { ProductRecommendationService } from './product-recommendation.service';

/**
 * Ứng viên sản phẩm/gói dịch vụ cho chat RAG.
 * Product: đọc catalog ecommerce (Prisma).
 * Package: stub cho đến khi có package catalog thật.
 */
@Module({
  imports: [PrismaModule],
  providers: [ProductRecommendationService, PackageCatalogService],
  exports: [ProductRecommendationService, PackageCatalogService],
})
export class CatalogModule {}
