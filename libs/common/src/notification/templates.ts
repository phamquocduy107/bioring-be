function layout(content: string): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f5f0">
  <div style="background:#8B4513;padding:20px;text-align:center">
    <img src="https://res.cloudinary.com/dpm0zc06s/image/upload/v1/email/logo-white.png" width="120" alt="Bioring" />
  </div>
  <div style="background:#fff;padding:30px;border-radius:8px;margin-top:20px">${content}</div>
  <div style="padding:20px;text-align:center;color:#999;font-size:12px">
    <p>© 2026 Bioring. All rights reserved.</p>
    <p>Email này được gửi tự động từ hệ thống Bioring.</p>
  </div>
</div>`;
}

export const templates = {
  orderSubmitted: (vars: { orderCode: string; customerName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng mới cần duyệt</h2>
      <p><strong>${vars.customerName}</strong> vừa submit đơn hàng <strong>${vars.orderCode}</strong>.</p>
      <p>Vui lòng vào trang quản lý để xem xét và duyệt đơn hàng.</p>
    `),

  orderApproved: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng đã được duyệt 🎉</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> của bạn đã được duyệt.</p>
      <p>Vui lòng thanh toán để chúng tôi tiến hành sản xuất.</p>
    `),

  paymentConfirmed: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Thanh toán thành công</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> đã được thanh toán thành công.</p>
      <p>Chúng tôi đang tiến hành sản xuất. Bạn sẽ nhận được thông báo khi có tiến trình mới.</p>
    `),

  orderDelivered: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng đã giao thành công 🚚</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> đã được giao thành công.</p>
      <p>Hãy đăng nhập vào tài khoản Bioring để xem Memory Card của bạn.</p>
    `),

  orderRejected: (vars: { orderCode: string; fullName: string; note?: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng cần chỉnh sửa</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> cần được chỉnh sửa trước khi duyệt.</p>
      ${vars.note ? `<p><strong>Ghi chú từ Manager:</strong> ${vars.note}</p>` : ''}
    `),

  productionStarted: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng đang được sản xuất</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> đã được chuyển sang giai đoạn sản xuất.</p>
      <p>Thợ kim hoàn đang chế tác chiếc nhẫn của bạn. Chúng tôi sẽ thông báo khi hoàn thành.</p>
    `),

  readyForDelivery: (vars: { orderCode: string; fullName: string }) =>
    layout(`
      <h2 style="color:#8B4513">Đơn hàng sẵn sàng giao</h2>
      <p>Xin chào <strong>${vars.fullName}</strong>,</p>
      <p>Đơn hàng <strong>${vars.orderCode}</strong> đã hoàn thiện và sẵn sàng để giao.</p>
      <p>Vui lòng chọn hình thức nhận hàng trong ứng dụng Bioring.</p>
    `),
};
