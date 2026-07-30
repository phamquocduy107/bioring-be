import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatInvoiceDate,
  formatVnd,
  type InvoiceData,
} from './invoice.types';

function resolveFont(file: string): string {
  const candidates = [
    join(process.cwd(), 'libs/common/src/notification/fonts', file),
    join(__dirname, 'fonts', file),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Invoice PDF font missing: ${file}. Expected under libs/common/src/notification/fonts/`,
    );
  }
  return found;
}

export function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      doc.registerFont('Noto', resolveFont('NotoSans-Regular.ttf'));
      doc.registerFont('NotoBold', resolveFont('NotoSans-Bold.ttf'));
    } catch (err) {
      reject(err);
      return;
    }

    const title =
      data.kind === 'final'
        ? 'HÓA ĐƠN / BIÊN LAI TỔNG KẾT'
        : 'BIÊN LAI THANH TOÁN ĐIỆN TỬ';

    doc
      .font('NotoBold')
      .fontSize(16)
      .fillColor('#8B4513')
      .text(data.companyName);
    doc
      .font('Noto')
      .fontSize(9)
      .fillColor('#444')
      .text(data.companyAddress)
      .text(`MST: ${data.companyTaxCode || '—'}`)
      .text(`Email: ${data.companyEmail}  |  Tel: ${data.companyPhone}`);

    doc.moveDown(1);
    doc.font('NotoBold').fontSize(14).fillColor('#000').text(title, {
      align: 'center',
    });
    doc
      .font('Noto')
      .fontSize(10)
      .fillColor('#333')
      .text(`Số: ${data.invoiceNumber}`, { align: 'center' })
      .text(`Ngày lập: ${data.issuedAt || formatInvoiceDate()}`, {
        align: 'center',
      });

    doc.moveDown(1);
    doc
      .font('NotoBold')
      .fontSize(11)
      .fillColor('#000')
      .text('Thông tin khách hàng');
    doc
      .font('Noto')
      .fontSize(10)
      .fillColor('#333')
      .text(`Họ tên: ${data.customerName}`)
      .text(`Email: ${data.customerEmail}`);
    if (data.customerPhone) {
      doc.text(`Điện thoại: ${data.customerPhone}`);
    }

    doc.moveDown(0.5);
    doc
      .font('NotoBold')
      .fontSize(11)
      .fillColor('#000')
      .text('Thông tin đơn hàng');
    doc
      .font('Noto')
      .fontSize(10)
      .fillColor('#333')
      .text(`Mã đơn: ${data.orderCode}`)
      .text(`Trạng thái: ${data.orderStatus}`)
      .text(`Sản phẩm: ${data.productName}`);
    if (data.packageType) {
      doc.text(`Gói dịch vụ: ${data.packageType}`);
    }
    if (data.paymentPlanSummary) {
      doc.moveDown(0.4);
      doc
        .font('NotoBold')
        .fontSize(10)
        .fillColor('#8B4513')
        .text('Lịch thanh toán theo gói');
      doc.font('Noto').fontSize(9).fillColor('#333').text(data.paymentPlanSummary);
      for (const s of data.paymentPlan) {
        const mark =
          s.status === 'paid' ? '[x]' : s.status === 'current' ? '[*]' : '[ ]';
        const amt =
          s.amountPaid != null ? ` — ${formatVnd(s.amountPaid)}` : '';
        doc.text(
          `${mark} Lần ${s.stepIndex}/${s.totalSteps}: ${s.label}${amt}`,
        );
      }
    }

    doc.moveDown(1);
    doc.font('NotoBold').fontSize(11).fillColor('#000').text('Chi tiết');
    doc.moveDown(0.3);

    for (const item of data.lineItems) {
      doc
        .font('Noto')
        .fontSize(10)
        .fillColor('#333')
        .text(
          `${item.description}  ×${item.quantity}  ${formatVnd(item.unitPrice)}  =  ${formatVnd(item.amount)}`,
        );
    }

    doc.moveDown(0.8);
    doc
      .font('Noto')
      .fontSize(10)
      .fillColor('#333')
      .text(`Tạm tính: ${formatVnd(data.subtotal)}`)
      .text(`Phí dịch vụ: ${formatVnd(data.serviceFee)}`)
      .text(`Phí phát sinh: ${formatVnd(data.extraFee)}`)
      .text(`Giảm giá: -${formatVnd(data.discountAmount)}`);
    doc
      .font('NotoBold')
      .fontSize(11)
      .fillColor('#000')
      .text(`Tổng đơn hàng: ${formatVnd(data.totalPrice)}`)
      .text(`Đã thanh toán: ${formatVnd(data.paidAmount)}`)
      .text(`Còn lại: ${formatVnd(data.remainingAmount)}`);

    if (data.highlightPayment) {
      doc.moveDown(0.8);
      doc
        .font('NotoBold')
        .fontSize(11)
        .fillColor('#8B4513')
        .text('Khoản vừa thanh toán');
      doc
        .font('Noto')
        .fontSize(10)
        .fillColor('#333')
        .text(`Loại: ${data.highlightPayment.phaseLabel}`)
        .text(`Số tiền: ${formatVnd(data.highlightPayment.amount)}`)
        .text(`Phương thức: ${data.highlightPayment.method || '—'}`)
        .text(`Mã GD: ${data.highlightPayment.paymentCode || '—'}`)
        .text(`Thời gian: ${data.highlightPayment.paidAt}`);
    }

    if (data.payments.length > 0) {
      doc.moveDown(0.8);
      doc
        .font('NotoBold')
        .fontSize(11)
        .fillColor('#000')
        .text('Lịch sử thanh toán');
      for (const p of data.payments) {
        doc
          .font('Noto')
          .fontSize(9)
          .fillColor('#333')
          .text(
            `${p.paidAt} | ${p.phaseLabel} | ${formatVnd(p.amount)} | ${p.method || '—'} | ${p.paymentCode || '—'}`,
          );
      }
    }

    doc.moveDown(1.5);
    doc
      .font('Noto')
      .fontSize(8)
      .fillColor('#777')
      .text(
        'Đây là biên lai điện tử do hệ thống Bioring phát hành. Không thay thế hóa đơn GTGT có mã của cơ quan thuế (nếu bắt buộc theo quy định).',
      );

    doc.end();
  });
}
