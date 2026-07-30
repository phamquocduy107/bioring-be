export { EmailService } from './email.service';
export type { EmailAttachment, SendEmailParams } from './email.service';
export {
  templates,
  resolveEmailLogoUrl,
  EMAIL_LOGO_PLACEHOLDER,
  DEFAULT_EMAIL_LOGO_URL,
} from './templates';
export { NotificationModule } from './notification.module';
export { buildInvoicePdf } from './invoice-pdf';
export {
  formatInvoiceDate,
  formatVnd,
  PAYMENT_PHASE_LABELS,
  buildPaymentPlan,
  resolveExpectedPaymentPhases,
  summarizePaymentPlan,
} from './invoice.types';
export type {
  InvoiceData,
  InvoiceKind,
  InvoiceLineItem,
  InvoicePaymentRow,
  PaymentPlanStep,
} from './invoice.types';
