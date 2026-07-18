# FE API Gaps — Implementation Plan

**Ngày:** 2026-07-19
**Mục tiêu:** Bổ sung 7 API endpoints FE cần mà BE chưa có.

---

## Tổng quan

| # | Endpoint | Module | Effort | Files |
|---|----------|--------|--------|-------|
| B1 | `GET /api/v1/transactions` | Payments | ~3h | 6 |
| B2 | `GET /api/v1/transactions/overview` | Payments | ~2h | 4 |
| B3 | `GET /api/v1/admin/dashboard/monthly-growth` | Admin | ~1h | 4 |
| B4 | `GET /api/v1/customers` | Customers | ~5h | 7 |
| B5 | `GET /api/v1/admin/audit-logs` | Audit | ~2h | 6 |
| B6 | `GET /api/v1/devices` | Devices | ~4h | 10 |
| B7 | `PATCH /api/v1/engravings/:id/cancel` | Engraving | ~0.5h | 4 |
| B8 | `POST/PUT/DELETE /api/v1/products/:id` | Catalog | ~2.5h | 6 |

**Total:** ~20h, ~47 files (mới + sửa)

---

## Sprint 1: Transactions (B1 + B2)

### Mục tiêu
Cho phép FE hiển thị danh sách giao dịch tổng hợp (không chỉ per-order) + tổng quan tài chính.

### B1: GET /api/v1/transactions

**Endpoint:**
```
GET /api/v1/transactions?page=1&limit=20&status=SUCCESS&method=PAYOS
Authorization: Bearer <token>
```

**Auth:** `order.read` (hoặc tạo permission mới `transaction.read`)

**Logic:**
```typescript
// order.service.ts
async listPayments(params: {
  page: number;
  limit: number;
  status?: string;
  method?: string;
}) {
  const where: Prisma.paymentsWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.method) where.method = params.method;

  const [data, total] = await Promise.all([
    this.prisma.payments.findMany({
      where,
      include: {
        orders: {
          include: {
            users: { select: { id: true, full_name: true, email: true } },
            guest_customers: { select: { id: true, full_name: true, email: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    this.prisma.payments.count({ where }),
  ]);

  return {
    data: data.map(p => ({
      id: p.id,
      transactionId: `PAY-${p.payos_transaction_id ?? p.id}`,
      orderId: p.order_id,
      orderNumber: p.orders?.order_code ?? '',
      customer: p.orders?.users
        ? { id: p.orders.users.id, name: p.orders.users.full_name, email: p.orders.users.email }
        : p.orders?.guest_customers
          ? { id: p.orders.guest_customers.id, name: p.orders.guest_customers.full_name, email: p.orders.guest_customers.email }
          : null,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.created_at,
    })),
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      lastPage: Math.ceil(total / params.limit),
    },
  };
}
```

**Proto:**
```protobuf
message ListPaymentsRequest {
  int32 page = 1;
  int32 limit = 2;
  string status = 3;
  string method = 4;
}

message PaymentTransaction {
  string id = 1;
  string transaction_id = 2;
  string order_id = 3;
  string order_number = 4;
  CustomerBrief customer = 5;
  string method = 6;
  double amount = 7;
  string status = 8;
  string created_at = 9;
}

message CustomerBrief {
  string id = 1;
  string name = 2;
  string email = 3;
}

message ListPaymentsResponse {
  repeated PaymentTransaction data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
}

rpc ListPayments(ListPaymentsRequest) returns (ListPaymentsResponse);
```

**Gateway controller:**
```typescript
@Get('transactions')
@Permissions(Permission.OrderRead)
@ApiListTransactionsDocs()
listTransactions(
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('status') status?: string,
  @Query('method') method?: string,
) {
  return this.grpcCall('listPayments', {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    status: status ?? '',
    method: method ?? '',
  });
}
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm `ListPaymentsRequest`, `PaymentTransaction`, `CustomerBrief`, `ListPaymentsResponse`, `rpc ListPayments` |
| 2 | `libs/common/src/dtos/ecommerce/payment/transaction-list.dto.ts` | **Mới** — response DTO |
| 3 | `libs/common/src/dtos/ecommerce/payment/index.ts` | Sửa — export DTO mới |
| 4 | `apps/ecommerce-service/src/order/order.service.ts` | Sửa — thêm `listPayments()` |
| 5 | `apps/ecommerce-service/src/order/order.controller.ts` | Sửa — thêm `@GrpcMethod` handler |
| 6 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | Sửa — thêm `GET /api/v1/transactions` |
| 7 | `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts` | Sửa — thêm `ApiListTransactionsDocs()` |

### B2: GET /api/v1/transactions/overview

**Endpoint:**
```
GET /api/v1/transactions/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "grossRevenue": 125000000,
  "netRevenue": 120000000,
  "pendingCod": 5000000,
  "refunded": 2000000,
  "grossChange": 12.5,
  "netChange": 10.2,
  "pendingChange": -5.0,
  "refundedChange": 0.0
}
```

**Logic:**
```typescript
// order.service.ts
async getTransactionOverview() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [thisMonth, lastMonth] = await Promise.all([
    this.aggregatePayments(startThisMonth, now),
    this.aggregatePayments(startLastMonth, endLastMonth),
  ]);

  const calcChange = (current: number, previous: number) =>
    previous === 0 ? 0 : Number(((current - previous) / previous * 100).toFixed(1));

  return {
    grossRevenue: thisMonth.gross,
    netRevenue: thisMonth.net,
    pendingCod: thisMonth.pending,
    refunded: thisMonth.refunded,
    grossChange: calcChange(thisMonth.gross, lastMonth.gross),
    netChange: calcChange(thisMonth.net, lastMonth.net),
    pendingChange: calcChange(thisMonth.pending, lastMonth.pending),
    refundedChange: calcChange(thisMonth.refunded, lastMonth.refunded),
  };
}

private async aggregatePayments(from: Date, to: Date) {
  const payments = await this.prisma.payments.groupBy({
    by: ['status'],
    where: { created_at: { gte: from, lte: to } },
    _sum: { amount: true },
  });

  let gross = 0, net = 0, pending = 0, refunded = 0;
  for (const p of payments) {
    const amt = Number(p._sum.amount ?? 0);
    gross += amt;
    if (p.status === 'PAID' || p.status === 'SUCCESS') net += amt;
    else if (p.status === 'PENDING') pending += amt;
    else if (p.status === 'REFUNDED') refunded += amt;
  }

  return { gross, net, pending, refunded };
}
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm `GetTransactionOverviewRequest`, `TransactionOverviewResponse`, `rpc GetTransactionOverview` |
| 2 | `libs/common/src/dtos/ecommerce/payment/transaction-overview.dto.ts` | **Mới** — response DTO |
| 3 | `libs/common/src/dtos/ecommerce/payment/index.ts` | Sửa — export DTO mới |
| 4 | `apps/ecommerce-service/src/order/order.service.ts` | Sửa — thêm `getTransactionOverview()` |
| 5 | `apps/ecommerce-service/src/order/order.controller.ts` | Sửa — thêm `@GrpcMethod` handler |
| 6 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | Sửa — thêm `GET /api/v1/transactions/overview` |
| 7 | `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts` | Sửa — thêm swagger docs |

---

## Sprint 2: Monthly Growth (B3)

### Mục tiêu
Thay vì chỉ daily revenue timeline, thêm monthly growth để FE vẽ biểu đồ tăng trưởng.

### B3: GET /api/v1/admin/dashboard/monthly-growth

**Endpoint:**
```
GET /api/v1/admin/dashboard/monthly-growth?months=12
Authorization: Bearer <token> (dashboard.view)
```

**Logic:**
```typescript
// admin.service.ts
async getMonthlyGrowth(months: number) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const payments = await this.prisma.payments.findMany({
    where: {
      status: { in: ['PAID', 'SUCCESS'] },
      paid_at: { gte: startDate, lte: now },
    },
    select: { amount: true, paid_at: true },
  });

  // Group by month client-side
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyMap = new Map<string, number>();

  for (const p of payments) {
    const d = new Date(p.paid_at);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount));
  }

  // Fill missing months with 0
  const data: { month: string; revenue: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    data.push({ month: monthNames[d.getMonth()], revenue: monthlyMap.get(key) ?? 0 });
  }

  return { data };
}
```

**Proto:**
```protobuf
message GetMonthlyGrowthRequest {
  int32 months = 1;
}

message MonthlyRevenue {
  string month = 1;
  double revenue = 2;
}

message GetMonthlyGrowthResponse {
  repeated MonthlyRevenue data = 1;
}

rpc GetMonthlyGrowth(GetMonthlyGrowthRequest) returns (GetMonthlyGrowthResponse);
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm messages + `rpc GetMonthlyGrowth` |
| 2 | `libs/common/src/dtos/ecommerce/admin/monthly-growth.dto.ts` | **Mới** — response DTO |
| 3 | `libs/common/src/dtos/ecommerce/admin/index.ts` | Sửa — export DTO mới |
| 4 | `apps/ecommerce-service/src/admin/admin.service.ts` | Sửa — thêm `getMonthlyGrowth()` |
| 5 | `apps/ecommerce-service/src/admin/admin.controller.ts` | Sửa — thêm `@GrpcMethod` |
| 6 | `apps/api-gateway/src/modules/ecommerce/admin/admin.controller.ts` | Sửa — thêm `GET /admin/dashboard/monthly-growth` |
| 7 | `apps/api-gateway/src/modules/ecommerce/admin/admin.swagger.ts` | Sửa — thêm docs |

---

## Sprint 3: Customers (B4)

### Mục tiêu
FE cần danh sách khách hàng (registered users) có search, filter, sort, phân trang, kèm order stats.

### B4: GET /api/v1/customers

**Endpoint:**
```
GET /api/v1/customers?page=1&limit=20&search=nguyen&status=active&sortBy=totalSpent&sortOrder=desc
Authorization: Bearer <token> (user.read)
```

**Logic:**
```typescript
// customer.service.ts
async listCustomers(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  // Base query: users + orders aggregate
  const where: Prisma.usersWhereInput = {};
  if (params.search) {
    where.OR = [
      { full_name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status.toUpperCase();

  // Get total count
  const total = await this.prisma.users.count({ where });

  // Build orderBy
  let orderBy: Prisma.usersOrderByWithRelationInput = { created_at: 'desc' };
  if (params.sortBy === 'totalOrders' || params.sortBy === 'totalSpent' || params.sortBy === 'lastOrderDate') {
    // Sorting by aggregate — cần subquery hoặc sort sau khi query, để client sort cho đơn giản
    // ponytail: client-side sort cho aggregate fields, add DB sort khi throughput cần
  } else if (params.sortBy === 'name') {
    orderBy = { full_name: params.sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (params.sortBy === 'email') {
    orderBy = { email: params.sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (params.sortBy === 'joinDate') {
    orderBy = { created_at: params.sortOrder === 'asc' ? 'asc' : 'desc' };
  }

  const users = await this.prisma.users.findMany({
    where,
    orderBy,
    skip: (params.page - 1) * params.limit,
    take: params.limit,
    include: {
      orders: { select: { id: true, total_price: true, created_at: true, status: true } },
      user_addresses: { select: { province: true }, take: 1, orderBy: { created_at: 'desc' } },
    },
  });

  const data = users.map(u => {
    const completedOrders = u.orders.filter(o => o.status === 'COMPLETED');
    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      phone: u.phone ?? '',
      avatar: u.avatar_url ?? null,
      status: u.status?.toLowerCase() ?? 'active',
      totalOrders: completedOrders.length,
      totalSpent: completedOrders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0),
      lastOrderDate: completedOrders.length > 0
        ? completedOrders.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0].created_at.toISOString()
        : null,
      joinDate: u.created_at.toISOString(),
      location: u.user_addresses[0]?.province ?? '',
    };
  });

  // Client-side sort for aggregate fields
  // ponytail: client sort aggregate, acceptable at < 10k users
  if (params.sortBy === 'totalSpent') {
    data.sort((a, b) => params.sortOrder === 'asc' ? a.totalSpent - b.totalSpent : b.totalSpent - a.totalSpent);
  } else if (params.sortBy === 'totalOrders') {
    data.sort((a, b) => params.sortOrder === 'asc' ? a.totalOrders - b.totalOrders : b.totalOrders - a.totalOrders);
  } else if (params.sortBy === 'lastOrderDate') {
    data.sort((a, b) => {
      const da = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
      const db = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
      return params.sortOrder === 'asc' ? da - db : db - da;
    });
  }

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, lastPage: Math.ceil(total / params.limit) },
  };
}
```

**Proto:**
```protobuf
message ListCustomersRequest {
  int32 page = 1;
  int32 limit = 2;
  string search = 3;
  string status = 4;
  string sort_by = 5;
  string sort_order = 6;
}

message CustomerInfo {
  string id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  string avatar = 5;
  string status = 6;
  int32 total_orders = 7;
  double total_spent = 8;
  string last_order_date = 9;
  string join_date = 10;
  string location = 11;
}

message ListCustomersResponse {
  repeated CustomerInfo data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
}

rpc ListCustomers(ListCustomersRequest) returns (ListCustomersResponse);
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm messages + `rpc ListCustomers` |
| 2 | `libs/common/src/dtos/ecommerce/customer/customer-list.dto.ts` | **Mới** — response + query DTOs |
| 3 | `libs/common/src/dtos/ecommerce/customer/index.ts` | Sửa — export DTO mới |
| 4 | `apps/ecommerce-service/src/customer/customer.service.ts` | Sửa — thêm `listCustomers()` |
| 5 | `apps/ecommerce-service/src/customer/customer.controller.ts` | Sửa — thêm `@GrpcMethod` |
| 6 | `apps/api-gateway/src/modules/ecommerce/customer/customer.controller.ts` | Sửa — thêm `GET /api/v1/customers` (thay vì chỉ lookup) |
| 7 | `apps/api-gateway/src/modules/ecommerce/customer/customer.swagger.ts` | **Mới** — swagger docs |

---

## Sprint 4: Audit Logs (B5)

### Mục tiêu
FE cần xem nhật ký hệ thống. Audit module hiện chỉ ghi, không đọc. Cần thêm listing endpoint.

### B5: GET /api/v1/admin/audit-logs

**Endpoint:**
```
GET /api/v1/admin/audit-logs?page=1&limit=50&resource=order&fromDate=2026-06-01&toDate=2026-07-01
Authorization: Bearer <token> (audit.read — permission mới)
```

**Logic:**
```typescript
// audit.service.ts (mới)
async listAuditLogs(params: {
  page: number;
  limit: number;
  resource?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const where: Prisma.audit_logsWhereInput = {};
  if (params.resource) where.entity_name = params.resource;
  if (params.fromDate || params.toDate) {
    where.created_at = {};
    if (params.fromDate) where.created_at.gte = new Date(params.fromDate);
    if (params.toDate) where.created_at.lte = new Date(params.toDate);
  }

  const [data, total] = await Promise.all([
    this.prisma.audit_logs.findMany({
      where,
      include: { users: { select: { id: true, full_name: true, email: true } } },
      orderBy: { created_at: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    this.prisma.audit_logs.count({ where }),
  ]);

  return {
    data: data.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      actor: log.users
        ? { id: log.users.id, name: log.users.full_name, email: log.users.email }
        : null,
      action: log.action,
      resource: log.entity_name,
      resourceId: log.entity_id,
      description: `${log.action} on ${log.entity_name} ${log.entity_id}`,
      result: 'success',
      metadata: log.new_value ? { newValue: log.new_value, oldValue: log.old_value } : null,
    })),
    meta: { total, page: params.page, limit: params.limit, lastPage: Math.ceil(total / params.limit) },
  };
}
```

**Proto:**
```protobuf
message ListAuditLogsRequest {
  int32 page = 1;
  int32 limit = 2;
  string resource = 3;
  string from_date = 4;
  string to_date = 5;
}

message AuditLogActor {
  string id = 1;
  string name = 2;
  string email = 3;
}

message AuditLogEntry {
  string id = 1;
  string timestamp = 2;
  AuditLogActor actor = 3;
  string action = 4;
  string resource = 5;
  string resource_id = 6;
  string description = 7;
  string result = 8;
  string metadata = 9;
}

message ListAuditLogsResponse {
  repeated AuditLogEntry data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
}

rpc ListAuditLogs(ListAuditLogsRequest) returns (ListAuditLogsResponse);
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm messages + `rpc ListAuditLogs` |
| 2 | `libs/common/src/dtos/ecommerce/audit/` | **Mới** — thư mục + 2 DTOs |
| 3 | `apps/ecommerce-service/src/audit/audit.service.ts` | **Mới** — service với `listAuditLogs()` |
| 4 | `apps/ecommerce-service/src/audit/audit.controller.ts` | **Mới** — @GrpcMethod handler |
| 5 | `apps/ecommerce-service/src/audit/audit.module.ts` | Sửa — thêm controller + service vào providers |
| 6 | `apps/api-gateway/src/modules/ecommerce/admin/admin.controller.ts` | Sửa — thêm `GET /admin/audit-logs` |
| 7 | `apps/api-gateway/src/modules/ecommerce/admin/admin.swagger.ts` | Sửa — thêm docs |

---

## Sprint 5: Devices (B6)

### Mục tiêu
FE cần danh sách thiết bị IoT inventory. Schema `iot_devices` đã có, cần module + API.

### B6: GET /api/v1/devices

**Endpoint:**
```
GET /api/v1/devices?page=1&limit=20&status=online&search=ABC
Authorization: Bearer <token> (device.read — permission mới)
```

**Logic:**
```typescript
// device.service.ts (mới)
async listDevices(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const where: Prisma.iot_devicesWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { device_name: { contains: params.search, mode: 'insensitive' } },
      { mac_address: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    this.prisma.iot_devices.findMany({
      where,
      include: {
        device_health_logs: { orderBy: { logged_at: 'desc' }, take: 1 },
      },
      orderBy: { updated_at: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    this.prisma.iot_devices.count({ where }),
  ]);

  return {
    data: data.map(d => ({
      id: d.id,
      serialNumber: d.mac_address,
      model: d.device_type,
      status: d.status,
      firmware: d.firmware_version ?? '',
      lastSeen: d.updated_at,
      rssi: null,   // ponytail: không có rssi trong schema, add khi thiết bị thực tế report
      uptime: null,  // ponytail: không có uptime, add khi cần
      cpu: d.device_health_logs[0]?.cpu_usage ?? null,
      memory: d.device_health_logs[0]?.memory_usage ?? null,
      location: d.location ?? '',
    })),
    meta: { total, page: params.page, limit: params.limit, lastPage: Math.ceil(total / params.limit) },
  };
}
```

**Proto:**
```protobuf
message ListDevicesRequest {
  int32 page = 1;
  int32 limit = 2;
  string status = 3;
  string search = 4;
}

message DeviceInfo {
  string id = 1;
  string serial_number = 2;
  string model = 3;
  string status = 4;
  string firmware = 5;
  string last_seen = 6;
  double rssi = 7;
  double uptime = 8;
  double cpu = 9;
  double memory = 10;
  string location = 11;
}

message ListDevicesResponse {
  repeated DeviceInfo data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
}

rpc ListDevices(ListDevicesRequest) returns (ListDevicesResponse);
```

**Đồng thời thêm device detail + CRUD cho admin:**

```protobuf
message GetDeviceRequest { string id = 1; }
message GetDeviceResponse { DeviceInfo device = 1; }
message CreateDeviceRequest {
  string device_name = 1;
  string mac_address = 2;
  string device_type = 3;
  string location = 4;
}
message UpdateDeviceRequest {
  string id = 1;
  string device_name = 2;
  string device_type = 3;
  string location = 4;
  string status = 5;
  string firmware_version = 6;
}
message MutateDeviceResponse { DeviceInfo device = 1; }

rpc GetDevice(GetDeviceRequest) returns (GetDeviceResponse);
rpc CreateDevice(CreateDeviceRequest) returns (MutateDeviceResponse);
rpc UpdateDevice(UpdateDeviceRequest) returns (MutateDeviceResponse);
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm messages + 4 RPCs |
| 2 | `libs/common/src/dtos/ecommerce/device/` | **Mới** — thư mục + 4 DTOs |
| 3 | `apps/ecommerce-service/src/device/device.module.ts` | **Mới** |
| 4 | `apps/ecommerce-service/src/device/device.service.ts` | **Mới** |
| 5 | `apps/ecommerce-service/src/device/device.controller.ts` | **Mới** |
| 6 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Sửa — import DeviceModule |
| 7 | `apps/api-gateway/src/modules/ecommerce/device/device.controller.ts` | **Mới** |
| 8 | `apps/api-gateway/src/modules/ecommerce/device/device.swagger.ts` | **Mới** |
| 9 | `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` | Sửa — register DeviceController |

---

## Sprint 6: Engraving Cancel + Product CRUD (B7 + B8)

### Mục tiêu
FE cần xoá engraving khỏi "giỏ" + CRUD sản phẩm trong catalog.

### B7: PATCH /api/v1/engravings/:id/cancel

**Endpoint:**
```
PATCH /api/v1/engravings/:id/cancel
Authorization: JWT (bearer)
```

**Logic:**
```typescript
// engraving.service.ts
async cancelEngraving(id: string, userId: string) {
  const engraving = await this.prisma.engravings.findUnique({
    where: { id },
    select: { id: true, user_id: true, order_id: true, status: true },
  });
  if (!engraving) throw new NotFoundException('Engraving not found');
  if (engraving.user_id !== userId) throw new ForbiddenException('Not your engraving');
  if (engraving.order_id) throw new BadRequestException('Cannot cancel — already has order');
  if (engraving.status === 'CANCELLED') throw new BadRequestException('Already cancelled');

  return this.prisma.engravings.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm `rpc CancelEngraving` |
| 2 | `apps/ecommerce-service/src/engraving/engraving.service.ts` | Sửa — thêm `cancelEngraving()` |
| 3 | `apps/ecommerce-service/src/engraving/engraving.controller.ts` | Sửa — thêm `@GrpcMethod` |
| 4 | `apps/api-gateway/src/modules/ecommerce/engraving/engraving.controller.ts` | Sửa — thêm `PATCH /engravings/:id/cancel` |
| 5 | `apps/api-gateway/src/modules/ecommerce/engraving/engraving.swagger.ts` | Sửa — thêm docs |

### B8: POST/PUT/DELETE /api/v1/products/:id

**Endpoints:**
```
POST   /api/v1/products         — Create product
PUT    /api/v1/products/:id     — Update product
DELETE /api/v1/products/:id     — Soft-delete product
Authorization: Bearer <token> (catalog.write)
```

**Logic — soft delete:**
```typescript
// catalog.service.ts
async deleteProduct(id: string) {
  // Soft delete — set isActive = false thay vì xoá
  // ponytail: soft delete, hard delete khi có migration tool
  return this.prisma.products.update({
    where: { id },
    data: { is_active: false },
  });
}
```

**Files:**

| # | File | Action |
|---|------|--------|
| 1 | `proto/ecommerce.proto` | Thêm 3 RPCs + messages |
| 2 | `libs/common/src/dtos/ecommerce/catalog/` | Thêm 3 DTOs |
| 3 | `apps/ecommerce-service/src/catalog/catalog.service.ts` | Sửa — thêm 3 methods |
| 4 | `apps/ecommerce-service/src/catalog/catalog.controller.ts` | Sửa — thêm 3 @GrpcMethod |
| 5 | `apps/api-gateway/src/modules/ecommerce/catalog/catalog.controller.ts` | Sửa — thêm 3 endpoints |
| 6 | `apps/api-gateway/src/modules/ecommerce/catalog/catalog.swagger.ts` | Sửa — thêm docs |

---

## Tổng kết files

| Sprint | Mới | Sửa | Tổng |
|--------|-----|-----|------|
| 1: Transactions (B1+B2) | 2 | 12 | 14 |
| 2: Monthly Growth (B3) | 1 | 6 | 7 |
| 3: Customers (B4) | 2 | 5 | 7 |
| 4: Audit Logs (B5) | 4 | 3 | 7 |
| 5: Devices (B6) | 8 | 2 | 10 |
| 6: Engraving Cancel + Product CRUD (B7+B8) | 0 | 10 | 10 |
| **Total** | **17** | **38** | **55** |

## Acceptance

| # | Endpoint | Tiêu chí |
|---|----------|----------|
| 1 | `GET /api/v1/transactions` | Trả về paginated list payments JOIN users/orders, filter theo status + method |
| 2 | `GET /api/v1/transactions/overview` | grossRevenue, netRevenue, pendingCod, refunded + % change so với tháng trước |
| 3 | `GET /api/v1/admin/dashboard/monthly-growth` | Trả về revenue theo tháng, fill month thiếu = 0 |
| 4 | `GET /api/v1/customers` | Paginated + search (name/email/phone) + filter (status) + sort (totalSpent, name, joinDate) |
| 5 | `GET /api/v1/admin/audit-logs` | Paginated + filter (resource, fromDate, toDate) + actor info |
| 6 | `GET /api/v1/devices` | Paginated + search (name/mac) + filter (status) + health info |
| 7 | `PATCH /api/v1/engravings/:id/cancel` | Set status=CANCELLED, reject nếu đã có order |
| 8 | `POST/PUT/DELETE /api/v1/products/:id` | CRUD sản phẩm, soft delete |
| - | Build | `npm run build` qua cả 3 services |

## Ghi chú cho FE

**Cart → Engraving replacement:**
- `GET /api/v1/engravings?status=PENDING` = danh sách "giỏ thiết kế" (engraving chưa có order)
- `PATCH /api/v1/engravings/:id/cancel` = xoá khỏi "giỏ" (set status CANCELLED)
- `GET /api/v1/engravings/:id` = xem chi tiết 1 item trong "giỏ"
- `POST /api/v1/orders` (body: `{ engravingId }`) = tạo đơn từ 1 item
- 1 engraving = 1 order = 1 nhẫn. Không thể gom nhiều engraving vào 1 order.

**Permissions mới cần thêm (nếu chưa có):**
- `audit.read` — xem audit logs
- `device.read` — xem danh sách thiết bị
- `device.write` — CRUD thiết bị
- `catalog.write` — CRUD sản phẩm
