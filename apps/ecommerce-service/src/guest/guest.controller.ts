import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GuestService } from './guest.service';

@Controller()
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @GrpcMethod('EcommerceService', 'CreateGuestSession')
  async createGuestSession(data: {
    fullName: string;
    phone: string;
    email: string;
    note?: string;
    staffId: string;
  }) {
    return this.guestService.createGuestSession(data);
  }

  @GrpcMethod('EcommerceService', 'CreateGuestOrder')
  async createGuestOrder(data: {
    guestCode: string;
    productId?: string;
    staffId: string;
  }) {
    return this.guestService.createGuestOrder(data);
  }

  @GrpcMethod('EcommerceService', 'GetGuestSession')
  async getGuestSession(data: { guestCode: string }) {
    return this.guestService.getGuestSession(data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestSubmitOrder')
  async guestSubmitOrder(data: { orderId: string; guestCode: string }) {
    return this.guestService.guestSubmitOrder(data.orderId, data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestUpdateEngravingConfig')
  async guestUpdateEngravingConfig(data: {
    engravingVersionId: string;
    guestCode: string;
    selectedMaterialId?: string;
    selectedGemstoneId?: string;
    ringSize?: string;
    ringStyle?: string;
    ringShape?: string;
    customizationConfig?: string;
    selectedBiometrics?: string;
  }) {
    return this.guestService.guestUpdateEngravingConfig(
      data.engravingVersionId,
      data.guestCode,
      data,
    );
  }

  @GrpcMethod('EcommerceService', 'GuestUpdateQrMemory')
  async guestUpdateQrMemory(data: {
    engravingId: string;
    guestCode: string;
    cardTitle?: string;
    greetingMessage?: string;
    recipientEmail?: string;
    cardThemeId?: string;
    customImages?: string;
    biometricDisplaySettings?: string;
  }) {
    return this.guestService.guestUpdateQrMemory(
      data.engravingId,
      data.guestCode,
      data,
    );
  }

  @GrpcMethod('EcommerceService', 'GuestGetOrder')
  async guestGetOrder(data: { orderId: string; guestCode: string }) {
    return this.guestService.guestGetOrder(data.orderId, data.guestCode);
  }

  @GrpcMethod('EcommerceService', 'GuestInitiatePayment')
  async guestInitiatePayment(data: {
    orderId: string;
    guestCode: string;
    paymentPhase: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    return this.guestService.guestInitiatePayment(
      data.orderId,
      data.guestCode,
      {
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
      },
    );
  }

  @GrpcMethod('EcommerceService', 'GuestSetShippingInfo')
  async guestSetShippingInfo(data: {
    orderId: string;
    guestCode: string;
    deliveryMethod: string;
    recipientName: string;
    recipientPhone: string;
    addressId?: string;
    shippingAddressText?: string;
  }) {
    return this.guestService.guestSetShippingInfo(
      data.orderId,
      data.guestCode,
      {
        deliveryMethod: data.deliveryMethod,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        addressId: data.addressId,
        shippingAddressText: data.shippingAddressText,
      },
    );
  }

  @GrpcMethod('EcommerceService', 'ListGuestCustomers')
  async listGuestCustomers(data: { page: number; limit: number; search?: string }) {
    return this.guestService.listGuestCustomers(data);
  }
}
