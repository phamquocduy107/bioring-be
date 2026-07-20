import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

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

export function ApiCreateProductDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Create product', description: 'Admin creates a new catalog product.' }),
    ApiBody({ schema: { example: { name: 'Classic Band', base_price: 5000000 } } }),
    ApiResponse({ status: 201, description: 'Created', schema: { example: { success: true, id: 'uuid' } } }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiUpdateProductDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Update product', description: 'Admin updates a catalog product.' }),
    ApiParam({ name: 'id' }),
    ApiBody({ schema: { example: { name: 'Classic Band Updated', base_price: 6000000 } } }),
    ApiResponse({ status: 200, description: 'Updated', schema: { example: { success: true } } }),
    ApiResponse({ status: 404, description: 'Not found' }),
  );
}

export function ApiDeleteProductDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Delete product', description: 'Soft-delete a catalog product.' }),
    ApiParam({ name: 'id' }),
    ApiResponse({ status: 200, description: 'Deleted', schema: { example: { success: true } } }),
    ApiResponse({ status: 404, description: 'Not found' }),
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
