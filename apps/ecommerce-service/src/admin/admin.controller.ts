import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AdminService } from './admin.service';

@Controller()
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @GrpcMethod('EcommerceService', 'GetDashboardSummary')
  async getSummary() {
    return this.service.getSummary();
  }

  @GrpcMethod('EcommerceService', 'GetOrdersByStatus')
  async getOrdersByStatus() {
    return this.service.getOrdersByStatus();
  }

  @GrpcMethod('EcommerceService', 'GetRevenueTimeline')
  async getRevenueTimeline(data: { days?: number }) {
    return this.service.getRevenueTimeline(data.days ?? 7);
  }

  @GrpcMethod('EcommerceService', 'GetTopProducts')
  async getTopProducts(data: { limit?: number }) {
    return this.service.getTopProducts(data.limit ?? 10);
  }

  @GrpcMethod('EcommerceService', 'GetMonthlyGrowth')
  async getMonthlyGrowth(data: { months?: number }) {
    return this.service.getMonthlyGrowth(data.months ?? 12);
  }
}
