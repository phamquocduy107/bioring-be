# MF-06: Warranty & Service Claim — Implementation Plan

## 1. Tổng quan

### Mục tiêu
Quản lý bảo hành và dịch vụ sau bán: Customer/Guest tạo yêu cầu bảo hành/sửa chữa, Manager review (miễn phí hoặc báo giá), Staff tiếp nhận sản phẩm, Jeweler sửa chữa, Customer nhận lại.

### Actors
| Actor | Thiết bị | Auth |
|-------|----------|------|
| Customer | App | JWT |
| Guest (Walk-in) | Web | `@Public()` + order_code |
| Manager | Dashboard | JWT + `OrderWrite` |
| Store Staff | Dashboard | JWT + `OrderWrite` |
| Jeweler | Dashboard | JWT + `OrderWrite` |

### Luồng chính
```
[CUSTOMER / GUEST]
  1. Tạo claim:
     - Customer: POST /api/v1/warranty-claims { warrantyId, serviceType, description, proofImages }
     - Guest: POST /api/v1/warranty-claims/lookup { orderCode, serviceType, description, proofImages }
     → claim_code = WCL-XXXXXX, status = PENDING_REVIEW

[MANAGER]
  2. Review claim (PATCH /warranty-claims/:id/review):
     - APPROVED (trong bảo hành): miễn phí → status = APPROVED → PENDING_RECEIVE
     - QUOTATION (ngoài bảo hành): extraFee + manager_note → status = QUOTATION_SENT

[CUSTOMER / GUEST]
  3. Nếu QUOTATION_SENT:
     - PATCH /claims/:id/confirm → customer_confirmed_at
     - Nếu extraFee > 0: status = AWAITING_PAYMENT → POST /claims/:id/payments → PayOS
     - Webhook → PENDING_RECEIVE

[STAFF]
  4. Nhận sản phẩm:
     - POST /service-tickets RECEIVE → service_ticket RECEIVED
     - warranty_claim.status = IN_SERVICE
     - Assign jeweler

[JEWELER]
  5. Sửa chữa xong:
     - PATCH /service-tickets COMPLETE → COMPLETED
     - Cập nhật cost_update nếu có phát sinh

[STAFF]
  6. Trả sản phẩm:
     - PATCH /warranty-claims/:id/return → COMPLETED
```

### So sánh với các flow khác

| | MF-02→MF-05 | MF-06 |
|---|---|---|
| Tạo đơn mới | ✅ | ❌ (tạo claim trên order cũ) |
| Sản xuất mới | ✅ | ❌ (sửa chữa) |
| Thanh toán | Deposit + Remaining | Extra fee (có hoặc không) |
| Guest entry | guest_code | order_code lookup |
| Kết thúc | COMPLETED (order) | COMPLETED (claim) |

---

## 2. Schema — KHÔNG CẦN THAY ĐỔI

Tất cả bảng đã có sẵn:

```prisma
// Bảng chính
model warranty_claims {
  id                   String   @id @db.Uuid
  claim_code           String?  @unique @db.VarChar(100)   // WCL-XXXXXX
  warranty_id          String?  @db.Uuid                   // FK → warranties
  order_id             String   @db.Uuid                   // FK → orders
  engraving_id         String   @db.Uuid                   // FK → engravings
  requested_by_user_id String?  @db.Uuid                   // customer
  guest_customer_id    String?  @db.Uuid                   // guest
  service_type         String?  @db.VarChar(100)           // WARRANTY, CLEANING, ADJUST_SIZE, REPAIR, OTHER
  issue_description    String?
  proof_images         Json?
  proof_videos         Json?
  status               String?  @db.VarChar(100)
  charge_status        String?  @db.VarChar(100)           // FREE, PAID
  extra_fee            Decimal? @db.Decimal(18, 2)
  manager_id           String?  @db.Uuid
  manager_note         String?
  customer_confirmed_at DateTime? @db.Timestamptz(6)
  created_at           DateTime? @db.Timestamptz(6)
  updated_at           DateTime? @db.Timestamptz(6)
  // relations: warranties, orders, engravings, users, guest_customers,
  //            service_tickets[], staff_assignments[], payments[]
}

model service_tickets {
  id                   String   @id @db.Uuid
  ticket_code          String?  @unique @db.VarChar(100)   // SVT-XXXXXX
  warranty_claim_id    String   @db.Uuid                   // FK → warranty_claims
  assigned_staff_id    String?  @db.Uuid
  assigned_jeweler_id  String?  @db.Uuid
  service_type         String?  @db.VarChar(100)
  description          String?
  status               String?  @db.VarChar(100)           // PENDING, RECEIVED, IN_PROGRESS, COMPLETED
  received_product_at  DateTime? @db.Timestamptz(6)
  service_started_at   DateTime? @db.Timestamptz(6)
  service_completed_at DateTime? @db.Timestamptz(6)
  result_note          String?
  cost_update          Decimal? @db.Decimal(18, 2)
  created_at           DateTime? @db.Timestamptz(6)
  updated_at           DateTime? @db.Timestamptz(6)
}

// Bảng đã có: warranties, staff_assignments, service_ticket_updates
// payments.warranty_claim_id có sẵn cho extra fee payment
```

---

## 3. New files

| # | File path | Mục đích |
|---|-----------|----------|
| 1 | `libs/common/src/enums/warranty-claim-status.enum.ts` | Enum WarrantyClaimStatus |
| 2 | `libs/common/src/enums/service-ticket-status.enum.ts` | Enum ServiceTicketStatus |
| 3 | `libs/common/src/enums/service-type.enum.ts` | Enum ServiceType |
| 4 | `libs/common/src/dtos/ecommerce/warranty/create-claim.dto.ts` | DTO tạo claim |
| 5 | `libs/common/src/dtos/ecommerce/warranty/claim-lookup.dto.ts` | DTO guest tạo claim |
| 6 | `libs/common/src/dtos/ecommerce/warranty/review-claim.dto.ts` | DTO manager review |
| 7 | `libs/common/src/dtos/ecommerce/warranty/confirm-claim.dto.ts` | DTO customer confirm |
| 8 | `libs/common/src/dtos/ecommerce/warranty/receive-service.dto.ts` | DTO staff nhận sp |
| 9 | `libs/common/src/dtos/ecommerce/warranty/complete-service.dto.ts` | DTO jeweler hoàn thành |
| 10 | `libs/common/src/dtos/ecommerce/warranty/return-claim.dto.ts` | DTO trả sp |
| 11 | `libs/common/src/dtos/ecommerce/warranty/index.ts` | Barrel |
| 12 | `apps/ecommerce-service/src/warranty/warranty.module.ts` | Module warranty |
| 13 | `apps/ecommerce-service/src/warranty/warranty.controller.ts` | gRPC controller |
| 14 | `apps/ecommerce-service/src/warranty/warranty.service.ts` | Business logic |
| 15 | `apps/api-gateway/.../warranty/warranty.controller.ts` | HTTP routes |
| 16 | `apps/api-gateway/.../warranty/warranty.swagger.ts` | Swagger docs |

---

## 4. Modified files

| # | File path | Thay đổi |
|---|-----------|----------|
| 1 | `proto/ecommerce.proto` | Thêm 9 RPCs + messages |
| 2 | `apps/ecommerce-service/src/ecommerce-service.module.ts` | Import WarrantyModule |
| 3 | `apps/api-gateway/.../ecommerce.module.ts` | Register WarrantyController |
| 4 | `libs/common/src/enums/index.ts` | Export enums mới |
| 5 | `libs/common/src/dtos/ecommerce/index.ts` | Export warranty DTOs |

---

## 5. Implementation Steps

### Step 1: Enums

```typescript
// warranty-claim-status.enum.ts
export enum WarrantyClaimStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  QUOTATION_SENT = 'QUOTATION_SENT',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PENDING_RECEIVE = 'PENDING_RECEIVE',
  IN_SERVICE = 'IN_SERVICE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// service-ticket-status.enum.ts
export enum ServiceTicketStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// service-type.enum.ts
export enum ServiceType {
  WARRANTY = 'WARRANTY',
  CLEANING = 'CLEANING',
  ADJUST_SIZE = 'ADJUST_SIZE',
  REPAIR = 'REPAIR',
  OTHER = 'OTHER',
}
```

### Step 2: Proto

Thêm 9 RPCs vào `proto/ecommerce.proto`:

```protobuf
// MF-06: Warranty & Service Claim
rpc CreateWarrantyClaim (CreateWarrantyClaimRequest) returns (CreateWarrantyClaimResponse);
rpc CreateWarrantyClaimByLookup (CreateWarrantyClaimByLookupRequest) returns (CreateWarrantyClaimResponse);
rpc GetWarrantyClaim (GetWarrantyClaimRequest) returns (GetWarrantyClaimResponse);
rpc GetMyWarrantyClaims (GetMyWarrantyClaimsRequest) returns (GetMyWarrantyClaimsResponse);
rpc ReviewWarrantyClaim (ReviewWarrantyClaimRequest) returns (GetWarrantyClaimResponse);
rpc ConfirmWarrantyClaim (ConfirmWarrantyClaimRequest) returns (GetWarrantyClaimResponse);
rpc InitiateClaimPayment (InitiateClaimPaymentRequest) returns (InitiatePaymentResponse);
rpc ReceiveServiceTicket (ReceiveServiceTicketRequest) returns (GetWarrantyClaimResponse);
rpc CompleteServiceTicket (CompleteServiceTicketRequest) returns (GetWarrantyClaimResponse);
rpc ReturnWarrantyClaim (ReturnWarrantyClaimRequest) returns (GetWarrantyClaimResponse);
```

Messages:
```protobuf
message WarrantyClaim {
  string id = 1;
  string claimCode = 2;
  string warrantyId = 3;
  string orderId = 4;
  string serviceType = 5;
  string issueDescription = 6;
  repeated string proofImages = 7;
  string status = 8;
  string chargeStatus = 9;
  double extraFee = 10;
  string managerNote = 11;
  string customerConfirmedAt = 12;
  string createdAt = 13;
  repeated ServiceTicket serviceTickets = 14;
}

message ServiceTicket {
  string id = 1;
  string ticketCode = 2;
  string warrantyClaimId = 3;
  string assignedStaffId = 4;
  string assignedJewelerId = 5;
  string assignedJewelerName = 6;
  string status = 7;
  string receivedProductAt = 8;
  string serviceCompletedAt = 9;
  string resultNote = 10;
  double costUpdate = 11;
}

message CreateWarrantyClaimRequest {
  string warrantyId = 1;
  string orderId = 2;
  string serviceType = 3;
  string issueDescription = 4;
  repeated string proofImages = 5;
  repeated string proofVideos = 6;
  string userId = 7;
}

message CreateWarrantyClaimByLookupRequest {
  string orderCode = 1;
  string serviceType = 2;
  string issueDescription = 3;
  repeated string proofImages = 4;
  repeated string proofVideos = 5;
}

message CreateWarrantyClaimResponse { WarrantyClaim claim = 1; }
message GetWarrantyClaimRequest { string id = 1; }
message GetWarrantyClaimResponse { WarrantyClaim claim = 1; }

message GetMyWarrantyClaimsRequest {
  string userId = 1;
  int32 page = 2;
  int32 limit = 3;
}

message GetMyWarrantyClaimsResponse {
  repeated WarrantyClaim data = 1;
  int32 total = 2;
  int32 page = 3;
  int32 limit = 4;
  int32 lastPage = 5;
}

message ReviewWarrantyClaimRequest {
  string id = 1;
  string action = 2;          // "approve" | "quotation" | "reject"
  double extraFee = 3;
  string managerNote = 4;
  string managerId = 5;
}

message ConfirmWarrantyClaimRequest {
  string id = 1;
  string userId = 2;
}

message InitiateClaimPaymentRequest {
  string claimId = 1;
  string userId = 2;
  string returnUrl = 3;
  string cancelUrl = 4;
}

message ReceiveServiceTicketRequest {
  string claimId = 1;
  string conditionNote = 2;
  repeated string receivedImages = 3;
  string jewelerId = 4;
  string staffId = 5;
}

message CompleteServiceTicketRequest {
  string claimId = 1;
  string resultNote = 2;
  double costUpdate = 3;
  string jewelerId = 4;
}

message ReturnWarrantyClaimRequest {
  string id = 1;
  string staffId = 2;
}
```

### Step 3: DTOs

6 DTO files, mỗi cái có `@ApiProperty()` + `class-validator` decorators.

### Step 4: Warranty Service

```typescript
@Injectable()
export class WarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payOS: PayOSService,
  ) {}

  // 1. Tạo claim (customer)
  async createClaim(data: {
    warrantyId: string; orderId: string; serviceType: string;
    issueDescription: string; proofImages: string[];
    proofVideos: string[]; userId: string;
  }) {
    // Validate warranty thuộc order
    // Validate user sở hữu order
    // Tạo warranty_claim + claim_code WCL-XXXXXX
    // Tạo kèm 1 service_ticket (PENDING)
  }

  // 2. Tạo claim (guest — lookup order_code)
  async createClaimByLookup(data: {
    orderCode: string; serviceType: string;
    issueDescription: string; proofImages: string[]; proofVideos: string[];
  }) {
    // Tìm order + warranty theo order_code
    // Tạo claim với guest_customer_id
  }

  // 3. Manager review
  async reviewClaim(id: string, action: string, extraFee: number,
                    managerNote: string, managerId: string) {
    // approve → APPROVED → PENDING_RECEIVE (free)
    // quotation → QUOTATION_SENT (extraFee + note)
    // reject → REJECTED
  }

  // 4. Customer confirm quotation
  async confirmClaim(id: string, userId: string) {
    // Validate claim thuộc user
    // extraFee > 0 → AWAITING_PAYMENT
    // extraFee = 0 → PENDING_RECEIVE
  }

  // 5. Pay extra fee
  async initiateClaimPayment(claimId: string, userId: string,
                              returnUrl: string, cancelUrl: string) {
    // Tạo PayOS payment (warranty_claim_id)
    // Webhook → PENDING_RECEIVE
  }

  // 6. Staff nhận sản phẩm
  async receiveServiceTicket(claimId: string, data: {
    conditionNote: string; receivedImages: string[];
    jewelerId: string; staffId: string;
  }) {
    // service_ticket → RECEIVED, received_product_at
    // warranty_claim → IN_SERVICE
    // staff_assignments → assign jeweler
  }

  // 7. Jeweler hoàn thành
  async completeServiceTicket(claimId: string, data: {
    resultNote: string; costUpdate: number; jewelerId: string;
  }) {
    // service_ticket → COMPLETED, result_note, cost_update
    // service_completed_at = now
  }

  // 8. Staff trả sản phẩm
  async returnClaim(id: string, staffId: string) {
    // Validate service_ticket COMPLETED
    // warranty_claim → COMPLETED
  }

  // 9. Get claim detail
  async getClaim(id: string) {
    // Include service_tickets + payments + warranty
  }

  // 10. List claims của user
  async getMyClaims(userId: string, page: number, limit: number) {
    // Paginate warranty_claims where requested_by_user_id = userId
  }
}
```

### Step 5: Gateway

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| `POST` | `/api/v1/warranty-claims` | JWT | Customer tạo claim |
| `POST` | `/api/v1/warranty-claims/lookup` | Public | Guest tạo claim |
| `GET` | `/api/v1/warranty-claims` | JWT | List claims |
| `GET` | `/api/v1/warranty-claims/:id` | JWT | Detail claim |
| `PATCH` | `/api/v1/warranty-claims/:id/review` | OrderWrite | Manager review |
| `PATCH` | `/api/v1/warranty-claims/:id/confirm` | JWT | Customer confirm |
| `POST` | `/api/v1/warranty-claims/:id/payments` | JWT | Pay extra fee |
| `POST` | `/api/v1/warranty-claims/:id/receive` | OrderWrite | Staff nhận sp |
| `PATCH` | `/api/v1/warranty-claims/:id/complete` | OrderWrite | Jeweler complete |
| `PATCH` | `/api/v1/warranty-claims/:id/return` | OrderWrite | Staff trả sp |

---

## 6. Status machine

```
[CUSTOMER create] → PENDING_REVIEW
                         │
  ┌──────────────────────┼──────────────────────┐
  │ approve              │ quotation            │ reject
  ▼                      ▼                      ▼
APPROVED            QUOTATION_SENT           REJECTED
  │                      │
  │                 [customer confirm]
  │                      │
  ├── extraFee=0 ────────┤── extraFee>0
  │                      ▼
  │               AWAITING_PAYMENT
  │                      │ [pay / webhook]
  └──────────────────────┴──→ PENDING_RECEIVE
                                   │
                            [staff receive]
                                   ▼
                              IN_SERVICE
                                   │
                            [jeweler complete]
                                   ▼
                          (chờ staff return)
                                   │
                            [staff return]
                                   ▼
                              COMPLETED
```

---

## 7. Acceptance criteria

| # | Tiêu chí | Verify |
|---|----------|--------|
| 1 | Customer POST /warranty-claims → claim PENDING_REVIEW + WCL-XXXXXX | curl + DB |
| 2 | Guest POST /warranty-claims/lookup → tạo claim từ order_code | curl + DB |
| 3 | Manager approve → APPROVED → PENDING_RECEIVE | curl + DB |
| 4 | Manager quotation → QUOTATION_SENT + extraFee | curl + DB |
| 5 | Customer confirm (free) → PENDING_RECEIVE | curl + DB |
| 6 | Customer confirm (paid) → AWAITING_PAYMENT → pay → PENDING_RECEIVE | curl + DB |
| 7 | Staff receive → IN_SERVICE, ticket RECEIVED | curl + DB |
| 8 | Jeweler complete → ticket COMPLETED + cost_update | curl + DB |
| 9 | Staff return → COMPLETED | curl + DB |
| 10 | GET /warranty-claims → paginated, `?? []` fallback | curl |
| 11 | GET /warranty-claims/:id → detail + tickets + payments | curl |
| 12 | Swagger docs đầy đủ | check /docs |
| 13 | Build không lỗi | npm run build |

---

## 8. Tổng kết files

| Loại | Số lượng |
|------|---------|
| Files mới | 16 |
| Files sửa | 5 |
| Migration | 0 |
| RPCs mới | 10 |
| HTTP endpoints mới | 10 |
| DTOs mới | 7 |
