import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Inject,
  OnModuleInit,
  Optional,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  Permissions,
  Permission,
  CreateCardThemeDto,
  UpdateCardThemeDto,
} from '@app/common';

interface CardThemeResponse {
  id: string;
  themeCode: string;
  name: string;
  defaultBgUrl: string;
  styleConfig: string;
  isActive: boolean;
  createdAt: string;
}

interface EcommerceGrpcService {
  getCardThemes(data: {
    page?: number;
    limit?: number;
  }): Observable<{
    cardThemes: CardThemeResponse[];
    total: number;
    page: number;
    limit: number;
  }>;
  getCardTheme(data: {
    id: string;
  }): Observable<{ cardTheme: CardThemeResponse }>;
  createCardTheme(data: {
    themeCode: string;
    name: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }): Observable<{ cardTheme: CardThemeResponse }>;
  updateCardTheme(data: {
    id: string;
    themeCode?: string;
    name?: string;
    defaultBgUrl?: string;
    styleConfig?: string;
  }): Observable<{ cardTheme: CardThemeResponse }>;
  deleteCardTheme(data: {
    id: string;
  }): Observable<{ success: boolean }>;
}

@Controller('api/v1/card-themes')
export class CardThemeController implements OnModuleInit {
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

  @Get()
  async getAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.call(() =>
      this.grpc!.getCardThemes({
        page: page ?? 1,
        limit: limit ?? 10,
      }),
    );
  }

  @Get(':id')
  async getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getCardTheme({ id }));
  }

  @Post()
  @Permissions(Permission.DesignWrite)
  async create(@Body() body: CreateCardThemeDto) {
    return this.call(() =>
      this.grpc!.createCardTheme({
        themeCode: body.themeCode,
        name: body.name,
        defaultBgUrl: body.defaultBgUrl,
        styleConfig: body.styleConfig,
      }),
    );
  }

  @Put(':id')
  @Permissions(Permission.DesignWrite)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateCardThemeDto,
  ) {
    return this.call(() =>
      this.grpc!.updateCardTheme({
        id,
        themeCode: body.themeCode,
        name: body.name,
        defaultBgUrl: body.defaultBgUrl,
        styleConfig: body.styleConfig,
      }),
    );
  }

  @Delete(':id')
  @Permissions(Permission.DesignWrite)
  async delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.deleteCardTheme({ id }));
  }
}
