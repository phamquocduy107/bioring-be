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
} from '@app/common';
import type { JwtPayload } from '@app/common';
import { ApiCreateGuestSessionDocs } from './guest.swagger';

interface GuestCustomerResponse {
  id: string;
  guestCode: string;
  fullName: string;
  phone: string;
  email: string;
  note: string;
  createdAt: string;
}

interface CreateGuestSessionResponse {
  guest: GuestCustomerResponse;
  isMember: boolean;
  isExistingGuest: boolean;
  message: string;
}

interface EcommerceGrpcService {
  createGuestSession(data: {
    fullName: string;
    phone: string;
    email: string;
    note?: string;
    staffId: string;
  }): Observable<CreateGuestSessionResponse>;
  createGuestEngraving(data: {
    guestCode: string;
    productId?: string;
    staffId: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    ringSize?: string;
    selectedBiometrics?: string;
  }): Observable<{ engraving: any; version: any }>;
  createGuestOrder(data: {
    guestCode: string;
    engravingId: string;
    staffId: string;
  }): Observable<unknown>;
}

@Controller('api/v1/guest-tablet')
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
}
