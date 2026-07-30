import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EmailService, templates } from '@app/common';
import type { EmailTestTemplate } from './dto/send-test-email.dto';

@Injectable()
export class EmailTestService {
  constructor(private readonly emailService: EmailService) {}

  assertEnabled() {
    const enabled =
      process.env.ENABLE_EMAIL_TEST === 'true' ||
      process.env.NODE_ENV !== 'production';
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Email test endpoint disabled. Set ENABLE_EMAIL_TEST=true',
      );
    }
  }

  private buildHtml(
    template: EmailTestTemplate,
    fullName: string,
  ): { subject: string; html: string; type: string } {
    const orderCode = 'ORD-TEST-001';
    const paymentPlan = [
      {
        stepIndex: 1,
        totalSteps: 3,
        label: 'Cọc 1 — Phí IoT / capture',
        status: 'paid' as const,
        amountPaid: 10_000,
      },
      {
        stepIndex: 2,
        totalSteps: 3,
        label: 'Cọc 2 — Đặt cọc sản xuất',
        status: 'current' as const,
        amountPaid: 2_580_000,
      },
      {
        stepIndex: 3,
        totalSteps: 3,
        label: 'Thanh toán phần còn lại',
        status: 'pending' as const,
      },
    ];
    const invoiceCommon = {
      fullName,
      orderCode,
      invoiceNumber: `INV-${orderCode}-TEST`,
      issuedAt: new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      productName: 'Nhẫn Classic Solitaire',
      packageType: 'SW_FP',
      paymentPlanSummary:
        'Gói SW_FP · 3 lần thanh toán · đang ở lần 2/3 (Cọc 2 — Đặt cọc sản xuất)',
      paymentPlan,
      highlightStepLabel: 'Lần 2/3',
      subtotal: 8_500_000,
      serviceFee: 200_000,
      extraFee: 0,
      discountAmount: 100_000,
      totalPrice: 8_600_000,
      paidAmount: 2_590_000,
      remainingAmount: 6_010_000,
      companyName: process.env.COMPANY_NAME ?? 'Bioring Vietnam',
      companyTaxCode: process.env.COMPANY_TAX_CODE ?? '0123456789',
    };

    switch (template) {
      case 'orderApproved':
        return {
          type: 'dev.order.approved',
          subject: '[TEST] Đơn hàng đã được duyệt',
          html: templates.orderApproved({ orderCode, fullName }),
        };
      case 'orderRejected':
        return {
          type: 'dev.order.rejected',
          subject: '[TEST] Đơn hàng cần chỉnh sửa',
          html: templates.orderRejected({
            orderCode,
            fullName,
            note: 'Đây là email test — ghi chú mẫu từ Manager.',
          }),
        };
      case 'paymentConfirmed':
        return {
          type: 'dev.payment.confirmed',
          subject: '[TEST] Thanh toán thành công',
          html: templates.paymentConfirmed({ orderCode, fullName }),
        };
      case 'invoicePayment':
        return {
          type: 'dev.invoice.payment',
          subject: '[TEST] Biên lai thanh toán Bioring',
          html: templates.invoicePayment({
            ...invoiceCommon,
            kind: 'payment',
            highlightLabel: 'Cọc 2 — Đặt cọc sản xuất',
            highlightAmount: 2_580_000,
            highlightMethod: 'PAYOS',
          }),
        };
      case 'invoiceFinal':
        return {
          type: 'dev.invoice.final',
          subject: '[TEST] Hóa đơn / biên lai tổng kết Bioring',
          html: templates.invoiceFinal({
            ...invoiceCommon,
            kind: 'final',
            paidAmount: 8_600_000,
            remainingAmount: 0,
            invoiceNumber: `INV-FINAL-${orderCode}`,
            paymentPlanSummary: 'Gói SW_FP · 3 lần thanh toán · đã hoàn tất 3/3',
            paymentPlan: [
              {
                stepIndex: 1,
                totalSteps: 3,
                label: 'Cọc 1 — Phí IoT / capture',
                status: 'paid',
                amountPaid: 10_000,
              },
              {
                stepIndex: 2,
                totalSteps: 3,
                label: 'Cọc 2 — Đặt cọc sản xuất',
                status: 'paid',
                amountPaid: 2_580_000,
              },
              {
                stepIndex: 3,
                totalSteps: 3,
                label: 'Thanh toán phần còn lại',
                status: 'paid',
                amountPaid: 6_010_000,
              },
            ],
            highlightStepLabel: undefined,
          }),
        };
      case 'productionStarted':
        return {
          type: 'dev.production.started',
          subject: '[TEST] Đơn hàng đang sản xuất',
          html: templates.productionStarted({ orderCode, fullName }),
        };
      case 'readyForDelivery':
        return {
          type: 'dev.ready.for.delivery',
          subject: '[TEST] Đơn hàng sẵn sàng giao',
          html: templates.readyForDelivery({ orderCode, fullName }),
        };
      case 'orderDelivered':
        return {
          type: 'dev.order.delivered',
          subject: '[TEST] Đơn hàng đã giao thành công',
          html: templates.orderDelivered({ orderCode, fullName }),
        };
      default:
        throw new BadRequestException(`Unknown template: ${template}`);
    }
  }

  async sendTest(to: string, template: EmailTestTemplate, fullName?: string) {
    this.assertEnabled();
    const name = fullName?.trim() || 'Khách test';
    const built = this.buildHtml(template, name);
    const emailId = await this.emailService.send({
      to,
      type: built.type,
      subject: built.subject,
      html: built.html,
    });
    if (!emailId) {
      throw new ServiceUnavailableException(
        'Send failed — check SENDGRID_API_KEY / SENDGRID_FROM_EMAIL',
      );
    }
    return { emailId, to, template, subject: built.subject };
  }
}
