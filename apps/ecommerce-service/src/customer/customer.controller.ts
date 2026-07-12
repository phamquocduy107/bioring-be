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
}
