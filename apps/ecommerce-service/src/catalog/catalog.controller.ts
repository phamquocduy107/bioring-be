import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @GrpcMethod('EcommerceService', 'GetProducts')
  async getProducts(data: {
    page?: number;
    limit?: number;
    materialId?: string;
    maxPrice?: number;
  }) {
    return this.catalogService.getProducts(data);
  }

  @GrpcMethod('EcommerceService', 'GetProductById')
  async getProductById(data: { id: string }) {
    return this.catalogService.getProductById(data.id);
  }

  @GrpcMethod('EcommerceService', 'GetMaterials')
  async getMaterials() {
    return this.catalogService.getMaterials();
  }

  @GrpcMethod('EcommerceService', 'GetGemstones')
  async getGemstones() {
    return this.catalogService.getGemstones();
  }
}
