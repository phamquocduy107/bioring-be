export type InvoiceKind = 'payment' | 'final';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoicePaymentRow {
  phase: string;
  phaseLabel: string;
  amount: number;
  method: string;
  paidAt: string;
  paymentCode: string;
}

export interface PaymentPlanStep {
  phase: string;
  label: string;
  /** 1-based */
  stepIndex: number;
  totalSteps: number;
  status: 'paid' | 'current' | 'pending';
  amountPaid?: number;
}

export interface InvoiceData {
  kind: InvoiceKind;
  invoiceNumber: string;
  issuedAt: string;
  orderCode: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productName: string;
  packageType?: string;
  captureRoute?: string;
  /** Lịch thanh toán theo gói (số lần cọc) */
  paymentPlan: PaymentPlanStep[];
  paymentPlanSummary: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  serviceFee: number;
  extraFee: number;
  discountAmount: number;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  highlightPayment?: InvoicePaymentRow;
  payments: InvoicePaymentRow[];
  companyName: string;
  companyAddress: string;
  companyTaxCode: string;
  companyEmail: string;
  companyPhone: string;
}

export const PAYMENT_PHASE_LABELS: Record<string, string> = {
  DEPOSIT_1: 'Cọc 1 — Phí IoT / capture',
  DEPOSIT_2: 'Cọc 2 — Đặt cọc sản xuất',
  REMAINING: 'Thanh toán phần còn lại',
  FULL: 'Thanh toán toàn bộ',
};

/**
 * Lịch thanh toán theo gói / capture route:
 * - ONLINE (SW): DEPOSIT_2 + REMAINING (2 lần)
 * - OFFLINE (có FP/HB…): DEPOSIT_1 + DEPOSIT_2 + REMAINING (3 lần)
 * - FULL (POS): 1 lần
 */
export function resolveExpectedPaymentPhases(opts: {
  captureRoute?: string | null;
  packageType?: string | null;
  currentPhase?: string | null;
}): string[] {
  if (opts.currentPhase === 'FULL') return ['FULL'];

  const route =
    opts.captureRoute?.toUpperCase() ||
    (opts.packageType === 'SW' ? 'ONLINE' : 'OFFLINE');

  if (route === 'ONLINE') return ['DEPOSIT_2', 'REMAINING'];
  return ['DEPOSIT_1', 'DEPOSIT_2', 'REMAINING'];
}

export function buildPaymentPlan(opts: {
  captureRoute?: string | null;
  packageType?: string | null;
  currentPhase?: string | null;
  paidByPhase: Record<string, number>;
}): PaymentPlanStep[] {
  const phases = resolveExpectedPaymentPhases(opts);
  const totalSteps = phases.length;

  return phases.map((phase, i) => {
    const paid = opts.paidByPhase[phase] ?? 0;
    let status: PaymentPlanStep['status'] = 'pending';
    if (paid > 0) status = 'paid';
    else if (opts.currentPhase === phase) status = 'current';

    return {
      phase,
      label: PAYMENT_PHASE_LABELS[phase] ?? phase,
      stepIndex: i + 1,
      totalSteps,
      status,
      amountPaid: paid > 0 ? paid : undefined,
    };
  });
}

export function summarizePaymentPlan(
  plan: PaymentPlanStep[],
  packageType?: string,
): string {
  const total = plan[0]?.totalSteps ?? plan.length;
  const pkg = packageType ? `Gói ${packageType}` : 'Gói hiện tại';
  const current = plan.find((s) => s.status === 'current');
  const paidCount = plan.filter((s) => s.status === 'paid').length;

  if (current) {
    return `${pkg} · ${total} lần thanh toán · đang ở lần ${current.stepIndex}/${total} (${current.label})`;
  }
  if (paidCount >= total && total > 0) {
    return `${pkg} · ${total} lần thanh toán · đã hoàn tất ${paidCount}/${total}`;
  }
  return `${pkg} · lịch ${total} lần thanh toán`;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

export function formatInvoiceDate(date: Date = new Date()): string {
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
