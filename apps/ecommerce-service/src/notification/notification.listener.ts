import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService, templates } from '@app/common';
import { PrismaService } from '@app/prisma';

interface CustomerInfo {
  email: string;
  fullName: string;
  orderCode: string;
}

@Injectable()
export class NotificationListener {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCustomerInfo(orderId: string): Promise<CustomerInfo | null> {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        order_code: true,
        users_orders_user_idTousers: { select: { email: true, full_name: true } },
        guest_customers: { select: { email: true, full_name: true } },
      },
    });
    if (!order?.order_code) return null;

    const user = order.users_orders_user_idTousers;
    const guest = order.guest_customers;
    const email = user?.email ?? guest?.email;
    if (!email) return null;

    return {
      email,
      fullName: user?.full_name ?? guest?.full_name ?? '',
      orderCode: order.order_code,
    };
  }

  @OnEvent('order.submitted')
  async handleOrderSubmitted(payload: { orderId: string }) {
    try {
      const order = await this.prisma.orders.findUnique({
        where: { id: payload.orderId },
        select: { order_code: true, engraving: { select: { user_id: true } } },
      });
      if (!order?.order_code) return;

      const managers = await this.prisma.user_roles.findMany({
        where: {
          roles: { name: { in: ['ADMIN', 'MANAGER'] } },
          users: { status: 'ACTIVE' },
        },
        include: { users: { select: { email: true, full_name: true } } },
      });

      for (const m of managers) {
        if (!m.users.email) continue;
        await this.emailService.send({
          to: m.users.email,
          type: 'order.submitted',
          subject: 'Đơn hàng mới cần duyệt',
          html: templates.orderSubmitted({
            orderCode: order.order_code,
            customerName: m.users.full_name ?? '',
          }),
          orderId: payload.orderId,
        });
      }
    } catch (error) {
      console.warn('[Notification] order.submitted failed:', error);
    }
  }

  @OnEvent('order.approved')
  async handleOrderApproved(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.approved',
        subject: 'Đơn hàng đã được duyệt',
        html: templates.orderApproved(info),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] order.approved failed:', error);
    }
  }

  @OnEvent('order.rejected')
  async handleOrderRejected(payload: { orderId: string; note?: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.rejected',
        subject: 'Đơn hàng cần chỉnh sửa',
        html: templates.orderRejected({ ...info, note: payload.note }),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] order.rejected failed:', error);
    }
  }

  @OnEvent('payment.confirmed')
  async handlePaymentConfirmed(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'payment.confirmed',
        subject: 'Thanh toán thành công',
        html: templates.paymentConfirmed(info),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] payment.confirmed failed:', error);
    }
  }

  @OnEvent('order.production_started')
  async handleProductionStarted(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.production_started',
        subject: 'Đơn hàng đang được sản xuất',
        html: templates.productionStarted(info),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] production_started failed:', error);
    }
  }

  @OnEvent('order.ready_for_delivery')
  async handleReadyForDelivery(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.ready_for_delivery',
        subject: 'Đơn hàng sẵn sàng giao',
        html: templates.readyForDelivery(info),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] ready_for_delivery failed:', error);
    }
  }

  @OnEvent('order.delivered')
  async handleOrderDelivered(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.delivered',
        subject: 'Đơn hàng đã giao thành công',
        html: templates.orderDelivered(info),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] order.delivered failed:', error);
    }
  }
}
