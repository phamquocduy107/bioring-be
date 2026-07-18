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
import { Permissions, Permission, CurrentUser } from '@app/common';
import type { JwtPayload } from '@app/common';
import { ApiGetMyPerformanceDocs } from './jeweler.swagger';

interface EcommerceGrpcService {
  getMyPerformance(data: { jewelerId: string; from_date?: string }): Observable<unknown>;
}

@Controller('api/v1/jewelers')
export class JewelerController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc = this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Get('me/performance')
  @Permissions(Permission.DashboardView)
  @ApiGetMyPerformanceDocs()
  async getMyPerformance(
    @CurrentUser() user: JwtPayload,
    @Query('from_date') fromDate?: string,
  ) {
    return this.call(() =>
      this.grpc!.getMyPerformance({ jewelerId: user.sub, from_date: fromDate ?? '' }),
    );
  }
}
