/**
 * Email templates — BioRing Atelier (white card, outer follows client theme).
 * Client mail không chạy Tailwind → inline styles. Icon = Lucide SVG.
 *
 * Logo: dùng placeholder {{EMAIL_LOGO_URL}} — EmailService thay bằng env lúc gửi
 * (tránh webpack bake process.env lúc build → logo .env không ăn).
 */

export const EMAIL_LOGO_PLACEHOLDER = '{{EMAIL_LOGO_URL}}';

export const DEFAULT_EMAIL_LOGO_URL =
  'https://res.cloudinary.com/dwly9gwij/image/upload/v1785372180/logo_syraz3.png';

/** @deprecated Prefer EmailService + placeholder; kept for preview script. */
export function resolveEmailLogoUrl(): string {
  const fromEnv = process.env.EMAIL_LOGO_URL?.trim();
  return fromEnv || DEFAULT_EMAIL_LOGO_URL;
}

/** White-card brand tokens */
const C = {
  card: '#ffffff',
  cardBorder: '#e8e0d4',
  inset: '#faf7f2',
  insetBorder: '#efe6da',
  gold: '#c5a059',
  goldSoft: '#d4af37',
  ink: '#1a1410',
  body: '#4a433c',
  muted: '#8a8178',
  line: '#ece4d8',
};

function lucide(
  name:
    | 'check-circle-2'
    | 'x-circle'
    | 'clipboard-list'
    | 'receipt'
    | 'file-text'
    | 'hammer'
    | 'package'
    | 'truck'
    | 'arrow-up-right'
    | 'chevron-right'
    | 'shopping-bag',
  size = 20,
  color = C.gold,
): string {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"`;
  const paths: Record<typeof name, string> = {
    'check-circle-2': `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`,
    'x-circle': `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`,
    'clipboard-list': `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>`,
    receipt: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>`,
    'file-text': `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
    hammer: `<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>`,
    package: `<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>`,
    truck: `<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>`,
    'arrow-up-right': `<path d="M7 7h10v10"/><path d="M7 17 17 7"/>`,
    'chevron-right': `<path d="m9 18 6-6-6-6"/>`,
    'shopping-bag': `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" ${common}>${paths[name]}</svg>`;
}

function hero(eyebrow: string, title: string, italic: string): string {
  return `
<div style="text-align:center;padding:8px 0 28px">
  <p style="margin:0 0 12px;font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${C.gold}">${eyebrow}</p>
  <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:400;line-height:1.15;letter-spacing:0.06em;color:${C.ink};text-transform:uppercase">${title}</h1>
  <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;font-weight:400;color:${C.gold};line-height:1.2">${italic}</p>
  <div style="width:48px;height:1px;background:${C.gold};margin:24px auto 0;opacity:0.55"></div>
</div>`;
}

function layout(content: string): string {
  // Outer: không set background → theo theme Gmail/client
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background:transparent">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:${C.card};border:1px solid ${C.cardBorder};border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(26,20,16,0.08)">
        <tr>
          <td style="padding:28px 28px 16px;text-align:center;border-bottom:1px solid ${C.line};background:${C.card}">
            <img src="${EMAIL_LOGO_PLACEHOLDER}" width="132" height="auto" alt="BioRing" style="display:inline-block;max-width:160px;height:auto" />
            <p style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${C.gold}">Atelier</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;font-family:Inter,Arial,Helvetica,sans-serif;color:${C.body};font-size:15px;line-height:1.6;background:${C.card}">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 32px;text-align:center;background:${C.card}">
            <div style="width:100%;height:1px;background:${C.line};margin:0 0 20px"></div>
            <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;color:${C.muted};line-height:1.5">
              A private memory, cast in gold and worn close to the pulse.
            </p>
            <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted}">
              © 2026 BioRing Atelier
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function ctaButton(href: string, label: string): string {
  const webHref = href.replace('bioring://', 'https://bioring.com/');
  return `
<div style="text-align:center;margin:28px 0 8px">
  <a href="${href}" style="display:inline-block;background:${C.ink};color:#fff;padding:14px 28px;border-radius:9999px;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em">
    ${label}&nbsp;${lucide('arrow-up-right', 16, '#ffffff')}
  </a>
  <p style="font-size:11px;color:${C.muted};margin:12px 0 0;font-family:Inter,Arial,sans-serif">
    hoặc mở: <a href="${webHref}" style="color:${C.gold};text-decoration:none">${webHref}</a>
  </p>
</div>`;
}

function statusBadge(icon: Parameters<typeof lucide>[0], text: string): string {
  return `
<div style="text-align:center;margin:0 0 20px">
  <span style="display:inline-block;padding:8px 14px;border-radius:9999px;border:1px solid ${C.insetBorder};background:${C.inset};color:${C.gold};font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">
    ${lucide(icon, 16)}&nbsp;&nbsp;${text}
  </span>
</div>`;
}

function softCard(inner: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.inset};border:1px solid ${C.insetBorder};border-radius:14px;margin:16px 0">
  <tr><td style="padding:18px 18px">${inner}</td></tr>
</table>`;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}

function paymentPlanBlock(vars: {
  paymentPlanSummary?: string;
  paymentPlan?: Array<{
    stepIndex: number;
    totalSteps: number;
    label: string;
    status: 'paid' | 'current' | 'pending';
    amountPaid?: number;
  }>;
}): string {
  if (!vars.paymentPlan?.length) return '';
  const rows = vars.paymentPlan
    .map((s) => {
      const mark =
        s.status === 'paid' ? '✓' : s.status === 'current' ? '●' : '○';
      const color =
        s.status === 'paid'
          ? '#2e7d32'
          : s.status === 'current'
            ? C.gold
            : C.muted;
      const amt =
        s.amountPaid != null ? ` · ${money(s.amountPaid)}` : '';
      return `<tr>
        <td style="padding:6px 0;color:${color};font-size:13px;font-family:Inter,Arial,sans-serif;vertical-align:top;width:28px">${mark}</td>
        <td style="padding:6px 0;color:${C.ink};font-size:13px;font-family:Inter,Arial,sans-serif">
          <strong>Lần ${s.stepIndex}/${s.totalSteps}</strong> — ${s.label}${amt}
          <span style="color:${C.muted};font-size:11px"> · ${s.status === 'paid' ? 'Đã thanh toán' : s.status === 'current' ? 'Vừa thanh toán' : 'Chưa đến'}</span>
        </td>
      </tr>`;
    })
    .join('');

  return `
    <div style="margin:16px 0 0;padding:14px;border-radius:12px;background:${C.card};border:1px solid ${C.insetBorder}">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${C.gold};font-family:Inter,Arial,sans-serif">Lịch thanh toán theo gói</p>
      ${vars.paymentPlanSummary ? `<p style="margin:0 0 10px;color:${C.body};font-size:13px">${vars.paymentPlanSummary}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div>`;
}

function invoiceHtml(vars: {
  kind: 'payment' | 'final';
  fullName: string;
  orderCode: string;
  invoiceNumber: string;
  issuedAt: string;
  productName: string;
  packageType?: string;
  paymentPlanSummary?: string;
  paymentPlan?: Array<{
    stepIndex: number;
    totalSteps: number;
    label: string;
    status: 'paid' | 'current' | 'pending';
    amountPaid?: number;
  }>;
  highlightStepLabel?: string;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  subtotal: number;
  serviceFee: number;
  extraFee: number;
  discountAmount: number;
  highlightLabel?: string;
  highlightAmount?: number;
  highlightMethod?: string;
  companyName: string;
  companyTaxCode: string;
}): string {
  const isFinal = vars.kind === 'final';
  const title = isFinal ? 'FINAL' : 'RECEIPT';
  const italic = isFinal ? 'settlement' : 'confirmed';
  const stepHint = vars.highlightStepLabel
    ? ` (${vars.highlightStepLabel})`
    : '';
  const intro = isFinal
    ? `Đơn hàng <strong style="color:${C.ink}">${vars.orderCode}</strong> đã hoàn tất. Hóa đơn tổng kết + PDF đính kèm.`
    : `Đơn hàng <strong style="color:${C.ink}">${vars.orderCode}</strong> vừa thanh toán thành công${stepHint}. Số tiền vừa trả và còn lại bên dưới — PDF đính kèm.`;

  const productRow = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">
  <tr>
    <td width="40" valign="middle">${lucide('shopping-bag', 22)}</td>
    <td style="padding:0 10px;font-family:Inter,Arial,sans-serif">
      <div style="color:${C.ink};font-size:15px;font-weight:600">${vars.productName}</div>
      <div style="color:${C.muted};font-size:12px;margin-top:2px">${vars.packageType ? `Gói ${vars.packageType} · ` : ''}${vars.orderCode}</div>
    </td>
    <td align="right" valign="middle" style="color:${C.gold};font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;white-space:nowrap">
      ${money(vars.totalPrice)}&nbsp;${lucide('chevron-right', 16, C.muted)}
    </td>
  </tr>
</table>`;

  const row = (label: string, value: string, strong = false) => `
<tr>
  <td style="padding:8px 0;color:${C.muted};font-size:13px;font-family:Inter,Arial,sans-serif">${label}</td>
  <td align="right" style="padding:8px 0;color:${strong ? C.gold : C.ink};font-size:13px;font-family:Inter,Arial,sans-serif;font-weight:${strong ? 600 : 400}">${value}</td>
</tr>`;

  return layout(`
    ${statusBadge(isFinal ? 'file-text' : 'receipt', isFinal ? 'Hóa đơn tổng kết' : 'Biên lai thanh toán')}
    ${hero('BioRing Atelier', title, italic)}
    <p style="margin:0 0 8px;color:${C.body}">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
    <p style="margin:0 0 8px;color:${C.body}">${intro}</p>
    <p style="margin:0;color:${C.muted};font-size:12px">Số <span style="color:${C.gold}">${vars.invoiceNumber}</span> · ${vars.issuedAt}</p>

    ${softCard(`
      ${productRow}
      ${paymentPlanBlock(vars)}
      <div style="height:1px;background:${C.line};margin:14px 0"></div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Công ty', vars.companyName)}
        ${row('MST', vars.companyTaxCode || '—')}
        ${row('Tạm tính', money(vars.subtotal))}
        ${row('Phí dịch vụ', money(vars.serviceFee))}
        ${row('Phí phát sinh', money(vars.extraFee))}
        ${row('Giảm giá', `-${money(vars.discountAmount)}`)}
        ${row('Tổng đơn', money(vars.totalPrice), true)}
        ${row('Đã thanh toán', money(vars.paidAmount), true)}
        ${row('Còn lại', money(vars.remainingAmount), true)}
      </table>
      ${
        vars.highlightLabel != null && vars.highlightAmount != null
          ? `
      <div style="margin-top:14px;padding:14px;border-radius:12px;background:${C.card};border:1px solid ${C.insetBorder}">
        <table role="presentation" width="100%"><tr>
          <td style="color:${C.muted};font-size:12px;font-family:Inter,Arial,sans-serif">
            ${lucide('check-circle-2', 16)}&nbsp; Vừa thanh toán${vars.highlightStepLabel ? ` · ${vars.highlightStepLabel}` : ''}<br/>
            <span style="color:${C.ink};font-size:13px">${vars.highlightLabel}${vars.highlightMethod ? ` · ${vars.highlightMethod}` : ''}</span>
          </td>
          <td align="right" style="color:${C.gold};font-size:16px;font-weight:600;font-family:Inter,Arial,sans-serif;white-space:nowrap">${money(vars.highlightAmount)}</td>
        </tr></table>
      </div>`
          : ''
      }
    `)}

    ${ctaButton(`bioring://order/${vars.orderCode}`, 'Xem đơn hàng')}
  `);
}

export const templates = {
  orderApproved: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      ${statusBadge('check-circle-2', 'Đã duyệt')}
      ${hero('BioRing Atelier', 'APPROVED', 'resonance')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong> đã được duyệt.
        Vui lòng thanh toán để chúng tôi tiến hành sản xuất.
      </p>
      ${ctaButton(`bioring://payment/${vars.orderCode}`, 'Thanh toán ngay')}
    `),

  orderRejected: (vars: {
    orderCode: string;
    fullName: string;
    note?: string;
  }) =>
    layout(`
      ${statusBadge('x-circle', 'Cần chỉnh sửa')}
      ${hero('BioRing Atelier', 'REVISION', 'required')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong> cần chỉnh sửa trước khi duyệt.
      </p>
      ${
        vars.note
          ? softCard(
              `<p style="margin:0;color:${C.muted};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">Ghi chú từ Manager</p>
               <p style="margin:8px 0 0;color:${C.ink}">${vars.note}</p>`,
            )
          : ''
      }
      ${ctaButton(`bioring://order/${vars.orderCode}`, 'Mở đơn hàng')}
    `),

  paymentConfirmed: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      ${statusBadge('check-circle-2', 'Thanh toán OK')}
      ${hero('BioRing Atelier', 'PAYMENT', 'confirmed')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong> đã thanh toán thành công.
        Chúng tôi đang chuẩn bị sản xuất.
      </p>
      ${ctaButton(`bioring://order/${vars.orderCode}`, 'Theo dõi đơn')}
    `),

  invoicePayment: invoiceHtml,
  invoiceFinal: (vars: Parameters<typeof invoiceHtml>[0]) =>
    invoiceHtml({ ...vars, kind: 'final' }),

  productionStarted: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      ${statusBadge('hammer', 'Đang sản xuất')}
      ${hero('BioRing Atelier', 'CRAFT', 'in progress')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong> đã chuyển sang giai đoạn sản xuất.
        Thợ kim hoàn đang chế tác chiếc nhẫn của bạn.
      </p>
      ${ctaButton(`bioring://order/${vars.orderCode}`, 'Xem tiến trình')}
    `),

  readyForDelivery: (vars: {
    orderCode: string;
    fullName: string;
    method?: 'DELIVERY' | 'PICKUP';
  }) => {
    const isPickup = vars.method === 'PICKUP';
    return layout(`
      ${statusBadge(isPickup ? 'package' : 'truck', isPickup ? 'Sẵn sàng nhận' : 'Sẵn sàng giao')}
      ${hero('BioRing Atelier', 'READY', isPickup ? 'for pickup' : 'for delivery')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong>
        ${
          isPickup
            ? 'đã sẵn sàng để bạn đến nhận tại cửa hàng / điểm pickup.'
            : 'đã hoàn thiện và sẵn sàng giao đến bạn.'
        }
      </p>
      ${ctaButton(`bioring://order/${vars.orderCode}`, isPickup ? 'Xem hướng dẫn nhận' : 'Theo dõi giao hàng')}
    `);
  },

  orderDelivered: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      ${statusBadge('truck', 'Đã giao')}
      ${hero('BioRing Atelier', 'ETERNAL', 'resonance')}
      <p style="color:${C.body};margin:0">Xin chào <span style="color:${C.ink};font-weight:600">${vars.fullName}</span>,</p>
      <p style="color:${C.body};margin:12px 0 0">
        Đơn hàng <strong style="color:${C.gold}">${vars.orderCode}</strong> đã giao thành công.
        Mở App để xem Memory Card và thông tin bảo hành.
      </p>
      ${ctaButton(`bioring://memory/${vars.orderCode}`, 'Mở Memory Card')}
    `),
};
