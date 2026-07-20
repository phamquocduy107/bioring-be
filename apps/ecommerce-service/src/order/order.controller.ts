import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @GrpcMethod('EcommerceService', 'CreateOrder')
  async createOrder(data: { engravingId: string; userId: string }) {
    return this.orderService.createOrder(data.engravingId, data.userId);
  }

  @GrpcMethod('EcommerceService', 'SubmitOrder')
  async submitOrder(data: { id: string }) {
    return this.orderService.submitOrder(data.id);
  }

  @GrpcMethod('EcommerceService', 'AttachBiometric')
  async attachBiometric(data: {
    engravingId: string;
    biometricType: string;
    rawFileUrl: string;
    extraData?: string;
  }) {
    return this.orderService.attachBiometric(
      data.engravingId,
      data.biometricType,
      data.rawFileUrl,
      data.extraData,
    );
  }

  @GrpcMethod('EcommerceService', 'AttachBiometricsBulk')
  async attachBiometricsBulk(data: {
    engravingId: string;
    biometrics: Array<{ biometricType: string; rawFileUrl: string; extraData?: string }>;
  }) {
    return this.orderService.attachBiometricsBulk(data.engravingId, data.biometrics);
  }

  @GrpcMethod('EcommerceService', 'GetOrder')
  async getOrder(data: { id: string }) {
    return this.orderService.getOrder(data.id);
  }

  @GrpcMethod('EcommerceService', 'GetMyOrders')
  async getMyOrders(data: { page?: number; limit?: number; userId?: string }) {
    return this.orderService.getMyOrders(
      data.userId ?? '',
      data.page ?? 1,
      data.limit ?? 10,
    );
  }

  @GrpcMethod('EcommerceService', 'ReviewOrder')
  async reviewOrder(data: {
    id: string;
    action: string;
    note: string;
    managerId: string;
  }) {
    return this.orderService.reviewOrder(
      data.id,
      data.action,
      data.note,
      data.managerId,
    );
  }

  @GrpcMethod('EcommerceService', 'InitiatePayment')
  async initiatePayment(data: {
    orderId: string;
    paymentPhase: string;
    returnUrl?: string;
    cancelUrl?: string;
    userId?: string;
  }) {
    return this.orderService.initiatePayment(
      data.orderId,
      data.paymentPhase,
      data.returnUrl ?? '',
      data.cancelUrl ?? '',
      data.userId ?? '',
    );
  }

  @GrpcMethod('EcommerceService', 'HandlePayOSWebhook')
  async handlePayOSWebhook(data: { webhookBody: string }) {
    return this.orderService.handlePayOSWebhook(data);
  }

  @GrpcMethod('EcommerceService', 'CancelPayment')
  async cancelPayment(data: { orderId: string; userId: string }) {
    const result = await this.orderService.cancelPayment(
      data.orderId,
      data.userId,
    );
    return { success: result.success, orderCode: result.orderCode };
  }

  @GrpcMethod('EcommerceService', 'AssignJeweler')
  async assignJeweler(data: { orderId: string; jewelerId: string }) {
    return this.orderService.assignJeweler(data.orderId, data.jewelerId);
  }

  @GrpcMethod('EcommerceService', 'UpdateProductionStatus')
  async updateProductionStatus(data: {
    taskId: string;
    status: string;
    note: string;
  }) {
    return this.orderService.updateProductionStatus(
      data.taskId,
      data.status,
      data.note,
    );
  }

  @GrpcMethod('EcommerceService', 'GetProductionTasks')
  async getProductionTasks(data: {
    page?: number;
    limit?: number;
    status?: string;
    orderId?: string;
    jewelerId?: string;
  }) {
    return this.orderService.getProductionTasks(data);
  }

  // ===== MF-05: Delivery, Pickup & QR Memory =====

  @GrpcMethod('EcommerceService', 'QcAcceptOrder')
  async qcAcceptOrder(data: {
    orderId: string;
    result: string;
    checklist?: string;
    proofImages?: string[];
    note?: string;
    managerId: string;
  }) {
    return this.orderService.qcAcceptOrder(
      data.orderId,
      data.result,
      data.checklist,
      data.proofImages,
      data.note,
      data.managerId,
    );
  }

  @GrpcMethod('EcommerceService', 'InitiateDelivery')
  async initiateDelivery(data: {
    orderId: string;
    deliveryMethod: string;
    recipientName: string;
    recipientPhone: string;
    addressId?: string;
    shippingAddressText?: string;
    assignedDeliveryStaffId?: string;
    managerId: string;
  }) {
    return this.orderService.initiateDelivery(data);
  }

  @GrpcMethod('EcommerceService', 'UpdateShipmentStatus')
  async updateShipmentStatus(data: {
    orderId: string;
    status: string;
    receiverName?: string;
    receiverPhone?: string;
    identityNote?: string;
    proofImageUrl?: string;
    trackingCode?: string;
    staffId: string;
  }) {
    return this.orderService.updateShipmentStatus(data);
  }

  @GrpcMethod('EcommerceService', 'SaveDeliveryPreference')
  async saveDeliveryPreference(data: {
    orderId: string;
    addressId: string;
    method: string;
  }) {
    return this.orderService.saveDeliveryPreference(
      data.orderId, data.addressId, data.method,
    );
  }

  @GrpcMethod('EcommerceService', 'GetDeliveryInfo')
  async getDeliveryInfo(data: { orderId: string }) {
    return this.orderService.getDeliveryInfo(data.orderId);
  }

  @GrpcMethod('EcommerceService', 'GetWarrantyInfo')
  async getWarrantyInfo(data: { orderId: string }) {
    return this.orderService.getWarrantyInfo(data.orderId);
  }

  @GrpcMethod('EcommerceService', 'GetProductionInfo')
  async getProductionInfo(data: { orderId: string }) {
    return this.orderService.getProductionInfo(data.orderId);
  }

  @GrpcMethod('EcommerceService', 'LookupOrder')
  async lookupOrder(data: { orderCode: string }) {
    return this.orderService.lookupOrder(data.orderCode);
  }

  @GrpcMethod('EcommerceService', 'CancelOrder')
  async cancelOrder(data: { id: string; reason: string }) {
    return this.orderService.cancelOrder(data.id, data.reason);
  }

  @GrpcMethod('EcommerceService', 'ConfirmPickup')
  async confirmPickup(data: { orderId: string; staffId: string; note?: string }) {
    return this.orderService.confirmPickup(data.orderId, data.staffId, data.note);
  }

  @GrpcMethod('EcommerceService', 'ManualPayment')
  async manualPayment(data: {
    orderId: string;
    paymentPhase: string;
    amount: number;
    receivedBy: string;
    paymentMethod: string;
    reference?: string;
  }) {
    return this.orderService.manualPayment(data.orderId, data);
  }

  @GrpcMethod('EcommerceService', 'GetPaymentStatus')
  async getPaymentStatus(data: { orderId: string }) {
    return this.orderService.getPaymentStatus(data.orderId);
  }

  @GrpcMethod('EcommerceService', 'ListPayments')
  async listPayments(data: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
  }) {
    return this.orderService.listPayments(data);
  }

  @GrpcMethod('EcommerceService', 'GetTransactionOverview')
  async getTransactionOverview() {
    return this.orderService.getTransactionOverview();
  }

  @GrpcMethod('EcommerceService', 'ListDeliveries')
  async listDeliveries(data: {
    page: number;
    limit: number;
    status?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
  }) {
    return this.orderService.listDeliveries(data);
  }

  // ===== Finance Mutations =====

  @GrpcMethod('EcommerceService', 'ForcePaidPayment')
  async forcePaidPayment(data: { paymentId: string; adminId: string }) {
    return this.orderService.forcePaidPayment(data.paymentId, data.adminId);
  }

  @GrpcMethod('EcommerceService', 'SyncPaymentStatus')
  async syncPaymentStatus(data: { paymentId: string }) {
    return this.orderService.syncPaymentStatus(data.paymentId);
  }

  @GrpcMethod('EcommerceService', 'RefundPayment')
  async refundPayment(data: { paymentId: string; adminId: string; reason: string }) {
    return this.orderService.refundPayment(data.paymentId, data.adminId, data.reason);
  }

  @GrpcMethod('EcommerceService', 'UpdateShippingFee')
  async updateShippingFee(data: { paymentId: string; amount: number }) {
    return this.orderService.updateShippingFee(data.paymentId, data.amount);
  }

  @GrpcMethod('EcommerceService', 'ListPickups')
  async listPickups(data: { limit?: number; status?: string; search?: string }) {
    return this.orderService.listPickups(data);
  }
}
