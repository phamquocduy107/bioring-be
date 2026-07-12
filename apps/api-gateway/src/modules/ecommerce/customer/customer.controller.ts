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
import { Permissions, Permission } from '@app/common';

interface EcommerceGrpcService {
  lookupCustomer(data: { email: string }): Observable<unknown>;
}

@Controller('api/v1/customers')
export class CustomerController implements OnModuleInit {
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

  @Get('lookup')
  @Permissions(Permission.OrderWrite)
  async lookup(@Query('email') email: string) {
    return this.call(() => this.grpc!.lookupCustomer({ email }));
  }
}
