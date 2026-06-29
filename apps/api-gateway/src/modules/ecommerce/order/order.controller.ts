import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  Inject,
  OnModuleInit,
  Optional,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BypassInterceptors } from '@app/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  fromEvent,
  interval,
  lastValueFrom,
  map,
  merge,
  Observable,
} from 'rxjs';
import {
  Public,
  CurrentUser,
  Permissions,
  Permission,
  CreateOrderDto,
  ReviewOrderDto,
  InitiatePaymentDto,
  GetMyOrdersQueryDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateOrderDocs,
  ApiGetOrderDocs,
  ApiGetMyOrdersDocs,
  ApiReviewOrderDocs,
  ApiInitiatePaymentDocs,
  ApiPayOSWebhookDocs,
  ApiAssignJewelerDocs,
  ApiUpdateProductionStatusDocs,
} from './order.swagger';

interface EngravingBioMetricResponse {
  id: string;
  engravingId: string;
  biometricType: string;
  requiredChannel: string;
  rawFileUrl: string;
  processedSvgUrl: string;
  extraData: string;
  status: string;
}

interface EngravingVersionResponse {
  id: string;
  engravingId: string;
  versionNumber: number;
  selectedMaterialId: string;
  selectedGemstoneId: string;
  ringSize: string;
  ringStyle: string;
  ringShape: string;
  customizationConfig: string;
  status: string;
  managerId: string;
  managerNote: string;
  reviewedAt: string;
  createdAt: string;
}

interface EngravingResponse {
  id: string;
  orderId: string;
  userId: string;
  productId: string;
  uniqueProductId: string;
  approvedVersionId: string;
  status: string;
  versions: EngravingVersionResponse[];
  biometrics: EngravingBioMetricResponse[];
}

interface PaymentResponse {
  id: string;
  orderId: string;
  paymentPhase: string;
  amount: number;
  method: string;
  status: string;
  payosTransactionId: string;
  paymentUrl: string;
  paidAt: string;
  createdAt: string;
}

interface OrderResponse {
  id: string;
  orderCode: string;
  userId: string;
  designDraftId: string;
  captureRoute: string;
  designSource: string;
  status: string;
  subtotal: number;
  serviceFee: number;
  extraFee: number;
  discountAmount: number;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  payments: PaymentResponse[];
  engravings: EngravingResponse[];
}

interface ProductionTaskResponse {
  id: string;
  orderId: string;
  engravingId: string;
  assignedJewelerId: string;
  assignedJewelerName: string;
  status: string;
  note: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

interface EcommerceGrpcService {
  updateEngravingVersionConfig(data: {
    engravingVersionId: string;
    customizationConfig: string;
  }): Observable<{ version: EngravingVersionResponse }>;
  createOrder(data: {
    engravingIds: string[];
    userId: string;
  }): Observable<{ order: OrderResponse }>;
  getOrder(data: { id: string }): Observable<{ order: OrderResponse }>;
  getMyOrders(data: {
    page?: number;
    limit?: number;
    userId?: string;
  }): Observable<{
    orders: OrderResponse[];
    total: number;
    page: number;
    limit: number;
  }>;
  cancelPayment(data: {
    orderId: string;
    userId: string;
  }): Observable<{ success: boolean; orderCode: string }>;
  reviewOrder(data: {
    id: string;
    action: string;
    note: string;
    managerId: string;
    engravingIds: string[];
  }): Observable<{ order: OrderResponse }>;
  initiatePayment(data: {
    orderId: string;
    paymentPhase: string;
    returnUrl?: string;
    cancelUrl?: string;
    userId?: string;
  }): Observable<{
    payment: PaymentResponse;
    paymentUrl: string;
    qrCode: string;
  }>;
  handlePayOSWebhook(data: {
    webhookBody: string;
  }): Observable<{ success: boolean }>;
  assignJeweler(data: {
    orderId: string;
    jewelerId: string;
  }): Observable<{ task: ProductionTaskResponse }>;
  updateProductionStatus(data: {
    taskId: string;
    status: string;
    note: string;
  }): Observable<{ task: ProductionTaskResponse }>;
}

@Controller('api/v1/orders')
export class OrderController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  onModuleInit() {
    this.grpc =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
    if (this.grpc) {
      const proto = Object.getPrototypeOf(this.grpc);
      const methods = [
        ...Object.getOwnPropertyNames(proto),
        ...Object.getOwnPropertyNames(this.grpc),
      ];
      console.log('[Gateway] gRPC proxy methods:', [...new Set(methods)]);
    }
  }

  private async grpcCall<T>(
    methodName: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    const grpcAny = this.grpc as unknown as Record<string, Function>;
    const fn = grpcAny[methodName] ?? grpcAny[`${methodName[0].toUpperCase()}${methodName.slice(1)}`];
    if (!fn) {
      const proto = Object.getPrototypeOf(this.grpc);
      const allMethods = [
        ...Object.getOwnPropertyNames(proto),
        ...Object.getOwnPropertyNames(this.grpc),
      ];
      throw new Error(
        `gRPC method "${methodName}" not found. Available: ${[...new Set(allMethods)].join(', ')}`,
      );
    }
    return lastValueFrom(fn(data) as Observable<T>);
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Post()
  @ApiCreateOrderDocs()
  createOrder(@Body() body: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.createOrder({
        engravingIds: body.engravingIds,
        userId: user.sub,
      }),
    );
  }

  @Get(':id')
  @ApiGetOrderDocs()
  getOrder(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.grpc!.getOrder({ id }));
  }

  @Get()
  @ApiGetMyOrdersDocs()
  async getMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetMyOrdersQueryDto,
  ) {
    const result = await this.call(() =>
      this.grpc!.getMyOrders({
        userId: user.sub,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      }),
    );
    return {
      orders: result?.orders ?? [],
      total: result?.total ?? 0,
      page: result?.page ?? 1,
      limit: result?.limit ?? 10,
    };
  }

  @Put(':id/review')
  @Permissions(Permission.OrderWrite)
  @ApiReviewOrderDocs()
  reviewOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReviewOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.reviewOrder({
        id,
        action: body.action,
        note: body.note ?? '',
        managerId: user.sub,
        engravingIds: body.engravingIds ?? [],
      }),
    );
  }

  @Post(':id/payments')
  @ApiInitiatePaymentDocs()
  initiatePayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: InitiatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.initiatePayment({
        orderId: id,
        paymentPhase: body.paymentPhase,
        returnUrl: body.returnUrl ?? '',
        cancelUrl: body.cancelUrl ?? '',
        userId: user.sub,
      }),
    );
  }

  @Post(':id/payments/cancel')
  @ApiInitiatePaymentDocs()
  async cancelPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.call(() =>
      this.grpc!.cancelPayment({
        orderId: id,
        userId: user.sub,
      }),
    );
    const orderCode = result?.orderCode;
    if (orderCode && this.eventEmitter) {
      this.eventEmitter.emit(`payment.update.${orderCode}`, {
        status: 'CANCELLED',
        transactionId: null,
        orderCode,
      });
    }
    return result;
  }

  @Post('payments/webhook')
  @Public()
  @ApiPayOSWebhookDocs()
  async handlePayOSWebhook(@Body() body: Record<string, unknown>) {
    try {
      const result = await this.grpcCall<{ success: boolean }>(
        'handlePayOSWebhook',
        {
          webhookBody: JSON.stringify(body),
        },
      );
      if (result?.success) {
        const data = body.data as Record<string, unknown> | undefined;
        const orderCode = data?.orderCode;
        if (orderCode && this.eventEmitter) {
          this.eventEmitter.emit(`payment.update.${orderCode}`, {
            status: body.code === '00' ? 'PAID' : 'FAILED',
            transactionId: data?.reference,
            orderCode,
          });
        }
      }
      return result;
    } catch (error) {
      console.warn('[Gateway] PayOS webhook error:', (error as Error).message);
      return { success: false };
    }
  }

  @Sse(':orderCode/payments/events')
  @Public()
  @BypassInterceptors()
  ssePaymentStatus(
    @Param('orderCode') orderCode: string,
  ): Observable<MessageEvent> {
    const payment$ = this.eventEmitter
      ? fromEvent(this.eventEmitter, `payment.update.${orderCode}`).pipe(
          map((data) => ({ data }) as MessageEvent),
        )
      : new Observable<MessageEvent>();

    const heartbeat$ = interval(15000).pipe(
      map(() => ({
        data: { type: 'ping', status: 'waiting_for_payment' },
      })),
    );

    return merge(payment$, heartbeat$);
  }

  @Post(':id/assign-jeweler')
  @Permissions(Permission.OrderWrite)
  @ApiAssignJewelerDocs()
  assignJeweler(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { jewelerId: string },
  ) {
    return this.call(() =>
      this.grpc!.assignJeweler({ orderId: id, jewelerId: body.jewelerId }),
    );
  }

  @Put('production-tasks/:taskId/status')
  @Permissions(Permission.OrderWrite)
  @ApiUpdateProductionStatusDocs()
  updateProductionStatus(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.call(() =>
      this.grpc!.updateProductionStatus({
        taskId,
        status: body.status,
        note: body.note ?? '',
      }),
    );
  }
}
