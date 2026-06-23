import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export function ApiGetProductsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get paginated product catalog' }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 10 }),
    ApiQuery({ name: 'style', required: false, type: String }),
    ApiQuery({ name: 'materialId', required: false, type: String }),
    ApiQuery({ name: 'maxPrice', required: false, type: Number }),
    ApiResponse({
      status: 200,
      description: 'Paginated list of products',
    }),
  );
}

export function ApiGetProductByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get product by ID' }),
    ApiResponse({ status: 200, description: 'Product detail' }),
    ApiResponse({ status: 404, description: 'Product not found' }),
  );
}

export function ApiGetMaterialsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all available materials' }),
    ApiResponse({ status: 200, description: 'List of materials' }),
  );
}

export function ApiGetGemstonesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all available gemstones' }),
    ApiResponse({ status: 200, description: 'List of gemstones' }),
  );
}
