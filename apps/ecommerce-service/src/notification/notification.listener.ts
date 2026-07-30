import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService, templates } from '@app/common';
import { PrismaService } from '@app/prisma';
import { InvoiceBuilder } from './invoice.builder';

interface CustomerInfo {
  email: string;
  fullName: string;
  orderCode: string;
}

/**
 * Customer emails (chỉ các case sau):
 * - order.approved / order.rejected (review thiết kế)
 * - payment.confirmed (DEPOSIT_1 / DEPOSIT_2 / REMAINING / FULL) + PDF biên lai
 * - order.ready_for_delivery | pickup
 * - order.completed → hóa đơn cuối + PDF
 */
@Injectable()
export class NotificationListener {
  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly invoiceBuilder: InvoiceBuilder,
  ) {}

  private async getCustomerInfo(orderId: string): Promise<CustomerInfo | null> {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        order_code: true,
        users_orders_user_idTousers: {
          select: { email: true, full_name: true },
        },
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

  private async sendInvoiceEmail(params: {
    orderId: string;
    kind: 'payment' | 'final';
    paymentId?: string;
    type: string;
    subject?: string;
  }) {
    const built = await this.invoiceBuilder.build({
      orderId: params.orderId,
      kind: params.kind,
      paymentId: params.paymentId,
    });
    if (!built) return;

    const { data, pdf } = built;
    const currentStep = data.paymentPlan.find((s) => s.status === 'current');
    const highlightStepLabel = currentStep
      ? `Lần ${currentStep.stepIndex}/${currentStep.totalSteps}`
      : undefined;

    const common = {
      fullName: data.customerName,
      orderCode: data.orderCode,
      invoiceNumber: data.invoiceNumber,
      issuedAt: data.issuedAt,
      productName: data.productName,
      packageType: data.packageType,
      paymentPlanSummary: data.paymentPlanSummary,
      paymentPlan: data.paymentPlan.map((s) => ({
        stepIndex: s.stepIndex,
        totalSteps: s.totalSteps,
        label: s.label,
        status: s.status,
        amountPaid: s.amountPaid,
      })),
      highlightStepLabel,
      totalPrice: data.totalPrice,
      paidAmount: data.paidAmount,
      remainingAmount: data.remainingAmount,
      subtotal: data.subtotal,
      serviceFee: data.serviceFee,
      extraFee: data.extraFee,
      discountAmount: data.discountAmount,
      companyName: data.companyName,
      companyTaxCode: data.companyTaxCode,
    };

    const html =
      params.kind === 'final'
        ? templates.invoiceFinal({ ...common, kind: 'final' })
        : templates.invoicePayment({
            ...common,
            kind: 'payment',
            highlightLabel: data.highlightPayment?.phaseLabel,
            highlightAmount: data.highlightPayment?.amount,
            highlightMethod: data.highlightPayment?.method,
          });

    let subject = params.subject;
    if (!subject) {
      if (params.kind === 'final') {
        subject = `Hóa đơn tổng kết — ${data.orderCode}`;
      } else {
        const stepLabel = currentStep
          ? `lần ${currentStep.stepIndex}/${currentStep.totalSteps}`
          : 'thanh toán';
        const amount = data.highlightPayment?.amount;
        const amountLabel =
          amount != null
            ? ` ${Math.round(amount).toLocaleString('vi-VN')}₫`
            : '';
        subject = `Biên lai ${stepLabel}${amountLabel} — ${data.orderCode}`;
      }
    }

    await this.emailService.send({
      to: data.customerEmail,
      type: params.type,
      subject,
      html,
      orderId: params.orderId,
      attachments: [
        {
          content: pdf.toString('base64'),
          filename: `${data.invoiceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });
  }

  @OnEvent('order.approved')
  async handleOrderApproved(payload: { orderId: string }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      await this.emailService.send({
        to: info.email,
        type: 'order.approved',
        subject: 'Thiết kế đã được duyệt',
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
        subject: 'Thiết kế cần chỉnh sửa',
        html: templates.orderRejected({ ...info, note: payload.note }),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] order.rejected failed:', error);
    }
  }

  @OnEvent('payment.confirmed')
  async handlePaymentConfirmed(payload: {
    orderId: string;
    paymentId?: string;
    paymentPhase?: string;
  }) {
    try {
      await this.sendInvoiceEmail({
        orderId: payload.orderId,
        kind: 'payment',
        paymentId: payload.paymentId,
        type: 'invoice.payment',
      });
    } catch (error) {
      console.warn('[Notification] payment.confirmed invoice failed:', error);
    }
  }

  @OnEvent('order.ready_for_delivery')
  async handleReadyForDelivery(payload: {
    orderId: string;
    method?: 'DELIVERY' | 'PICKUP';
  }) {
    try {
      const info = await this.getCustomerInfo(payload.orderId);
      if (!info) return;
      const method = payload.method ?? 'DELIVERY';
      await this.emailService.send({
        to: info.email,
        type:
          method === 'PICKUP'
            ? 'order.ready_for_pickup'
            : 'order.ready_for_delivery',
        subject:
          method === 'PICKUP'
            ? 'Đơn hàng sẵn sàng nhận (pickup)'
            : 'Đơn hàng sẵn sàng giao',
        html: templates.readyForDelivery({ ...info, method }),
        orderId: payload.orderId,
      });
    } catch (error) {
      console.warn('[Notification] ready_for_delivery failed:', error);
    }
  }

  @OnEvent('order.completed')
  async handleOrderCompleted(payload: { orderId: string }) {
    try {
      await this.sendInvoiceEmail({
        orderId: payload.orderId,
        kind: 'final',
        type: 'invoice.final',
      });
    } catch (error) {
      console.warn('[Notification] order.completed invoice failed:', error);
    }
  }
}
