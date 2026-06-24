import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiGetProductsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get paginated product catalog' }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of products',
      schema: {
        example: {
          products: [
            {
              id: 'prod-classic-band',
              name: 'Classic Solitaire',
              description: 'A timeless solitaire engagement ring',
              baseMaterialId: 'mat-gold-18k',
              basePrice: 1200,
              thumbnailUrl:
                'https://cdn.bioring.com/placeholder/ring-default.png',
              model3dUrl:
                'https://cdn.bioring.com/placeholder/ring-default.glb',
              availableMaterials: [
                {
                  id: 'mat-gold-18k',
                  name: 'Vàng 18K',
                  purity: '75%',
                  color: 'Vàng',
                  currentPricePerGram: 1200,
                },
              ],
              availableGemstones: [
                {
                  id: 'gmt-diamond-05',
                  type: 'Kim cương',
                  carat: 0.5,
                  cut: 'Brilliant',
                  color: 'D',
                  clarity: 'VS1',
                  certificationCode: 'GIA-123456',
                  price: 3000,
                  isAvailable: true,
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        },
      },
    }),
    ApiResponse({ status: 500, description: 'gRPC client not initialized' }),
  );
}

export function ApiGetProductByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get product by ID' }),
    ApiParam({ name: 'id', type: String, example: 'prod-classic-band' }),
    ApiResponse({
      status: 200,
      description: 'Product detail with available materials and gemstones',
      schema: {
        example: {
          product: {
            id: 'prod-classic-band',
            name: 'Classic Solitaire',
            description: 'A timeless solitaire engagement ring',
            baseMaterialId: 'mat-gold-18k',
            basePrice: 1200,
            thumbnailUrl:
              'https://cdn.bioring.com/placeholder/ring-default.png',
            model3dUrl: 'https://cdn.bioring.com/placeholder/ring-default.glb',
            availableMaterials: [
              {
                id: 'mat-gold-18k',
                name: 'Vàng 18K',
                purity: '75%',
                color: 'Vàng',
                currentPricePerGram: 1200,
              },
            ],
            availableGemstones: [
              {
                id: 'gmt-diamond-05',
                type: 'Kim cương',
                carat: 0.5,
                cut: 'Brilliant',
                color: 'D',
                clarity: 'VS1',
                certificationCode: 'GIA-123456',
                price: 3000,
                isAvailable: true,
              },
            ],
          },
        },
      },
    }),
    ApiResponse({ status: 404, description: 'Product not found' }),
  );
}

export function ApiGetMaterialsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all available materials' }),
    ApiResponse({
      status: 200,
      description: 'List of materials',
      schema: {
        example: {
          materials: [
            {
              id: 'mat-gold-18k',
              name: 'Vàng 18K',
              purity: '75%',
              color: 'Vàng',
              currentPricePerGram: 1200,
            },
          ],
        },
      },
    }),
  );
}

export function ApiGetGemstonesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all available gemstones' }),
    ApiResponse({
      status: 200,
      description: 'List of gemstones',
      schema: {
        example: {
          gemstones: [
            {
              id: 'gmt-diamond-05',
              type: 'Kim cương',
              carat: 0.5,
              cut: 'Brilliant',
              color: 'D',
              clarity: 'VS1',
              certificationCode: 'GIA-123456',
              price: 3000,
              isAvailable: true,
            },
          ],
        },
      },
    }),
  );
}
