import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  Public,
  Permissions,
  Permission,
  CatalogFilterDto,
  CreateProductBodyDto,
  UpdateProductBodyDto,
} from '@app/common';
import {
  ApiGetProductsDocs,
  ApiGetProductByIdDocs,
  ApiGetMaterialsDocs,
  ApiGetGemstonesDocs,
  ApiCreateProductDocs,
  ApiUpdateProductDocs,
  ApiDeleteProductDocs,
} from './catalog.swagger';

interface MaterialResponse {
  id: string;
  name: string;
  purity: string;
  color: string;
  currentPricePerGram: number;
}

interface GemstoneResponse {
  id: string;
  type: string;
  carat: number;
  cut: string;
  color: string;
  clarity: string;
  certificationCode: string;
  price: number;
  isAvailable: boolean;
}

interface ProductResponse {
  id: string;
  name: string;
  description: string;
  baseMaterialId: string;
  basePrice: number;
  thumbnailUrl: string;
  model3dUrl: string;
  availableMaterials: MaterialResponse[];
  availableGemstones: GemstoneResponse[];
}

interface GetProductsResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  limit: number;
}

interface EcommerceGrpcService {
  getProducts(data: CatalogFilterDto): Observable<GetProductsResponse>;
  getProductById(data: {
    id: string;
  }): Observable<{ product: ProductResponse }>;
  getMaterials(
    data: Record<string, never>,
  ): Observable<{ materials: MaterialResponse[] }>;
  getGemstones(
    data: Record<string, never>,
  ): Observable<{ gemstones: GemstoneResponse[] }>;
  createProduct(data: Record<string, unknown>): Observable<{ success: boolean; id?: string }>;
  updateProduct(data: Record<string, unknown>): Observable<{ success: boolean }>;
  deleteProduct(data: { id: string }): Observable<{ success: boolean }>;
}

@Controller('api/v1')
@Public()
export class CatalogController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Get('products')
  @ApiGetProductsDocs()
  async getProducts(@Query() filters: CatalogFilterDto) {
    const result = await this.call(() => this.grpc!.getProducts(filters));
    return {
      products: result?.products ?? [],
      total: result?.total ?? 0,
      page: result?.page ?? 1,
      limit: result?.limit ?? 10,
    };
  }

  @Get('products/:id')
  @ApiGetProductByIdDocs()
  getProductById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.grpc!.getProductById({ id }));
  }

  @Get('materials')
  @ApiGetMaterialsDocs()
  async getMaterials() {
    const result = await this.call(() => this.grpc!.getMaterials({}));
    return { materials: result?.materials ?? [] };
  }

  @Get('gemstones')
  @ApiGetGemstonesDocs()
  async getGemstones() {
    const result = await this.call(() => this.grpc!.getGemstones({}));
    return { gemstones: result?.gemstones ?? [] };
  }

  @Post('products')
  @Permissions(Permission.CatalogWrite)
  @ApiCreateProductDocs()
  async createProduct(@Body() body: CreateProductBodyDto) {
    return this.call(() => this.grpc!.createProduct(body as unknown as Record<string, unknown>));
  }

  @Put('products/:id')
  @Permissions(Permission.CatalogWrite)
  @ApiUpdateProductDocs()
  async updateProduct(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateProductBodyDto,
  ) {
    return this.call(() =>
      this.grpc!.updateProduct({ id, ...body } as unknown as Record<string, unknown>),
    );
  }

  @Delete('products/:id')
  @Permissions(Permission.CatalogWrite)
  @ApiDeleteProductDocs()
  async deleteProduct(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.grpc!.deleteProduct({ id }));
  }
}
