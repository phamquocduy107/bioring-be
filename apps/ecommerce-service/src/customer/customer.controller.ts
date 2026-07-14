import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CustomerService } from './customer.service';

@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @GrpcMethod('EcommerceService', 'LookupCustomer')
  async lookupCustomer(data: { email: string }) {
    return this.customerService.lookupCustomer(data.email);
  }

  @GrpcMethod('EcommerceService', 'ListCustomers')
  async listCustomers(data: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort_by?: string;
    sort_order?: string;
  }) {
    return this.customerService.listCustomers({
      page: data.page ?? 1,
      limit: data.limit ?? 20,
      search: data.search,
      status: data.status,
      sort_by: data.sort_by,
      sort_order: data.sort_order,
    });
  }
}
