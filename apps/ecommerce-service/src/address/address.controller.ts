import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AddressService } from './address.service';

@Controller()
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @GrpcMethod('EcommerceService', 'ListAddresses')
  async listAddresses(data: { userId: string }) {
    const addresses = await this.addressService.list(data.userId);
    return { addresses };
  }

  @GrpcMethod('EcommerceService', 'CreateAddress')
  async createAddress(data: {
    userId: string;
    recipientName: string;
    phone: string;
    fullAddress: string;
    ward?: string;
    district?: string;
    province?: string;
    isDefault?: boolean;
  }) {
    const address = await this.addressService.create(data.userId, {
      recipientName: data.recipientName,
      phone: data.phone,
      fullAddress: data.fullAddress,
      ward: data.ward,
      district: data.district,
      province: data.province,
      isDefault: data.isDefault,
    });
    return { address };
  }

  @GrpcMethod('EcommerceService', 'UpdateAddress')
  async updateAddress(data: {
    id: string;
    userId: string;
    recipientName?: string;
    phone?: string;
    fullAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
    isDefault?: boolean;
  }) {
    const address = await this.addressService.update(data.id, data.userId, {
      recipientName: data.recipientName,
      phone: data.phone,
      fullAddress: data.fullAddress,
      ward: data.ward,
      district: data.district,
      province: data.province,
      isDefault: data.isDefault,
    });
    return { address };
  }

  @GrpcMethod('EcommerceService', 'DeleteAddress')
  async deleteAddress(data: { id: string; userId: string }) {
    return this.addressService.delete(data.id, data.userId);
  }
}
