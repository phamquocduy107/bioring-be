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
import {
  Permissions,
  Permission,
  ListCustomersQueryDto,
  ListGuestCustomersQueryDto,
} from '@app/common';
import {
  ApiListCustomersDocs,
  ApiListGuestCustomersDocs,
} from './customer.swagger';

interface EcommerceGrpcService {
  lookupCustomer(data: { email: string }): Observable<unknown>;
  listCustomers(data: Record<string, unknown>): Observable<unknown>;
  listGuestCustomers(data: Record<string, unknown>): Observable<unknown>;
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

  @Get()
  @Permissions(Permission.UserRead)
  @ApiListCustomersDocs()
  async listCustomers(@Query() query: ListCustomersQueryDto) {
    return this.call(() =>
      this.grpc!.listCustomers({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search ?? '',
        status: query.status ?? '',
        sort_by: query.sort_by ?? '',
        sort_order: query.sort_order ?? '',
      }),
    );
  }

  @Get('guest')
  @Permissions(Permission.UserRead)
  @ApiListGuestCustomersDocs()
  async listGuestCustomers(@Query() query: ListGuestCustomersQueryDto) {
    return this.call(() =>
      this.grpc!.listGuestCustomers({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search ?? '',
      }),
    );
  }
}
