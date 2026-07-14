import {
  Controller,
  Get,
  Query,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { RedisService } from '@app/redis';
import {
  Permissions,
  Permission,
  RevenueTimelineQueryDto,
  TopProductsQueryDto,
} from '@app/common';
import {
  ApiGetDashboardSummaryDocs,
  ApiGetOrdersByStatusDocs,
  ApiGetRevenueTimelineDocs,
  ApiGetTopProductsDocs,
  ApiGetMonthlyGrowthDocs,
} from './admin.swagger';

interface EcommerceGrpcService {
  getDashboardSummary(data: object): Observable<any>;
  getOrdersByStatus(data: object): Observable<any>;
  getRevenueTimeline(data: { days?: number }): Observable<any>;
  getTopProducts(data: { limit?: number }): Observable<any>;
  getMonthlyGrowth(data: { months?: number }): Observable<any>;
}

@Controller('api/v1/admin/dashboard')
export class AdminController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
    @Optional()
    private readonly redisService?: RedisService,
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

  private async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl = 300,
  ): Promise<T> {
    if (this.redisService) {
      const cached = await this.redisService.get<T>(key);
      if (cached) return cached;
    }
    const result = await fn();
    if (this.redisService) {
      await this.redisService.set(key, result, ttl).catch(() => {});
    }
    return result;
  }

  @Get('summary')
  @Permissions(Permission.DashboardView)
  @ApiGetDashboardSummaryDocs()
  async getSummary() {
    return this.withCache('admin:dashboard:summary', () =>
      this.call(() => this.grpc!.getDashboardSummary({})),
    );
  }

  @Get('orders-by-status')
  @Permissions(Permission.DashboardView)
  @ApiGetOrdersByStatusDocs()
  async getOrdersByStatus() {
    return this.withCache('admin:dashboard:orders-by-status', () =>
      this.call(() => this.grpc!.getOrdersByStatus({})),
    );
  }

  @Get('revenue-timeline')
  @Permissions(Permission.DashboardView)
  @ApiGetRevenueTimelineDocs()
  async getRevenueTimeline(@Query() query: RevenueTimelineQueryDto) {
    const key = `admin:dashboard:revenue-timeline:${query.days ?? 7}`;
    return this.withCache(key, () =>
      this.call(() => this.grpc!.getRevenueTimeline({ days: query.days ?? 7 })),
    );
  }

  @Get('top-products')
  @Permissions(Permission.DashboardView)
  @ApiGetTopProductsDocs()
  async getTopProducts(@Query() query: TopProductsQueryDto) {
    const key = `admin:dashboard:top-products:${query.limit ?? 10}`;
    return this.withCache(key, () =>
      this.call(() => this.grpc!.getTopProducts({ limit: query.limit ?? 10 })),
    );
  }

  @Get('monthly-growth')
  @Permissions(Permission.DashboardView)
  @ApiGetMonthlyGrowthDocs()
  async getMonthlyGrowth(@Query('months') months?: string) {
    const m = Math.min(Math.max(Number(months) || 12, 1), 60);
    const key = `admin:dashboard:monthly-growth:${m}`;
    return this.withCache(key, () =>
      this.call(() => this.grpc!.getMonthlyGrowth({ months: m })),
    );
  }
}
