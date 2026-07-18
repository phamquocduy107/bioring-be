import {
  Controller,
  Get,
  Post,
  Patch,
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
import { Permissions, Permission, ListPaymentsQueryDto, CurrentUser } from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiListTransactionsDocs,
  ApiTransactionOverviewDocs,
  ApiForcePaidDocs,
  ApiSyncPaymentDocs,
  ApiRefundDocs,
  ApiUpdateShippingFeeDocs,
} from './transaction.swagger';

interface EcommerceGrpcService {
  listPayments(data: Record<string, unknown>): Observable<any>;
  getTransactionOverview(data: Record<string, never>): Observable<any>;
  forcePaidPayment(data: { paymentId: string; adminId: string }): Observable<any>;
  syncPaymentStatus(data: { paymentId: string }): Observable<any>;
  refundPayment(data: { paymentId: string; adminId: string; reason: string }): Observable<any>;
  updateShippingFee(data: { paymentId: string; amount: number }): Observable<any>;
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
    return this.call(() => this.grpc!.getTransactionOverview({}));
  }

  @Post(':id/force-paid')
  @Permissions(Permission.OrderWrite)
  @ApiForcePaidDocs()
  async forcePaid(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.forcePaidPayment({ paymentId: id, adminId: user.sub }),
    );
  }

  @Post(':id/sync')
  @Permissions(Permission.OrderWrite)
  @ApiSyncPaymentDocs()
  async syncPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() =>
      this.grpc!.syncPaymentStatus({ paymentId: id }),
    );
  }

  @Post(':id/refund')
  @Permissions(Permission.OrderWrite)
  @ApiRefundDocs()
  async refund(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.refundPayment({ paymentId: id, adminId: user.sub, reason: reason ?? '' }),
    );
  }

  @Patch(':id/shipping-fee')
  @Permissions(Permission.OrderWrite)
  @ApiUpdateShippingFeeDocs()
  async updateShippingFee(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('amount') amount: number,
  ) {
    return this.call(() =>
      this.grpc!.updateShippingFee({ paymentId: id, amount: Number(amount ?? 0) }),
    );
  }
}
