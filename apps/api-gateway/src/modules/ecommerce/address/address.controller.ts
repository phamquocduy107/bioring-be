import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import { CurrentUser, CreateAddressDto, UpdateAddressDto } from '@app/common';
import type { JwtPayload } from '@app/common';
import {
  ApiCreateAddressDocs,
  ApiUpdateAddressDocs,
  ApiDeleteAddressDocs,
  ApiListAddressesDocs,
} from './address.swagger';

interface EcommerceGrpcService {
  listAddresses(data: { userId: string }): Observable<{ addresses: any[] }>;
  createAddress(data: {
    userId: string;
    recipientName: string;
    phone: string;
    fullAddress: string;
    ward?: string;
    district?: string;
    province?: string;
    isDefault?: boolean;
  }): Observable<{ address: any }>;
  updateAddress(data: {
    id: string;
    userId: string;
    recipientName?: string;
    phone?: string;
    fullAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
    isDefault?: boolean;
  }): Observable<{ address: any }>;
  deleteAddress(data: {
    id: string;
    userId: string;
  }): Observable<{ success: boolean }>;
}

@Controller('api/v1/addresses')
export class AddressController implements OnModuleInit {
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
  @ApiListAddressesDocs()
  list(@CurrentUser() user: JwtPayload) {
    return this.call(() => this.grpc!.listAddresses({ userId: user.sub }));
  }

  @Post()
  @ApiCreateAddressDocs()
  create(@Body() body: CreateAddressDto, @CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.createAddress({
        userId: user.sub,
        recipientName: body.recipientName,
        phone: body.phone,
        fullAddress: body.fullAddress,
        ward: body.ward,
        district: body.district,
        province: body.province,
        isDefault: body.isDefault,
      }),
    );
  }

  @Put(':id')
  @ApiUpdateAddressDocs()
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAddressDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.updateAddress({
        id,
        userId: user.sub,
        recipientName: body.recipientName,
        phone: body.phone,
        fullAddress: body.fullAddress,
        ward: body.ward,
        district: body.district,
        province: body.province,
        isDefault: body.isDefault,
      }),
    );
  }

  @Delete(':id')
  @ApiDeleteAddressDocs()
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() => this.grpc!.deleteAddress({ id, userId: user.sub }));
  }
}
