import {
  Controller,
  Post,
  Body,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import {
  CurrentUser,
  Permissions,
  Permission,
  CreateGuestSessionDto,
  CreateGuestOrderDto,
} from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateGuestSessionDocs,
  ApiCreateGuestOrderDocs,
} from './guest.swagger';

interface GuestCustomerResponse {
  id: string;
  guestCode: string;
  fullName: string;
  phone: string;
  email: string;
  note: string;
  createdAt: string;
}

interface GuestOrderResponse {
  order: {
    id: string;
    orderCode: string;
    userId: string;
    guestCustomerId: string;
    designSource: string;
    status: string;
    totalPrice: number;
    paidAmount: number;
    remainingAmount: number;
    createdAt: string;
  };
  engraving: {
    id: string;
    userId: string;
    productId: string;
    status: string;
  };
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

interface EcommerceGrpcService {
  createGuestSession(data: {
    fullName: string;
    phone: string;
    email?: string;
    note?: string;
    staffId: string;
  }): Observable<{ guest: GuestCustomerResponse }>;
  createGuestOrder(data: {
    guestCustomerId: string;
    productId?: string;
    staffId: string;
  }): Observable<GuestOrderResponse>;
}

@Controller('api/v1/guest')
export class GuestController implements OnModuleInit {
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

  @Post('sessions')
  @ApiCreateGuestSessionDocs()
  @Permissions(Permission.OrderWrite)
  async createSession(
    @Body() dto: CreateGuestSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.createGuestSession({
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        note: dto.note,
        staffId: user.sub,
      }),
    );
  }

  @Post('orders')
  @ApiCreateGuestOrderDocs()
  @Permissions(Permission.OrderWrite)
  async createOrder(
    @Body() dto: CreateGuestOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.createGuestOrder({
        guestCustomerId: dto.guestCustomerId,
        productId: dto.productId,
        staffId: user.sub,
      }),
    );
  }
}
