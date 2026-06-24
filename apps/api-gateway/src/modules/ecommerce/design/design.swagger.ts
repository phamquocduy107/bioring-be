import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

function designDraftExample() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '',
    productId: 'prod-classic-band',
    designCode: 'RS-A7B9X2',
    designSource: 'WEB',
    ringStyle: 'CLASSIC',
    ringShape: 'ROUND',
    ringSize: '7',
    selectedMaterialId: 'mat-gold-18k',
    selectedGemstoneId: 'gmt-diamond-05',
    customizationConfig:
      '{"engravedType":"fp","engravingPositions":{"fp":{"enabled":true,"status":"pending","imageUrl":"https://cdn.bioring.com/placeholder/fingerprint-default.svg","position":{"x":0.5,"y":0.3,"rotation":45,"scale":1}}},"ringPreviewUrl":"https://cdn.bioring.com/placeholder/ring-default.png"}',
    estimatedPrice: 7200,
    status: 'DRAFT',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T10:00:00.000Z',
    product: {
      id: 'prod-classic-band',
      name: 'Classic Solitaire',
      description: 'A timeless solitaire engagement ring',
      baseMaterialId: 'mat-gold-18k',
      basePrice: 1200,
      thumbnailUrl: 'https://cdn.bioring.com/placeholder/ring-default.png',
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
    selectedMaterial: {
      id: 'mat-gold-18k',
      name: 'Vàng 18K',
      purity: '75%',
      color: 'Vàng',
      currentPricePerGram: 1200,
    },
    selectedGemstone: {
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
  };
}

const COOKIE_NOTE =
  'Requires `guest_session_id` cookie (set automatically by the gateway for guest users)';

export function ApiCreateDesignDraftDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new design draft (guest)',
      description: COOKIE_NOTE,
    }),
    ApiResponse({
      status: 201,
      description: 'Design draft created',
      schema: {
        example: {
          draft: designDraftExample(),
          designCode: 'RS-A7B9X2',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
  );
}

export function ApiGetDesignDraftByCodeDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get design draft by design code' }),
    ApiParam({ name: 'code', type: String, example: 'RS-A7B9X2' }),
    ApiResponse({
      status: 200,
      description: 'Design draft detail',
      schema: { example: { draft: designDraftExample() } },
    }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}

export function ApiGetMyDraftsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get my design drafts',
      description: COOKIE_NOTE,
    }),
    ApiResponse({
      status: 200,
      description: 'List of design drafts',
      schema: { example: { drafts: [designDraftExample()] } },
    }),
  );
}

export function ApiUpdateDesignDraftDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a design draft',
      description: COOKIE_NOTE,
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: 200,
      description: 'Design draft updated',
      schema: { example: { draft: designDraftExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({
      status: 403,
      description: 'You do not own this design draft',
    }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}

export function ApiClaimDesignDraftDocs() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Claim a design draft (mobile, requires JWT)',
      description:
        'Requires `design.write` permission. User ID is extracted from JWT token via @CurrentUser().',
    }),
    ApiResponse({
      status: 200,
      description: 'Design draft claimed',
      schema: { example: { draft: designDraftExample() } },
    }),
    ApiResponse({ status: 400, description: 'Invalid input' }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized or insufficient permissions',
    }),
    ApiResponse({ status: 404, description: 'Design draft not found' }),
  );
}
