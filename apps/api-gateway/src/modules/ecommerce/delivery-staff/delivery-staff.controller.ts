import {
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { Permissions, Permission, CurrentUser } from '@app/common';
import type { JwtPayload } from '@app/common';
import { ApiGetMyCurrentDeliveryDocs } from './delivery-staff.swagger';

interface EcommerceGrpcService {
  getMyCurrentDelivery(data: { staffId: string }): Observable<unknown>;
}

@Controller('api/v1/delivery-staff')
export class DeliveryStaffController implements OnModuleInit {
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

  @Get('me/current-task')
  @Permissions(Permission.OrderRead)
  @ApiGetMyCurrentDeliveryDocs()
  async getMyCurrentDelivery(@CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.getMyCurrentDelivery({ staffId: user.sub }),
    );
  }
}
