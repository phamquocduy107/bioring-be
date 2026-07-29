# Jeweler Self-Claim Production — Implementation Plan

**Ngày:** 2026-07-28
**Mục tiêu:** Cho phép thợ (jeweler) tự claim job kế tiếp FIFO từ orders đã deposit 2 (DEPOSIT_PAID) mà không cần manager assign thủ công.

---

## Vấn đề

1. `production_tasks` không auto-create khi order lên `DEPOSIT_PAID` → không có gì để hiển thị cho jeweler claim.
2. `GET /orders/production-tasks` require `OrderWrite` → jeweler không có permission.
3. `POST /orders/:id/assign-jeweler` require `OrderWrite` + bắt buộc `jewelerId` từ body → manager mới dùng được.
4. Orders cũ đã `DEPOSIT_PAID` nhưng chưa có production task → cần migration.

---

## Files thay đổi

| # | File | Layer | Action |
|---|------|-------|--------|
| 1 | `libs/common/src/enums/permission.enum.ts` | Common | + `OrderAssign = 'order.assign'` |
| 2 | `libs/common/src/enums/production-task-status.enum.ts` | Common | + `PENDING = 'PENDING'` |
| 3 | `libs/common/src/dtos/ecommerce/production-task/assign-jeweler.dto.ts` | Common | `jewelerId` → optional |
| 4 | `apps/ecommerce-service/src/order/order.service.ts` | Ecommerce | Auto-create PENDING task on DEPOSIT_PAID (2 chỗ webhook + manual) + sửa `assignJeweler` thành update task |
| 5 | `apps/ecommerce-service/src/order/order.controller.ts` | Ecommerce | Pass-through (không đổi) |
| 6 | `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts` | Gateway | `assignJeweler`: bỏ `@Permissions(OrderWrite)` → `@Permissions(OrderAssign)`, thêm `@CurrentUser()`, fallback jewelerId. `getProductionTasks`: `@Permissions(OrderWrite)` → `@Permissions(OrderRead)` |
| 7 | `apps/api-gateway/src/modules/ecommerce/order/order.swagger.ts` | Gateway | Update swagger docs |
| 8 | - | Migration | SQL: INSERT production_tasks cho orders `DEPOSIT_PAID` chưa có task |

---

## Chi tiết

### Fix 1: Add permissions + status enum

**File:** `libs/common/src/enums/permission.enum.ts`
```ts
OrderAssign = 'order.assign',
```

**File:** `libs/common/src/enums/production-task-status.enum.ts`
```ts
export enum ProductionTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
```

### Fix 2: AssignJewelerDto — jewelerId optional

**File:** `libs/common/src/dtos/ecommerce/production-task/assign-jeweler.dto.ts`
```ts
import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignJewelerDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440030' })
  @IsOptional()
  @IsUUID('4')
  jewelerId?: string;
}
```

### Fix 3: Auto-create PENDING task on DEPOSIT_PAID

**File:** `apps/ecommerce-service/src/order/order.service.ts`

**3a. Webhook (`handlePayOSWebhook` ~line 866)**
- Sửa order query: thêm `include: { engraving: true }`
- Sau khi set `newStatus = 'DEPOSIT_PAID'` (DEPOSIT_2 + FULL), tạo task:

```ts
await this.prisma.production_tasks.create({
  data: {
    id: randomUUID(),
    order_id: order.id,
    engraving_id: order.engraving!.id,
    task_name: `Ring production - ${order.order_code}`,
    status: 'PENDING',
  },
});
```

**3b. Manual payment (`manualPayment` ~line 1022)**
- Sửa order query: thêm `include: { engraving: true }`
- Sau khi set `newStatus = 'DEPOSIT_PAID'` (DEPOSIT_2 + FULL), tương tự tạo task (kiểm tra engraving != null)

### Fix 4: Sửa `assignJeweler` service method (~line 1380)

Thay vì `create` mới task IN_PROGRESS:
```ts
const task = await this.prisma.production_tasks.findFirst({
  where: { order_id: orderId, status: 'PENDING' },
});
if (!task) {
  // fallback: không có PENDING task → tạo mới (edge case cho order cũ migration)
  const taskId = randomUUID();
  const task = await this.prisma.production_tasks.create({
    data: {
      id: taskId,
      order_id: orderId,
      engraving_id: order.engraving!.id,
      task_name: `Ring production - ${order.order_code}`,
      status: 'IN_PROGRESS',
      assigned_jeweler_id: jewelerId,
      started_at: new Date(),
    },
    include: this.taskInclude(),
  });
} else {
  await this.prisma.production_tasks.update({
    where: { id: task.id },
    data: {
      assigned_jeweler_id: jewelerId,
      status: 'IN_PROGRESS',
      started_at: new Date(),
    },
  });
}
```

### Fix 5: Gateway controller

**File:** `apps/api-gateway/src/modules/ecommerce/order/order.controller.ts`

**5a. `assignJeweler` (~line 637):**
```ts
@Post(':id/assign-jeweler')
@Permissions(Permission.OrderAssign)
@ApiAssignJewelerDocs()
assignJeweler(
  @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  @Body() body: AssignJewelerDto,
  @CurrentUser() user: JwtPayload,
) {
  const jewelerId = body.jewelerId ?? user.sub;
  return this.call(() =>
    this.grpc!.assignJeweler({ orderId: id, jewelerId }),
  );
}
```

**5b. `getProductionTasks` (~line 429):**
```ts
@Get('production-tasks')
@Permissions(Permission.OrderRead)
@ApiGetProductionTasksDocs()
getProductionTasks(@Query() query: GetProductionTasksQueryDto) {
  ...
}
```

### Fix 6: Migration SQL

Tạo file `libs/prisma/migrations/xxx_backfill_production_tasks.sql`:

```sql
-- Backfill production_tasks for existing DEPOSIT_PAID orders without tasks
INSERT INTO production_tasks (id, order_id, engraving_id, task_name, status, created_at)
SELECT
  gen_random_uuid(),
  o.id,
  e.id,
  CONCAT('Ring production - ', o.order_code),
  'PENDING',
  NOW()
FROM orders o
JOIN engravings e ON e.id = o.engraving_id
WHERE o.status = 'DEPOSIT_PAID'
  AND NOT EXISTS (
    SELECT 1 FROM production_tasks pt WHERE pt.order_id = o.id
  );
```

---

## Sequence

### Jeweler Workbench flow
```
1. Thợ idle → click "Load next job"
2. FE: GET /orders/production-tasks?status=PENDING&page=1&limit=1
   → { status: "PENDING", orderId: "...", task_name: "Ring production - ..." }
3. FE: POST /orders/{orderId}/assign-jeweler (không body, dùng JWT)
   → task set IN_PROGRESS, order → IN_PRODUCTION
4. FE redirect đến trang production detail
```

### Manager assign flow (vẫn giữ)
```
1. Manager mở tab Production Tasks
2. Chọn order → chọn jeweler từ dropdown
3. POST /orders/{orderId}/assign-jeweler { jewelerId }
   → same endpoint, same logic
```

---

## Affected endpoints

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /orders/:id/assign-jeweler` | Require `OrderWrite`, bắt buộc `jewelerId` | Require `OrderAssign`, `jewelerId` optional (fallback JWT) |
| `GET /orders/production-tasks` | Require `OrderWrite` | Require `OrderRead` |
