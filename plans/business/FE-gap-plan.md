# FE API Gaps — Plan bổ sung (4 endpoints)

> **Giới hạn: không sửa schema** — chỉ dùng column/table đã có trong Prisma.

---

## 1. Guest Customer Listing

| Mục | Giá trị |
|-----|---------|
| Endpoint | `GET /api/v1/customers/guest` |
| Auth | `order.read` |
| Controller | CustomerController (có sẵn) → thêm `@Get('guest')` |
| Service | GuestService (có sẵn) → thêm `listGuestCustomers()` |

### Proto — thêm vào `EcommerceService`:

```protobuf
rpc ListGuestCustomers (ListGuestCustomersRequest) returns (ListGuestCustomersResponse);

message ListGuestCustomersRequest {
  int32 page = 1;
  int32 limit = 2;
  string search = 3;  // full_name, phone, email
}

message GuestCustomerInfo {
  string id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  string status = 5;              // "active" hardcode
  int32 total_orders = 6;
  double total_spent = 7;
  string last_order_date = 8;
  string join_date = 9;
  DigitalAssetsSummary digital_assets = 10;
  string qr_memory_status = 11;
  repeated ServiceTicketInfo service_tickets = 12;
  WarrantyInfo warranty = 13;
}

message DigitalAssetsSummary {
  bool has_voice = 1;
  bool has_fingerprint = 2;
  bool has_heartbeat = 3;
}

message ServiceTicketInfo {
  string id = 1;
  string ticket_code = 2;
  string service_type = 3;
  string status = 4;
  string created_at = 5;
}

message WarrantyInfo {
  bool is_active = 1;
  string expiry_date = 2;
  int32 used_free_count = 3;
}

message ListGuestCustomersResponse {
  repeated GuestCustomerInfo data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
}
```

### Service — `GuestService.listGuestCustomers()`

```ts
async listGuestCustomers(params: { page: number; limit: number; search?: string }) {
  const where: Prisma.guest_customersWhereInput = {};
  if (params.search) where.OR = [
    { full_name: { contains: params.search, mode: 'insensitive' } },
    { phone: { contains: params.search } },
    { email: { contains: params.search, mode: 'insensitive' } },
  ];

  const [guests, total] = await Promise.all([
    this.prisma.guest_customers.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { created_at: 'desc' },
      include: {
        orders: {
          select: { id: true, total_price: true, created_at: true, package_type: true },
          include: {
            warranties: { select: { status: true, expiry_date: true } },
            engravings: {
              select: {
                qr_memories: { select: { status: true, failed_attempts: true } },
              },
            },
          },
        },
        biometric_capture_sessions: {
          include: { biometric_capture_items: { select: { capture_type: true } } },
        },
        warranty_claims: {
          include: { service_tickets: { select: { id: true, ticket_code: true, service_type: true, status: true, created_at: true } } },
        },
      },
    }),
    this.prisma.guest_customers.count({ where }),
  ]);

  return {
    data: guests.map(mapGuestToInfo),
    total, page: params.page, limit: params.limit,
    last_page: Math.ceil(total / params.limit),
  };
}
```

`mapGuestToInfo()` computes:
- `status` = `"active"`
- `totalOrders` = orders.length
- `totalSpent` = sum orders.total_price
- `lastOrderDate` = max orders.created_at
- `digitalAssets` = distinct biometric_capture_items.capture_type → {hasVoice, hasFingerprint, hasHeartbeat}
- `qrMemoryStatus` = orders[0]?.engravings?.qr_memories?.status ?? ""
- `serviceTickets` = warranty_claims.flatMap(wc => wc.service_tickets)
- `warranty` = first order with warranty → {isActive, expiryDate, usedFreeCount}

### DTO

`libs/common/src/dtos/ecommerce/customer/list-guest-customers-query.dto.ts`

### api-reference.md

Thêm vào cuối Customer section (sau lookup). Renumber.

---

## 2. Central Delivery Listing

| Mục | Giá trị |
|-----|---------|
| Endpoint | `GET /api/v1/orders/deliveries` |
| Auth | `order.read` |
| Controller | OrderController (có sẵn) → thêm `@Get('deliveries')` |
| Service | OrderService (có sẵn) → thêm `listDeliveries()` |

### Proto

```protobuf
rpc ListDeliveries (ListDeliveriesRequest) returns (ListDeliveriesResponse);

message ListDeliveriesRequest {
  int32 page = 1;
  int32 limit = 2;
  string status = 3;
  string from_date = 4;
  string to_date = 5;
  string search = 6;  // order_code, tracking_code, phone
}

message DeliveryRecord {
  string id = 1;
  string order_code = 2;
  string tracking_code = 3;
  DeliveryCustomer customer = 4;
  string payment_status = 5;           // "paid" | "cod_pending" | "final_pending"
  DeliveryStaffInfo delivery_staff = 6;
  string status = 7;
  string proof_of_delivery = 8;        // null nếu SHIPPING
  string created_at = 9;
}

message DeliveryCustomer {
  string name = 1;
  string phone = 2;
  string address = 3;
}

message DeliveryStaffInfo {
  string id = 1;
  string name = 2;
  string avatar = 3;
  string status = 4;
  int32 current_deliveries = 5;
}

message ListDeliveriesResponse {
  repeated DeliveryRecord data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 last_page = 5;
  DeliveryStats stats = 6;
}

message DeliveryStats {
  int32 ready_for_delivery = 1;
  int32 in_transit = 2;
  int32 waiting_for_pickup = 3;
}
```

Skipped: `timeline[]` (no table), `failedReason` (no column). Trả null.

### Service — `OrderService.listDeliveries()`

```ts
async listDeliveries(params) {
  const where: Prisma.shipmentsWhereInput = {};
  // ... build where from params

  const [rows, total] = await Promise.all([
    this.prisma.shipments.findMany({
      where,
      include: {
        orders: {
          select: { order_code: true, total_price: true, paid_amount: true, remaining_amount: true },
        },
        users: { select: { id: true, full_name: true, avatar_url: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (params.page - 1) * params.limit, take: params.limit,
    }),
    this.prisma.shipments.count({ where }),
  ]);

  // For each staff, count current deliveries
  const staffIds = [...new Set(rows.filter(r => r.assigned_delivery_staff_id).map(r => r.assigned_delivery_staff_id!))];
  const staffCounts = staffIds.length ? await this.prisma.shipments.groupBy({
    by: ['assigned_delivery_staff_id'],
    where: { assigned_delivery_staff_id: { in: staffIds }, status: 'IN_TRANSIT' },
    _count: true,
  }) : [];
  const staffCountMap = new Map(staffCounts.map(s => [s.assigned_delivery_staff_id, s._count]));

  // Stats
  const stats = await this.prisma.shipments.groupBy({
    by: ['status', 'delivery_method'], _count: true,
  });

  return {
    data: rows.map(s => ({
      id: s.id, order_code: s.orders?.order_code ?? '', tracking_code: s.tracking_code ?? '',
      customer: {
        name: s.recipient_name ?? '', phone: s.recipient_phone ?? '',
        address: s.shipping_address_text ?? '',
      },
      payment_status: computePaymentStatus(s.orders), // paid_amount vs total_price
      delivery_staff: s.users ? {
        id: s.users.id, name: s.users.full_name ?? '', avatar: s.users.avatar_url ?? '',
        status: s.users.status ?? '', current_deliveries: staffCountMap.get(s.users.id) ?? 0,
      } : null,
      status: s.status ?? '',
      proof_of_delivery: null, // SHIPPING không có proof column
      created_at: s.created_at?.toISOString() ?? '',
    })),
    total, page: params.page, limit: params.limit, last_page: Math.ceil(total / params.limit),
    stats: {
      ready_for_delivery: stats.find(s => s.status === 'READY')?._count ?? 0,
      in_transit: stats.find(s => s.status === 'IN_TRANSIT')?._count ?? 0,
      waiting_for_pickup: stats.find(s => s.delivery_method === 'PICKUP' && s.status !== 'COMPLETED')?._count ?? 0,
    },
  };
}
```

`computePaymentStatus()`: nếu `remaining_amount = 0 || remaining_amount === null` → `"paid"`. Nếu `remaining_amount > 0 && total_price === paid_amount` → `"final_pending"`. Else `"cod_pending"`.

### DTO

`libs/common/src/dtos/ecommerce/order/list-deliveries-query.dto.ts`

### api-reference.md

Thêm vào cuối Order section.

---

## 3. Production Stats

| Mục | Giá trị |
|-----|---------|
| Endpoint | `GET /api/v1/admin/dashboard/production-stats` |
| Auth | `dashboard.view` |
| Controller | AdminController (có sẵn) → thêm `@Get('dashboard/production-stats')` |
| Service | AdminService (có sẵn) → thêm `getProductionStats()` |

### Proto

```protobuf
rpc GetProductionStats (Empty) returns (ProductionStatsResponse);

message ProductionStatsResponse {
  int32 total_jewelers = 1;
  int32 in_progress = 2;
  int32 pending_qa = 3;
}
```

### Service — `AdminService.getProductionStats()`

```ts
async getProductionStats() {
  const [taskCountsByStatus, distinctJewelers, pendingQa] = await Promise.all([
    this.prisma.production_tasks.groupBy({ by: ['status'], _count: true }),
    this.prisma.production_tasks.findMany({
      where: { assigned_jeweler_id: { not: null } },
      distinct: ['assigned_jeweler_id'],
      select: { assigned_jeweler_id: true },
    }),
    this.prisma.qa_checks.count({ where: { result: null } }),
  ]);
  const countMap = new Map(taskCountsByStatus.map(t => [t.status, t._count]));
  return {
    total_jewelers: distinctJewelers.length,
    in_progress: countMap.get('IN_PROGRESS') ?? 0,
    pending_qa: pendingQa,
  };
}
```

Skipped: `overdue` (no sla_hours in schema).

### api-reference.md

Thêm sau top-products trong Admin section.

---

## 4. Jeweler Performance

| Mục | Giá trị |
|-----|---------|
| Endpoint | `GET /api/v1/jewelers/me/performance` |
| Auth | `jeweler` role |
| Controller | Controller mới: `JewelerController` |
| Service | Service mới: `JewelerService` |

Ponytail: controller + service minimal, gọn trong 1 file nếu được.

### Proto

```protobuf
rpc GetMyPerformance (GetMyPerformanceRequest) returns (GetMyPerformanceResponse);

message GetMyPerformanceRequest {
  string from_date = 1;  // filter recent_tasks
}

message GetMyPerformanceResponse {
  int32 completed_today = 1;
  int32 completed_shift = 2;
  double qa_pass_rate = 3;
  double avg_hours = 4;
  repeated CompletedTask recent_tasks = 5;
}

message CompletedTask {
  string id = 1;
  string order_code = 2;
  string completed_at = 3;
  string qa_result = 4;
  double duration_hours = 5;
}
```

### Service — `JewelerService.getMyPerformance()`

Endpoint nhận `jewelerId` từ gateway (extract từ JWT token).

```ts
async getMyPerformance(jewelerId: string, fromDate?: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // today's shift
  const shift = await this.prisma.staff_shifts.findFirst({
    where: { staff_id: jewelerId, shift_date: todayStart },
  });

  // all tasks by this jeweler
  const taskWhere: Prisma.production_tasksWhereInput = { assigned_jeweler_id: jewelerId };
  const tasks = await this.prisma.production_tasks.findMany({
    where: taskWhere,
    include: {
      orders: { select: { order_code: true } },
      qa_checks: { select: { result: true } },
    },
  });

  const completed = tasks.filter(t => t.status === 'COMPLETED');
  const completedToday = completed.filter(t => t.completed_at && t.completed_at >= todayStart).length;

  // shift tasks (completed within shift hours)
  let completedShift = 0;
  if (shift?.start_time && shift?.end_time) {
    // compare completed_at with shift start/end on shift_date
    completedShift = completed.filter(t => {
      if (!t.completed_at || t.completed_at < shift.shift_date!) return false;
      // shift times are Time type, need date+time comparison
      const shiftStart = new Date(t.completed_at);
      shiftStart.setHours(shift.start_time!.getHours(), shift.start_time!.getMinutes());
      const shiftEnd = new Date(t.completed_at);
      shiftEnd.setHours(shift.end_time!.getHours(), shift.end_time!.getMinutes());
      return t.completed_at >= shiftStart && t.completed_at <= shiftEnd;
    }).length;
  }

  const qaPassed = tasks.filter(t => t.qa_checks.some(q => q.result === 'PASSED')).length;
  const qaTotal = tasks.filter(t => t.qa_checks.length > 0).length;

  const durations = completed
    .filter(t => t.completed_at && t.started_at)
    .map(t => (t.completed_at!.getTime() - t.started_at!.getTime()) / 3600000);

  // recent tasks (filter by fromDate if provided, limit 20)
  let recentWhere: Prisma.production_tasksWhereInput = { assigned_jeweler_id: jewelerId };
  if (fromDate) recentWhere.completed_at = { gte: new Date(fromDate) };
  const recentTasks = await this.prisma.production_tasks.findMany({
    where: { ...recentWhere, status: 'COMPLETED' },
    orderBy: { completed_at: 'desc' },
    take: 20,
    include: {
      orders: { select: { order_code: true } },
      qa_checks: { select: { result: true } },
    },
  });

  return {
    completed_today: completedToday,
    completed_shift: completedShift,
    qa_pass_rate: qaTotal > 0 ? Number(((qaPassed / qaTotal) * 100).toFixed(1)) : 0,
    avg_hours: durations.length > 0 ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)) : 0,
    recent_tasks: recentTasks.map(t => ({
      id: t.id,
      order_code: t.orders?.order_code ?? '',
      completed_at: t.completed_at?.toISOString() ?? '',
      qa_result: t.qa_checks[0]?.result ?? '',
      duration_hours: t.started_at && t.completed_at
        ? Number(((t.completed_at.getTime() - t.started_at.getTime()) / 3600000).toFixed(1))
        : 0,
    })),
  };
}
```

### Gateway — Controller mới

`apps/api-gateway/src/modules/ecommerce/jeweler/jeweler.controller.ts`

- `@Controller('api/v1/jewelers')`
- `@Get('me/performance')`
- Lấy `jewelerId` từ `req.user.id` (JWT)
- `@Permissions(Permission.DashboardView)` — hoặc permission riêng nếu có

Register controller trong `ecommerce.module.ts`.

### DTO

Không cần DTO riêng — dùng `@Query('from_date')` trực tiếp.

### api-reference.md

Thêm section "Jewelers" mới sau Devices.

---

## Tổng kết

| # | Endpoint | Controller | Service | Proto RPCs | DTOs | File mới |
|---|----------|-----------|---------|-----------|------|----------|
| 1 | `GET /api/v1/customers/guest` | CustomerController ✅ | GuestService ✅ | 1 | 1 | 0 |
| 2 | `GET /api/v1/orders/deliveries` | OrderController ✅ | OrderService ✅ | 1 | 1 | 0 |
| 3 | `GET /api/v1/admin/dashboard/production-stats` | AdminController ✅ | AdminService ✅ | 1 | 0 | 0 |
| 4 | `GET /api/v1/jewelers/me/performance` | JewelerController 🆕 | JewelerService 🆕 | 1 | 0 | 2 |

**Không migration schema. Không model mới.**
