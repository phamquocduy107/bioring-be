import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@app/prisma';
import {
  buildInvoicePdf,
  buildPaymentPlan,
  formatInvoiceDate,
  PAYMENT_PHASE_LABELS,
  summarizePaymentPlan,
  type InvoiceData,
  type InvoiceKind,
  type InvoicePaymentRow,
} from '@app/common';

@Injectable()
export class InvoiceBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async build(params: {
    orderId: string;
    kind: InvoiceKind;
    paymentId?: string;
  }): Promise<{ data: InvoiceData; pdf: Buffer } | null> {
    const order = await this.prisma.orders.findUnique({
      where: { id: params.orderId },
      include: {
        users_orders_user_idTousers: {
          select: { email: true, full_name: true, phone: true },
        },
        guest_customers: {
          select: { email: true, full_name: true, phone: true },
        },
        engraving: {
          include: { products: { select: { name: true } } },
        },
        payments: {
          where: { status: 'PAID' },
          orderBy: { paid_at: 'asc' },
        },
      },
    });
    if (!order?.order_code) return null;

    const user = order.users_orders_user_idTousers;
    const guest = order.guest_customers;
    const email = user?.email ?? guest?.email;
    if (!email) return null;

    const customerName = user?.full_name ?? guest?.full_name ?? 'Khách hàng';
    const customerPhone = user?.phone ?? guest?.phone ?? undefined;
    const productName = order.engraving?.products?.name ?? 'Nhẫn Bioring';
    const totalPrice = Number(order.total_price ?? 0);
    const paidAmount = Number(order.paid_amount ?? 0);
    const remainingAmount = Number(order.remaining_amount ?? 0);
    const subtotal = Number(order.subtotal ?? totalPrice);
    const serviceFee = Number(order.service_fee ?? 0);
    const extraFee = Number(order.extra_fee ?? 0);
    const discountAmount = Number(order.discount_amount ?? 0);

    const payments: InvoicePaymentRow[] = order.payments.map((p) => ({
      phase: p.payment_phase ?? '',
      phaseLabel:
        PAYMENT_PHASE_LABELS[p.payment_phase ?? ''] ??
        p.payment_phase ??
        'Thanh toán',
      amount: Number(p.amount),
      method: p.method ?? '',
      paidAt: p.paid_at
        ? formatInvoiceDate(p.paid_at)
        : formatInvoiceDate(p.created_at ?? new Date()),
      paymentCode: p.payment_code ?? '',
    }));

    let highlightPayment: InvoicePaymentRow | undefined;
    if (params.paymentId) {
      const p = order.payments.find((x) => x.id === params.paymentId);
      if (p) {
        highlightPayment = {
          phase: p.payment_phase ?? '',
          phaseLabel:
            PAYMENT_PHASE_LABELS[p.payment_phase ?? ''] ??
            p.payment_phase ??
            'Thanh toán',
          amount: Number(p.amount),
          method: p.method ?? '',
          paidAt: p.paid_at
            ? formatInvoiceDate(p.paid_at)
            : formatInvoiceDate(),
          paymentCode: p.payment_code ?? '',
        };
      }
    } else if (params.kind === 'payment' && payments.length > 0) {
      highlightPayment = payments[payments.length - 1];
    }

    const paidByPhase: Record<string, number> = {};
    for (const p of order.payments) {
      const phase = p.payment_phase ?? '';
      if (!phase) continue;
      paidByPhase[phase] = (paidByPhase[phase] ?? 0) + Number(p.amount);
    }

    const paymentPlan = buildPaymentPlan({
      captureRoute: order.capture_route,
      packageType: order.package_type,
      currentPhase: highlightPayment?.phase,
      paidByPhase,
    });
    const paymentPlanSummary = summarizePaymentPlan(
      paymentPlan,
      order.package_type ?? undefined,
    );

    const issuedAt = formatInvoiceDate();
    const invoiceNumber =
      params.kind === 'final'
        ? `INV-FINAL-${order.order_code}`
        : `INV-${order.order_code}-${highlightPayment?.paymentCode || Date.now()}`;

    const lineItems = [
      {
        description: productName,
        quantity: 1,
        unitPrice: subtotal,
        amount: subtotal,
      },
    ];
    if (serviceFee > 0) {
      lineItems.push({
        description: 'Phí dịch vụ',
        quantity: 1,
        unitPrice: serviceFee,
        amount: serviceFee,
      });
    }
    if (extraFee > 0) {
      lineItems.push({
        description: 'Phí phát sinh',
        quantity: 1,
        unitPrice: extraFee,
        amount: extraFee,
      });
    }

    const data: InvoiceData = {
      kind: params.kind,
      invoiceNumber,
      issuedAt,
      orderCode: order.order_code,
      orderStatus: order.status ?? '',
      customerName,
      customerEmail: email,
      customerPhone,
      productName,
      packageType: order.package_type ?? undefined,
      captureRoute: order.capture_route ?? undefined,
      paymentPlan,
      paymentPlanSummary,
      lineItems,
      subtotal,
      serviceFee,
      extraFee,
      discountAmount,
      totalPrice,
      paidAmount,
      remainingAmount,
      highlightPayment,
      payments,
      companyName:
        this.config.get<string>('COMPANY_NAME') ?? 'Bioring Vietnam',
      companyAddress:
        this.config.get<string>('COMPANY_ADDRESS') ?? 'Việt Nam',
      companyTaxCode: this.config.get<string>('COMPANY_TAX_CODE') ?? '',
      companyEmail:
        this.config.get<string>('COMPANY_EMAIL') ??
        this.config.get<string>('SENDGRID_FROM_EMAIL') ??
        'noreply@bioring.vn',
      companyPhone: this.config.get<string>('COMPANY_PHONE') ?? '',
    };

    const pdf = await buildInvoicePdf(data);
    return { data, pdf };
  }
}
