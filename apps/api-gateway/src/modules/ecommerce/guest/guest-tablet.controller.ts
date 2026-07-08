import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { Public } from '@app/common';
import {
  ApiGetGuestSessionDocs,
  ApiGuestUpdateConfigDocs,
  ApiGuestSubmitOrderDocs,
  ApiGuestGetOrderDocs,
  ApiGuestInitiatePaymentDocs,
  ApiGuestUpdateQrMemoryDocs,
  ApiGuestSetShippingInfoDocs,
} from './guest-tablet.swagger';

interface GuestSessionResponse {
  guest: {
    id: string;
    guestCode: string;
    fullName: string;
    phone: string;
    email: string;
    note: string;
    createdAt: string;
  };
  order: unknown;
}

interface VersionUpdateResponse {
  version: {
    id: string;
    engravingId: string;
    versionNumber: number;
    selectedMaterialId: string;
    selectedGemstoneId: string;
    ringSize: string;
    ringStyle: string;
    ringShape: string;
    customizationConfig: string;
    selectedBiometrics: string;
    status: string;
    createdAt: string;
  };
}

interface SubmitOrderResponse {
  order: {
    id: string;
    orderCode: string;
    status: string;
    userId: string;
    guestCustomerId: string;
    designSource: string;
    totalPrice: number;
    paidAmount: number;
    remainingAmount: number;
    createdAt: string;
  };
  isResubmit: boolean;
}

interface PaymentResponse {
  payment: {
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
  };
  paymentUrl: string;
}

interface QrMemoryResponse {
  qrMemory: {
    id: string;
    engravingId: string;
    qrCode: string;
    cardTitle: string;
    greetingMessage: string;
    recipientEmail: string;
    biometricDisplaySettings: string;
    isLocked: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface ShippingInfoResponse {
  id: string;
  orderId: string;
  deliveryMethod: string;
  status: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddressText: string;
}

interface EcommerceGrpcService {
  getGuestSession(data: {
    guestCode: string;
  }): Observable<GuestSessionResponse>;
  guestUpdateEngravingConfig(
    data: Record<string, unknown>,
  ): Observable<VersionUpdateResponse>;
  guestSubmitOrder(data: {
    orderId: string;
    guestCode: string;
  }): Observable<SubmitOrderResponse>;
  guestGetOrder(data: {
    orderId: string;
    guestCode: string;
  }): Observable<unknown>;
  guestInitiatePayment(
    data: Record<string, unknown>,
  ): Observable<PaymentResponse>;
  guestUpdateQrMemory(
    data: Record<string, unknown>,
  ): Observable<QrMemoryResponse>;
  guestSetShippingInfo(
    data: Record<string, unknown>,
  ): Observable<ShippingInfoResponse>;
}

@Controller('api/v1/guest-tablet')
export class GuestTabletController implements OnModuleInit {
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

  @Get('sessions/:guestCode')
  @Public()
  @ApiGetGuestSessionDocs()
  async getSession(@Param('guestCode') guestCode: string) {
    return this.call(() => this.grpc!.getGuestSession({ guestCode }));
  }

  @Patch('engravings/:versionId/config')
  @Public()
  @ApiGuestUpdateConfigDocs()
  async updateConfig(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Query('guestCode') guestCode: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.call(() =>
      this.grpc!.guestUpdateEngravingConfig({
        engravingVersionId: versionId,
        guestCode,
        ...body,
      }),
    );
  }

  @Patch('orders/:orderId/submit')
  @Public()
  @ApiGuestSubmitOrderDocs()
  async submitOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body('guestCode') guestCode: string,
  ) {
    return this.call(() => this.grpc!.guestSubmitOrder({ orderId, guestCode }));
  }

  @Get('orders/:orderId')
  @Public()
  @ApiGuestGetOrderDocs()
  async getOrder(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Query('guestCode') guestCode: string,
  ) {
    return this.call(() => this.grpc!.guestGetOrder({ orderId, guestCode }));
  }

  @Post('orders/:orderId/payments')
  @Public()
  @ApiGuestInitiatePaymentDocs()
  async initiatePayment(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: { guestCode: string; returnUrl?: string; cancelUrl?: string },
  ) {
    return this.call(() =>
      this.grpc!.guestInitiatePayment({
        orderId,
        guestCode: body.guestCode,
        paymentPhase: 'FULL',
        returnUrl: body.returnUrl ?? '',
        cancelUrl: body.cancelUrl ?? '',
      }),
    );
  }

  @Put('qr-memories/:engravingId')
  @Public()
  @ApiGuestUpdateQrMemoryDocs()
  async updateQrMemory(
    @Param('engravingId', new ParseUUIDPipe({ version: '4' }))
    engravingId: string,
    @Body()
    body: {
      guestCode: string;
      cardTitle?: string;
      greetingMessage?: string;
      recipientEmail?: string;
      cardThemeId?: string;
      customImages?: string;
      biometricDisplaySettings?: string;
    },
  ) {
    return this.call(() =>
      this.grpc!.guestUpdateQrMemory({
        engravingId,
        guestCode: body.guestCode,
        cardTitle: body.cardTitle,
        greetingMessage: body.greetingMessage,
        recipientEmail: body.recipientEmail,
        cardThemeId: body.cardThemeId,
        customImages: body.customImages,
        biometricDisplaySettings: body.biometricDisplaySettings,
      }),
    );
  }

  @Post('orders/:orderId/shipping-info')
  @Public()
  @ApiGuestSetShippingInfoDocs()
  async setShippingInfo(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body()
    body: {
      guestCode: string;
      deliveryMethod: string;
      recipientName: string;
      recipientPhone: string;
      addressId?: string;
      shippingAddressText?: string;
    },
  ) {
    return this.call(() =>
      this.grpc!.guestSetShippingInfo({
        orderId,
        guestCode: body.guestCode,
        deliveryMethod: body.deliveryMethod,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        addressId: body.addressId,
        shippingAddressText: body.shippingAddressText,
      }),
    );
  }
}
