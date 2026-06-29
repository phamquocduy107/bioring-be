import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @GrpcMethod('EcommerceService', 'CreateOrder')
  async createOrder(data: { engravingIds: string[]; userId: string }) {
    return this.orderService.createOrder(data.engravingIds, data.userId);
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
    engravingIds?: string[];
  }) {
    return this.orderService.reviewOrder(
      data.id,
      data.action,
      data.note,
      data.managerId,
      data.engravingIds ?? [],
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
  async handlePayOSWebhook(data: {
    webhookBody: string;
  }) {
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
}
