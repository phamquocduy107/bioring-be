# QR Memories & Card Themes — Schema & API Reference

> Verified against code — Last updated: 2026-07-27

---

## DB Schema

### `card_themes`

```prisma
model card_themes {
  id             String        @id @db.Uuid
  theme_code     String        @unique @db.VarChar(100)
  name           String        @db.VarChar(255)
  default_bg_url String?       @db.VarChar(500)
  style_config   Json?
  is_active      Boolean?      @default(true)
  created_at     DateTime?     @db.Timestamptz(6)
  qr_memories    qr_memories[]
}
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `theme_code` | VARCHAR(100) | UNIQUE, VD: "VALENTINE" |
| `name` | VARCHAR(255) | |
| `default_bg_url` | VARCHAR(500)? | URL ảnh nền mặc định |
| `style_config` | JSON? | VD: `{"fontColor":"#FF69B4","fontFamily":"serif"}` |
| `is_active` | boolean? | default true |
| `created_at` | timestamptz? | |

---

### `qr_memories`

```prisma
model qr_memories {
  id                          String                  @id @db.Uuid
  engraving_id                String                  @unique @db.Uuid
  theme_id                    String?                 @db.Uuid
  qr_code                     String                  @unique @db.VarChar(255)
  landing_page_url            String?                 @db.VarChar(500)
  access_pin_hash             String?                 @db.VarChar(255)
  card_title                  String?                 @db.VarChar(255)
  greeting_message            String?
  custom_images               Json?
  biometric_display_settings  Json?
  is_locked                   Boolean?                @default(false)
  failed_attempts             Int?                    @default(0)
  activated_at                DateTime?               @db.Timestamptz(6)
  created_at                  DateTime?               @db.Timestamptz(6)
  updated_at                  DateTime?               @db.Timestamptz(6)
  recipient_email             String?                 @db.VarChar(255)
  shared_at                   DateTime?               @db.Timestamptz(6)
  shared_user_id              String?                 @db.Uuid

  engravings                  engravings              @relation(fields: [engraving_id], references: [id])
  users                       users?                  @relation(fields: [shared_user_id], references: [id])
  card_themes                 card_themes?            @relation(fields: [theme_id], references: [id])
  qr_memory_access_logs       qr_memory_access_logs[]
}
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `engraving_id` | UUID FK → engravings | UNIQUE |
| `theme_id` | UUID? FK → card_themes | |
| `qr_code` | VARCHAR(255) | UNIQUE, auto-gen 12 hex chars |
| `landing_page_url` | VARCHAR(500)? | |
| `access_pin_hash` | VARCHAR(255)? | SHA256 của PIN mặc định "123456" |
| `card_title` | VARCHAR(255)? | |
| `greeting_message` | text? | |
| `custom_images` | JSON? | VD: `{"images":[{"url":"...","position":"top"}]}` |
| `biometric_display_settings` | JSON? | VD: `{"showWaveform":true,"playbackSpeed":1.0}` |
| `is_locked` | boolean? | default false |
| `failed_attempts` | int? | default 0 |
| `activated_at` | timestamptz? | |
| `created_at` | timestamptz? | |
| `updated_at` | timestamptz? | |
| `recipient_email` | VARCHAR(255)? | |
| `shared_at` | timestamptz? | |
| `shared_user_id` | UUID? FK → users | |

---

## Response Shapes

### CardThemeResponse (dùng chung cho tất cả endpoints card theme)

```json
{
  "id":           "550e8400-e29b-41d4-a716-446655440010",
  "themeCode":    "VALENTINE",
  "name":         "Valentine Theme",
  "defaultBgUrl": "https://minio.example/themes/bg.jpg",
  "styleConfig":  "{\"fontColor\":\"#FF69B4\"}",
  "isActive":     true,
  "createdAt":    "2026-07-23T15:12:08.037Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string UUID | |
| `themeCode` | string | |
| `name` | string | |
| `defaultBgUrl` | string | `''` nếu null trong DB |
| `styleConfig` | string | JSON string, `''` nếu null |
| `isActive` | boolean | |
| `createdAt` | string ISO | |

---

### QrMemoryResponse — Shape A (MemoryCardService)

Dùng bởi các endpoint:
- `PUT /api/v1/qr-memories/:engravingId`
- `GET /api/v1/qr-memories/:engravingId`
- `GET /api/v1/qr-memories/code/:qrCode`
- `POST /api/v1/qr-memories/activate`
- `GET /api/v1/qr-memories` (list — mảng)
- `PUT /api/v1/guest-tablet/qr-memories/:engravingId`

```json
{
  "id":                       "550e8400-e29b-41d4-a716-446655440001",
  "engravingId":              "550e8400-e29b-41d4-a716-446655440002",
  "qrCode":                   "a1b2c3d4e5f6",
  "cardTitle":                "Our Special Ring",
  "greetingMessage":          "Thank you for being with me!",
  "recipientEmail":           "friend@example.com",
  "customImages":             "{\"images\":[{\"url\":\"https://...\",\"position\":\"top\"}]}",
  "biometricDisplaySettings": "{\"showWaveform\":true,\"playbackSpeed\":1.0}",
  "isLocked":                 false,
  "cardTheme": {
    "id":             "550e8400-e29b-41d4-a716-446655440010",
    "themeCode":      "VALENTINE",
    "name":           "Valentine Theme",
    "defaultBgUrl":   "https://minio.example/themes/bg.jpg",
    "styleConfig":    "{\"fontColor\":\"#FF69B4\"}",
    "isActive":       true,
    "createdAt":      "2026-07-23T15:12:08.037Z"
  },
  "createdAt":                "2026-07-23T15:12:08.037Z",
  "updatedAt":                "2026-07-23T15:12:08.037Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string UUID | |
| `engravingId` | string UUID | |
| `qrCode` | string | 12 hex chars |
| `cardTitle` | string | `''` nếu null |
| `greetingMessage` | string | `''` nếu null |
| `recipientEmail` | string | `''` nếu null |
| `customImages` | string | JSON string, `''` nếu null |
| `biometricDisplaySettings` | string | JSON string, `''` nếu null |
| `isLocked` | boolean | default `false` |
| `cardTheme` | object \| null | CardThemeResponse, `null` nếu chưa chọn theme |
| `createdAt` | string ISO | |
| `updatedAt` | string ISO | |

---

### QrMemoryResponse — Shape B (EngravingService)

Dùng bởi các endpoint:
- `GET /api/v1/engravings/:id` (embedded trong engraving)
- `POST /api/v1/engravings` (embedded)
- `GET /api/v1/guest-tablet/sessions/:guestCode` (embedded trong order.engraving)

```json
{
  "id":                       "550e8400-e29b-41d4-a716-446655440001",
  "engravingId":              "550e8400-e29b-41d4-a716-446655440002",
  "qrCode":                   "a1b2c3d4e5f6",
  "cardTitle":                "Our Special Ring",
  "greetingMessage":          "Thank you for being with me!",
  "recipientEmail":           "friend@example.com",
  "biometricDisplaySettings": {"showWaveform":true,"playbackSpeed":1.0},
  "accessPinHash":            "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
  "isLocked":                 true,
  "cardTheme": {
    "id":             "550e8400-e29b-41d4-a716-446655440010",
    "themeCode":      "VALENTINE",
    "name":           "Valentine Theme",
    "defaultBgUrl":   "https://minio.example/themes/bg.jpg",
    "styleConfig":    "{\"fontColor\":\"#FF69B4\"}",
    "isActive":       true,
    "createdAt":      "2026-07-23T15:12:08.037Z"
  },
  "createdAt":                "2026-07-23T15:12:08.037Z",
  "updatedAt":                "2026-07-23T15:12:08.037Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string UUID | |
| `engravingId` | string UUID | |
| `qrCode` | string | `''` nếu null |
| `cardTitle` | string | `''` nếu null |
| `greetingMessage` | string | `''` nếu null |
| `recipientEmail` | string | `''` nếu null |
| `biometricDisplaySettings` | object \| string | **raw từ DB** (không JSON.stringify), `''` nếu null |
| `accessPinHash` | string | `''` nếu null |
| `isLocked` | boolean | default **`true`** (khác Shape A) |
| `cardTheme` | object \| null | CardThemeResponse |
| `createdAt` | string ISO | |
| `updatedAt` | string ISO | |

**Khác biệt với Shape A:**
- ❌ Không có `customImages`
- ✅ Có `accessPinHash`
- `biometricDisplaySettings` là raw object, không phải JSON string
- `isLocked` default `true`

---

## I. CARD THEMES APIs

### 1. GET `/api/v1/card-themes` — List all themes

**Auth:** `@Public()` — không cần token

#### Request

```
GET /api/v1/card-themes?page=1&limit=10
```

| Query | Type | Default | Description |
|---|---|---|---|
| `page` | number? | 1 | Page number |
| `limit` | number? | 10 | Items per page |

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "cardThemes": [ /* CardThemeResponse[] */ ],
    "total":  5,
    "page":   1,
    "limit":  10
  }
}
```

---

### 2. GET `/api/v1/card-themes/:id` — Get single theme

**Auth:** `@Public()` — không cần token

#### Request

| Param | Type | Description |
|---|---|---|
| `id` | string UUID v4 | Card theme ID |

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "cardTheme": { /* CardThemeResponse */ }
  }
}
```

#### Errors
- `404` — Card theme not found

---

### 3. POST `/api/v1/card-themes` — Create theme

**Auth:** `@Permissions(DesignWrite)` — admin

#### Request Body

```json
{
  "themeCode":     "VALENTINE",                              // string, required, unique
  "name":          "Valentine Theme",                        // string, required
  "defaultBgUrl":  "https://minio.example/themes/bg.jpg",    // string?, optional
  "styleConfig":   "{\"fontColor\":\"#FF69B4\"}"             // string? (JSON), optional
}
```

Logic: `styleConfig` parse từ JSON string → lưu JSON vào DB.

#### Response 201

```json
{
  "statusCode": 201,
  "message": "Created",
  "data": {
    "cardTheme": { /* CardThemeResponse */ }
  }
}
```

#### Errors
- `409` — Card theme code already exists (duplicate `themeCode`)

---

### 4. PUT `/api/v1/card-themes/:id` — Update theme

**Auth:** `@Permissions(DesignWrite)` — admin

#### Request

| Param | Type | Description |
|---|---|---|
| `id` | string UUID v4 | Card theme ID |

#### Request Body

```json
{
  "themeCode":     "VALENTINE_2026",                         // string?, optional
  "name":          "Valentine 2026 Theme",                   // string?, optional
  "defaultBgUrl":  "https://minio.example/themes/new-bg.jpg",// string?, optional
  "styleConfig":   "{\"fontColor\":\"#FF0000\"}"             // string? (JSON), optional
}
```

Chỉ update field nào `!== undefined`. `styleConfig` parse JSON trước lưu.

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "cardTheme": { /* CardThemeResponse */ }
  }
}
```

#### Errors
- `404` — Card theme not found
- `409` — Card theme code already exists

---

### 5. DELETE `/api/v1/card-themes/:id` — Delete theme

**Auth:** `@Permissions(DesignWrite)` — admin

#### Request

| Param | Type | Description |
|---|---|---|
| `id` | string UUID v4 | Card theme ID |

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "success": true
  }
}
```

#### Errors
- `404` — Card theme not found

---

## II. QR MEMORIES APIs (Shape A)

### 6. GET `/api/v1/qr-memories/code/:qrCode` — Get by QR code

**Auth:** `@Public()`

#### Request

| Param | Type | Description |
|---|---|---|
| `qrCode` | string | QR code value (12 hex chars, VD: `"a1b2c3d4e5f6"`) |

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "qrMemory": { /* Shape A */ }
  }
}
```

#### Errors
- `404` — QR memory not found

---

### 7. POST `/api/v1/qr-memories/activate` — Activate / unlock

**Auth:** `@Public()`

#### Request Body

```json
{
  "qrCode":    "a1b2c3d4e5f6",    // string, required
  "accessPin": "123456"            // string, required, min 4 chars
}
```

Logic:
1. `findUnique` by `qr_code`
2. `SHA256(accessPin)` so sánh với `access_pin_hash`
3. Nếu match → `update` set `is_locked=false`, `activated_at=now()`

#### Response 201

```json
{
  "statusCode": 201,
  "message": "Created",
  "data": {
    "qrMemory": { /* Shape A — isLocked: false */ }
  }
}
```

#### Errors
- `404` — QR memory not found
- `403` — Invalid access PIN

---

### 8. GET `/api/v1/qr-memories/:engravingId` — Get by engraving

**Auth:** Bearer token (authenticated user) — engraving phải thuộc về user

#### Request

| Param | Type | Description |
|---|---|---|
| `engravingId` | string UUID v4 | Engraving ID |

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "qrMemory": { /* Shape A */ }
  }
}
```

#### Errors
- `404` — QR memory not found for this engraving

---

### 9. PUT `/api/v1/qr-memories/:engravingId` — Update memory card

**Auth:** Bearer token (authenticated user) — engraving phải thuộc về user

#### Request

| Param | Type | Description |
|---|---|---|
| `engravingId` | string UUID v4 | Engraving ID |

#### Request Body

```json
{
  "cardTitle":                "Our Special Ring",                              // string?, max 200
  "greetingMessage":          "Thank you for being with me!",                  // string?, max 1000
  "recipientEmail":           "friend@example.com",                            // string?
  "cardThemeId":              "550e8400-e29b-41d4-a716-446655440010",          // string? UUID v4
  "customImages":             "{\"images\":[{\"url\":\"...\",\"position\":\"top\"}]}",  // string? (JSON)
  "biometricDisplaySettings": "{\"showWaveform\":true,\"playbackSpeed\":1.0}",          // string? (JSON)
  "accessPin":                "2048"                                                      // string?, 4-10 chars
}
```

Logic trong `MemoryCardService.updateQrMemory()`:
1. `findUnique` by `engraving_id` — `404` nếu không tìm thấy
2. Build `updateData`: chỉ set field `!== undefined`
3. `customImages`/`biometricDisplaySettings`: `JSON.parse(data.xxx)` → lưu JSON
4. `accessPin`: `SHA256(data.accessPin)` → lưu hash
5. `update` với `include: { card_themes: true }` → `mapQrMemory()`

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "qrMemory": { /* Shape A */ }
  }
}
```

#### Errors
- `404` — QR memory not found for this engraving

---

### 10. GET `/api/v1/qr-memories` — List my memories

**Auth:** Bearer token (authenticated user) — lấy memories của engraving thuộc user

#### Request

| Query | Type | Default | Description |
|---|---|---|---|
| `page` | number? | 1 | |
| `limit` | number? | 10 | |

Logic: `findMany where engravings.user_id = :userId`, `orderBy created_at desc`.

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "qrMemories": [ /* Shape A[] */ ],
    "total":  5,
    "page":   1,
    "limit":  10
  }
}
```

---

### 11. POST `/api/v1/qr-memories/upload-photo` — Upload photo

**Auth:** Bearer token (authenticated user)

#### Request

```
Content-Type: multipart/form-data

file: (binary, required) — image (jpg, png, webp)
```

Upload lên MinIO:
- key = `qr-photos/{uuid}.{ext}`
- bucket = default bucket từ config
- public URL = `{MINIO_PUBLIC_ENDPOINT}/{bucket}/{key}`

#### Response 201

```json
{
  "statusCode": 201,
  "message": "Created",
  "data": {
    "url": "http://localhost:9000/bioring/qr-photos/550e8400-e29b-41d4-a716-446655440999.jpg"
  }
}
```

---

### 12. PUT `/api/v1/guest-tablet/qr-memories/:engravingId` — Guest update

**Auth:** `@Public()` — xác thực bằng `guestCode`

#### Request

| Param | Type | Description |
|---|---|---|
| `engravingId` | string UUID v4 | |

#### Request Body

```json
{
  "guestCode":                "GUE-A7B9X2",                            // string, required
  "cardTitle":                "Our Special Ring",                      // string?, optional
  "greetingMessage":          "Thank you for being with me!",          // string?, optional
  "recipientEmail":           "friend@example.com",                    // string?, optional
  "cardThemeId":              "550e8400-e29b-41d4-a716-446655440010", // string? UUID v4, optional
  "customImages":             "{\"images\":[{\"url\":\"...\"}]}",      // string? (JSON), optional
  "biometricDisplaySettings": "{\"showWaveform\":true}"                // string? (JSON), optional
}
```

Không có `accessPin` — guest không được đổi PIN.

#### Logic
1. `GuestService.guestUpdateQrMemory()`
2. `validateGuestOwnership(guestCode, { engravingId })` — verify guest sở hữu engraving này
3. Delegate vào `MemoryCardService.updateQrMemory()` → response **Shape A**

#### Response 200

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "qrMemory": { /* Shape A */ }
  }
}
```

#### Errors
- `403` — Invalid guest code
- `404` — QR memory not found

---

## III. SIDE-EFFECT APIs (unlock qr_memories)

### 13. POST `/api/v1/orders/:id/confirm-pickup` — Unlock on pickup

**Auth:** `@Permissions(OrderWrite)` — staff

Staff confirm pickup → unlock qr_memories của engraving trong order:

```
UPDATE qr_memories SET is_locked = false WHERE engraving_id = order.engraving.id
```

#### Response includes

```json
{
  "success": true,
  "order": { /* OrderResponse */ },
  "warrantyCode": "WAR-XXXXXX",
  "warrantyExpiry": "2027-07-27T00:00:00.000Z",
  "qrMemoryUnlocked": true
}
```

---

### 14. PUT `/api/v1/orders/:id/shipment/status` — Unlock on DELIVERED

**Auth:** `@Permissions(OrderWrite)` — staff

Khi status = `DELIVERED`:

```
UPDATE qr_memories SET is_locked = false WHERE engraving_id = order.engraving.id AND is_locked = true
```

---

## IV. QR MEMORY EMBEDDED IN ENGRAVING / SESSION (Shape B)

### GET `/api/v1/engravings/:id` — Get engraving

**Auth:** Bearer token

#### Response (qrMemory part)

```json
{
  "id":                "550e8400-e29b-41d4-a716-446655440002",
  "orderId":           "550e8400-e29b-41d4-a716-446655440003",
  "userId":            "550e8400-e29b-41d4-a716-446655440004",
  "productId":         "550e8400-e29b-41d4-a716-446655440005",
  "uniqueProductId":   "RING-SIZE6-GOLD",
  "approvedVersionId": "550e8400-e29b-41d4-a716-446655440006",
  "status":            "ACTIVE",
  "versions":          [ /* EngravingVersionResponse[] */ ],
  "biometricAssets":   [ /* BiometricAssetBrief[] */ ],
  "qrMemory": {                    /* Shape B — object | null */
    "id":                       "550e8400-e29b-41d4-a716-446655440001",
    "engravingId":              "550e8400-e29b-41d4-a716-446655440002",
    "qrCode":                   "a1b2c3d4e5f6",
    "cardTitle":                "Our Special Ring",
    "greetingMessage":          "Thank you for being with me!",
    "recipientEmail":           "friend@example.com",
    "biometricDisplaySettings": {"showWaveform":true,"playbackSpeed":1.0},
    "accessPinHash":            "8d969eef6ecad3c29a3a629280e686cf",
    "isLocked":                 true,
    "cardTheme": {
      "id":             "550e8400-e29b-41d4-a716-446655440010",
      "themeCode":      "VALENTINE",
      "name":           "Valentine Theme",
      "defaultBgUrl":   "https://minio.example/themes/bg.jpg",
      "styleConfig":    "{\"fontColor\":\"#FF69B4\"}",
      "isActive":       true,
      "createdAt":      "2026-07-23T15:12:08.037Z"
    },
    "createdAt":                "2026-07-23T15:12:08.037Z",
    "updatedAt":                "2026-07-23T15:12:08.037Z"
  },
  "currentVersion":  { /* EngravingVersionResponse */ },
  "product":         { /* ProductBriefResponse */ }
}
```

### GET `/api/v1/guest-tablet/sessions/:guestCode` — Get session

**Auth:** `@Public()`

qrMemory nằm trong `order.engraving.qrMemory` với **Shape B**.

---

## V. FLOW TẠO qr_memories

QR memory được tạo tự động khi tạo engraving (3 nơi, giống nhau):

```ts
const qrCode = randomBytes(6).toString('hex');   // VD: "a1b2c3d4e5f6"
const accessPinHash = createHash('sha256').update('123456').digest('hex');

await prisma.qr_memories.create({
  data: {
    id: randomUUID(),
    engraving_id: engravingId,
    qr_code: qrCode,
    access_pin_hash: accessPinHash,
    is_locked: true,
  },
});
```

| Nơi tạo | File | Method |
|---|---|---|
| Mobile user | `engraving/engraving.service.ts` | `createEngraving()` |
| Claim design | `design/design.service.ts` | `claimDesignDraft()` |
| Guest tablet | `guest/guest.service.ts` | `createGuestEngraving()` |

Default: QR code = 12 hex chars, PIN = `123456` (hashed), `is_locked = true`.

---

## VI. FLOW UNLOCK (is_locked → false)

| Event | Trigger | File |
|---|---|---|
| Guest/public nhập đúng PIN | `POST /api/v1/qr-memories/activate` | `memory-card/memory-card.service.ts` |
| Staff confirm pickup | `POST /api/v1/orders/:id/confirm-pickup` | `order/order.service.ts` |
| Shipper giao thành công | `PUT /api/v1/orders/:id/shipment/status` (DELIVERED) | `order/order.service.ts` |
| Guest register → user (cùng email) | `AuthService.shareQrMemories()` | `identity/auth/auth.service.ts` |

---

## VII. TỔNG HỢP APIs

| # | Method | Path | Auth | Shape | Mục đích |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/v1/card-themes` | Public | — | List card themes |
| 2 | `GET` | `/api/v1/card-themes/:id` | Public | — | Get single theme |
| 3 | `POST` | `/api/v1/card-themes` | DesignWrite | — | Create theme |
| 4 | `PUT` | `/api/v1/card-themes/:id` | DesignWrite | — | Update theme |
| 5 | `DELETE` | `/api/v1/card-themes/:id` | DesignWrite | — | Delete theme |
| 6 | `GET` | `/api/v1/qr-memories/code/:qrCode` | Public | A | Scan QR → xem memory card |
| 7 | `POST` | `/api/v1/qr-memories/activate` | Public | A | Nhập PIN unlock |
| 8 | `GET` | `/api/v1/qr-memories/:engravingId` | JWT | A | Get by engraving ID |
| 9 | `PUT` | `/api/v1/qr-memories/:engravingId` | JWT | A | Update memory card |
| 10 | `GET` | `/api/v1/qr-memories` | JWT | A | List my memories |
| 11 | `POST` | `/api/v1/qr-memories/upload-photo` | JWT | — | Upload photo lên MinIO |
| 12 | `PUT` | `/api/v1/guest-tablet/qr-memories/:engravingId` | Public (guestCode) | A | Guest update |
| 13 | `POST` | `/api/v1/orders/:id/confirm-pickup` | OrderWrite | — | Unlock (pickup) |
| 14 | `PUT` | `/api/v1/orders/:id/shipment/status` | OrderWrite | — | Unlock (DELIVERED) |
| — | `GET`/`POST` | `/api/v1/engravings/:id` | JWT | **B** | Embedded trong engraving |
| — | `GET` | `/api/v1/guest-tablet/sessions/:guestCode` | Public | **B** | Embedded trong session |
