import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  BulkReviewOrderDto,
  InitiatePaymentDto,
  GetMyOrdersQueryDto,
  ListOrdersQueryDto,
  AssignJewelerDto,
  UpdateProductionStatusDto,
  GetProductionTasksQueryDto,
  QcAcceptOrderDto,
  InitiateDeliveryDto,
  UpdateShipmentStatusDto,
  OrderLookupDto,
  ListDeliveriesQueryDto,
  DeliveryPreferenceDto,
  ClaimDeliveryDto,
  GeneratePaymentLinkDto,
  SkipRemainingPaymentDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateOrderDocs,
  ApiGetOrderDocs,
  ApiGetMyOrdersDocs,
  ApiListOrdersDocs,
  ApiListDeliveriesDocs,
  ApiListPickupsDocs,
  ApiReviewOrderDocs,
  ApiBulkReviewOrderDocs,
  ApiInitiatePaymentDocs,
  ApiPayOSWebhookDocs,
  ApiSubmitOrderDocs,
  ApiAssignJewelerDocs,
  ApiUpdateProductionStatusDocs,
  ApiGetProductionTasksDocs,
  ApiQcAcceptOrderDocs,
  ApiInitiateDeliveryDocs,
  ApiSaveDeliveryPreferenceDocs,
  ApiUpdateShipmentStatusDocs,
  ApiGetDeliveryInfoDocs,
  ApiGetWarrantyInfoDocs,
  ApiGetProductionInfoDocs,
  ApiLookupOrderDocs,
  ApiConfirmPickupDocs,
  ApiClaimDeliveryDocs,
  ApiGenerateDeliveryPaymentLinkDocs,
  ApiSkipRemainingPaymentDocs,
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
  engraving: EngravingResponse | null;
}

interface ProductionTaskResponse {
  id: string;
  orderId: string;
  engravingId: string;
  assignedJewelerId: string;
  assignedJewelerName: string;
  taskName: string;
  taskDescription: string;
  status: string;
  note: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

interface DeliveryResponse {
  id: string;
  orderId: string;
  deliveryMethod: string;
  status: string;
  trackingCode: string;
  trackingUrl: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddressText: string;
  estimatedDeliveryAt: string;
  deliveredAt: string;
  createdAt: string;
}

interface WarrantyInfoResponse {
  id: string;
  engravingId: string;
  orderId: string;
  warrantyCode: string;
  warrantyType: string;
  issueDate: string;
  expiryDate: string;
  activatedAt: string;
  status: string;
  warrantyScope: string;
}

interface QaCheckResponse {
  id: string;
  orderId: string;
  result: string;
  checklist: string;
  proofImages: string[];
  note: string;
  checkedAt: string;
  checkedByManagerId: string;
}

interface ProductionInfoResponse {
  task: ProductionTaskResponse | null;
  qaCheck: QaCheckResponse | null;
}

interface EcommerceGrpcService {
  updateEngravingVersionConfig(data: {
    engravingVersionId: string;
    customizationConfig: string;
  }): Observable<{ version: EngravingVersionResponse }>;
  createOrder(data: {
    engravingId: string;
    userId: string;
  }): Observable<{ order: OrderResponse }>;
  submitOrder(data: { id: string }): Observable<{ order: OrderResponse }>;
  getOrder(data: { id: string }): Observable<{ order: OrderResponse }>;
  getMyOrders(data: {
    page?: number;
    limit?: number;
    userId?: string;
    customerEmail?: string;
  }): Observable<{
    orders: OrderResponse[];
    total: number;
    page: number;
    limit: number;
  }>;
  listOrders(data: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    from_date?: string;
    to_date?: string;
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
  getProductionTasks(data: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    jewelerId?: string;
  }): Observable<{
    data: ProductionTaskResponse[];
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  }>;
  qcAcceptOrder(data: {
    orderId: string;
    result: string;
    checklist?: string;
    proofImages?: string[];
    note?: string;
    managerId: string;
  }): Observable<{ order: OrderResponse }>;
  initiateDelivery(data: {
    orderId: string;
    deliveryMethod: string;
    recipientName: string;
    recipientPhone: string;
    addressId?: string;
    shippingAddressText?: string;
    assignedDeliveryStaffId?: string;
    managerId: string;
  }): Observable<DeliveryResponse>;
  saveDeliveryPreference(data: {
    orderId: string;
    addressId: string;
    method: string;
  }): Observable<{ shipmentId: string; status: string }>;
  updateShipmentStatus(data: {
    orderId: string;
    status: string;
    receiverName?: string;
    receiverPhone?: string;
    identityNote?: string;
    proofImageUrl?: string;
    trackingCode?: string;
    staffId: string;
  }): Observable<{ order: OrderResponse }>;
  getDeliveryInfo(data: { orderId: string }): Observable<DeliveryResponse>;
  getWarrantyInfo(data: {
    orderId: string;
  }): Observable<{ warranty: WarrantyInfoResponse }>;
  getProductionInfo(data: {
    orderId: string;
  }): Observable<ProductionInfoResponse>;
  lookupOrder(data: {
    orderCode: string;
  }): Observable<{ order: OrderResponse }>;
  cancelOrder(data: {
    id: string;
    reason: string;
  }): Observable<{ order: OrderResponse }>;
  confirmPickup(data: {
    orderId: string;
    staffId: string;
    note?: string;
  }): Observable<{
    success: boolean;
    order: Record<string, unknown>;
    warrantyCode: string;
    warrantyExpiry: string;
    qrMemoryUnlocked: boolean;
  }>;
  manualPayment(data: {
    orderId: string;
    paymentPhase: string;
    amount: number;
    receivedBy: string;
    paymentMethod: string;
    reference?: string;
  }): Observable<unknown>;
  getPaymentStatus(data: { orderId: string }): Observable<unknown>;
  listDeliveries(data: Record<string, unknown>): Observable<unknown>;
  listPickups(data: {
    limit?: number;
    status?: string;
    search?: string;
  }): Observable<unknown>;
  claimDelivery(data: {
    orderId: string;
    staffId: string;
  }): Observable<unknown>;
  getMyCurrentDelivery(data: { staffId: string }): Observable<unknown>;
  generateDeliveryPaymentLink(data: {
    orderId: string;
    staffId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Observable<unknown>;
  skipRemainingPayment(data: {
    orderId: string;
    deliveryMethod: string;
  }): Observable<unknown>;
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
  }

  private async grpcCall<T>(
    methodName: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    const grpcAny = this.grpc as unknown as Record<string, Function>;
    const fn =
      grpcAny[methodName] ??
      grpcAny[`${methodName[0].toUpperCase()}${methodName.slice(1)}`];
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
        engravingId: body.engravingId,
        userId: user.sub,
      }),
    );
  }

  @Patch(':id/submit')
  @ApiSubmitOrderDocs()
  submitOrder(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.grpc!.submitOrder({ id }));
  }

  @Get('production-tasks')
  @Permissions(Permission.OrderRead)
  @ApiGetProductionTasksDocs()
  getProductionTasks(@Query() query: GetProductionTasksQueryDto) {
    return this.grpcCall('getProductionTasks', {
      page: query.page,
      limit: query.limit,
      status: query.status,
      orderId: query.orderId,
      jewelerId: query.jewelerId,
      all: query.all ?? false,
    });
  }

  @Get('admin')
  @Permissions(Permission.OrderWrite)
  @ApiListOrdersDocs()
  async listOrders(@Query() query: ListOrdersQueryDto) {
    const result = await this.grpcCall<
      { orders: OrderResponse[]; total: number; page: number; limit: number }
    >('listOrders', {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: query.status,
      search: query.search,
      from_date: query.from_date,
      to_date: query.to_date,
    });
    return {
      orders: result?.orders ?? [],
      total: result?.total ?? 0,
      page: result?.page ?? 1,
      limit: result?.limit ?? 10,
    };
  }

  @Get('deliveries')
  @Permissions(Permission.OrderRead)
  @ApiListDeliveriesDocs()
  async listDeliveries(@Query() query: ListDeliveriesQueryDto) {
    return this.call(() =>
      this.grpc!.listDeliveries({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        status: query.status ?? '',
        from_date: query.from_date ?? '',
        to_date: query.to_date ?? '',
        search: query.search ?? '',
        assigned_delivery_staff_id: query.assigned_delivery_staff_id ?? '',
      }),
    );
  }

  @Get('pickups')
  @Permissions(Permission.OrderRead)
  @ApiListPickupsDocs()
  async listPickups(
    @Query('limit') limit: string,
    @Query('status') status: string,
    @Query('search') search: string,
  ) {
    const result = await this.call(() =>
      this.grpc!.listPickups({
        limit: Number(limit) || 200,
        status: status ?? '',
        search: search ?? '',
      }),
    );
    return {
      data: ((result as Record<string, unknown>)?.data as unknown[]) ?? [],
    };
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
        customerEmail: query.customerEmail,
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
      }),
    );
  }

  @Put('bulk/review')
  @Permissions(Permission.OrderWrite)
  @ApiBulkReviewOrderDocs()
  async bulkReviewOrder(
    @Body() body: BulkReviewOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const results: {
      id: string;
      success: boolean;
      order?: OrderResponse;
      error?: string;
    }[] = [];
    for (const item of body.items) {
      try {
        const order = await this.call(() =>
          this.grpc!.reviewOrder({
            id: item.id,
            action: item.action,
            note: item.note ?? '',
            managerId: user.sub,
          }),
        );
        results.push({ id: item.id, success: true, order: order.order });
      } catch (e) {
        results.push({
          id: item.id,
          success: false,
          error: (e as Error).message,
        });
      }
    }
    return { results };
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
      const result = await this.grpcCall<{ success: boolean; orderCode: string }>(
        'handlePayOSWebhook',
        {
          webhookBody: JSON.stringify(body),
        },
      );
      if (result?.success) {
        const orderCode = result.orderCode;
        if (orderCode && this.eventEmitter) {
          this.eventEmitter.emit(`payment.update.${orderCode}`, {
            status: body.code === '00' ? 'PAID' : 'FAILED',
            transactionId: (body.data as Record<string, unknown> | undefined)?.reference,
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
  @Permissions(Permission.OrderAssign)
  @ApiAssignJewelerDocs()
  assignJeweler(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AssignJewelerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const jewelerId = body.jewelerId ?? user.sub;
    return this.call(() =>
      this.grpc!.assignJeweler({ orderId: id, jewelerId }),
    );
  }

  @Put('production-tasks/:taskId/status')
  @Permissions(Permission.OrderWrite)
  @ApiUpdateProductionStatusDocs()
  updateProductionStatus(
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() body: UpdateProductionStatusDto,
  ) {
    return this.call(() =>
      this.grpc!.updateProductionStatus({
        taskId,
        status: body.status,
        note: body.note ?? '',
      }),
    );
  }

  // ===== MF-05: Delivery, Pickup & QR Memory =====

  @Put(':id/qc-accept')
  @Permissions(Permission.OrderWrite)
  @ApiQcAcceptOrderDocs()
  qcAcceptOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: QcAcceptOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.qcAcceptOrder({
        orderId: id,
        result: body.result,
        checklist: body.checklist,
        proofImages: body.proofImages,
        note: body.note,
        managerId: user.sub,
      }),
    );
  }

  @Post(':id/delivery')
  @Permissions(Permission.OrderWrite)
  @ApiInitiateDeliveryDocs()
  initiateDelivery(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: InitiateDeliveryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.initiateDelivery({
        orderId: id,
        deliveryMethod: body.deliveryMethod,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        addressId: body.addressId,
        shippingAddressText: body.shippingAddressText,
        assignedDeliveryStaffId: body.assignedDeliveryStaffId,
        managerId: user.sub,
      }),
    );
  }

  @Post(':id/delivery-preference')
  @ApiSaveDeliveryPreferenceDocs()
  saveDeliveryPreference(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: DeliveryPreferenceDto,
  ) {
    return this.call(() =>
      this.grpc!.saveDeliveryPreference({
        orderId: id,
        addressId: body.addressId,
        method: body.method,
      }),
    );
  }

  @Put(':id/shipment/status')
  @Permissions(Permission.OrderWrite)
  @ApiUpdateShipmentStatusDocs()
  updateShipmentStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateShipmentStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.updateShipmentStatus({
        orderId: id,
        status: body.status,
        receiverName: body.receiverName,
        receiverPhone: body.receiverPhone,
        identityNote: body.identityNote,
        proofImageUrl: body.proofImageUrl,
        trackingCode: body.trackingCode,
        staffId: user.sub,
      }),
    );
  }

  @Get(':id/delivery')
  @ApiGetDeliveryInfoDocs()
  getDeliveryInfo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getDeliveryInfo({ orderId: id }));
  }

  @Get(':id/warranty')
  @ApiGetWarrantyInfoDocs()
  getWarrantyInfo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getWarrantyInfo({ orderId: id }));
  }

  @Get(':id/production')
  @ApiGetProductionInfoDocs()
  getProductionInfo(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getProductionInfo({ orderId: id }));
  }

  @Post(':id/confirm-pickup')
  @Permissions(Permission.OrderWrite)
  @ApiConfirmPickupDocs()
  confirmPickup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { note?: string },
  ) {
    return this.call(() =>
      this.grpc!.confirmPickup({
        orderId: id,
        staffId: user.sub,
        note: body.note,
      }),
    );
  }

  @Get(':id/payment-status')
  @Public()
  getPaymentStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.grpc!.getPaymentStatus({ orderId: id }));
  }

  @Post(':id/payments/manual')
  @Permissions(Permission.OrderWrite)
  manualPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body()
    body: {
      paymentPhase: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.manualPayment({
        orderId: id,
        paymentPhase: body.paymentPhase,
        amount: body.amount,
        receivedBy: user.sub,
        paymentMethod: body.paymentMethod,
        reference: body.reference ?? '',
      }),
    );
  }

  @Post(':id/delivery/claim')
  @Permissions(Permission.OrderWrite)
  @ApiClaimDeliveryDocs()
  claimDelivery(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() _body: ClaimDeliveryDto,
  ) {
    return this.call(() =>
      this.grpc!.claimDelivery({ orderId: id, staffId: user.sub }),
    );
  }

  @Post(':id/delivery/payment-link')
  @Permissions(Permission.OrderWrite)
  @ApiGenerateDeliveryPaymentLinkDocs()
  generateDeliveryPaymentLink(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: GeneratePaymentLinkDto,
  ) {
    return this.call(() =>
      this.grpc!.generateDeliveryPaymentLink({
        orderId: id,
        staffId: user.sub,
        returnUrl: body.returnUrl ?? '',
        cancelUrl: body.cancelUrl ?? '',
      }),
    );
  }

  @Post(':id/skip-remaining-payment')
  @Permissions(Permission.OrderWrite)
  @ApiSkipRemainingPaymentDocs()
  skipRemainingPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: SkipRemainingPaymentDto,
  ) {
    return this.call(() =>
      this.grpc!.skipRemainingPayment({
        orderId: id,
        deliveryMethod: body.deliveryMethod,
      }),
    );
  }

  @Post('lookup')
  @Public()
  @ApiLookupOrderDocs()
  lookupOrder(@Body() body: OrderLookupDto) {
    return this.call(() =>
      this.grpc!.lookupOrder({ orderCode: body.orderCode }),
    );
  }

  @Patch(':id/cancel')
  @Permissions(Permission.OrderWrite)
  cancelOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('reason') reason: string,
  ) {
    return this.call(() =>
      this.grpc!.cancelOrder({ id, reason: reason ?? '' }),
    );
  }
}
