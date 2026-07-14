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
import { Permissions, Permission, ListPaymentsQueryDto } from '@app/common';
import { ApiListTransactionsDocs, ApiTransactionOverviewDocs } from './transaction.swagger';

interface EcommerceGrpcService {
  listPayments(data: Record<string, unknown>): Observable<any>;
  getTransactionOverview(): Observable<any>;
}

@Controller('api/v1/transactions')
export class TransactionController implements OnModuleInit {
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
    if (!this.grpc) throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Get()
  @Permissions(Permission.OrderRead)
  @ApiListTransactionsDocs()
  async listTransactions(@Query() query: ListPaymentsQueryDto) {
    const result = await this.call(() =>
      this.grpc!.listPayments({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        status: query.status ?? '',
        method: query.method ?? '',
      }),
    );
    return {
      data: result?.data ?? [],
      meta: {
        total: result?.total ?? 0,
        page: result?.page ?? 1,
        limit: result?.limit ?? 20,
        lastPage: result?.last_page ?? 0,
      },
    };
  }

  @Get('overview')
  @Permissions(Permission.OrderRead)
  @ApiTransactionOverviewDocs()
  async transactionOverview() {
    return this.call(() => this.grpc!.getTransactionOverview());
  }
}
