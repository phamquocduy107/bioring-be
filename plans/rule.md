# Swagger Documentation Rules

## 1. Swagger phải luôn đúng với thực tế
- Mọi thay đổi về request (params, body, query, headers), response shape, status code, auth/permission decorators trên controller PHẢI được cập nhật tương ứng trong file `.swagger.ts`.
- Response example phải khớp với wrapper object thực tế trả về từ controller/service (VD: `{ user: {...} }`, `{ role: {...} }`, `{ draft: {...} }`, `{ product: {...} }`, không bao giờ để flat thiếu wrapper).
- Status code phải khớp: không thêm 403 cho endpoint `@Public()`, không thiếu 400/404/409 khi controller có thể throw.
- Khi thêm/chỉnh sửa DTO, phải thêm `@ApiProperty()`/`@ApiPropertyOptional()` với `example` để Swagger auto-generate schema chính xác.
- Khi audit, cross-check từng endpoint: controller → service → swagger file.

## 2. List API phải luôn trả về mảng rỗng thay vì null/undefined
- Mọi endpoint trả về danh sách (list) PHẢI dùng `?? []` fallback cho array fields.
- Pattern bắt buộc:
  ```ts
  async getXxx() {
    const result = await this.xxxService.getXxx();
    return { items: result?.items ?? [] };
  }
  ```
- Với paginated list, phải fallback cả `meta`:
  ```ts
  return {
    data: result?.data ?? [],
    meta: result?.meta ?? { total: 0, page: 1, limit: 10, lastPage: 0 },
  };
  ```

## 3. UUID validation phải đồng bộ và đúng chuẩn RFC 4122

- **Tất cả UUID params** PHẢI dùng `new ParseUUIDPipe({ version: '4' })` (không dùng `ParseUUIDPipe` bare).
- **Tất cả UUID body fields** PHẢI dùng `@IsUUID('4')` (không dùng `@IsUUID()` hay `@Matches()` tự chế).
- Đảm bảo UUID theo chuẩn RFC 4122: version nibble = 4, variant nibble ∈ [89ab].
- Pattern route param:
  ```ts
  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string)
  ```
- Pattern DTO field:
  ```ts
  @IsUUID('4')
  productId: string;
  ```

## 4. Project directory structure

Cấu trúc thư mục khi thêm module mới:

```
# Microservice — business logic
apps/ecommerce-service/src/<tên>/
  <tên>.module.ts
  <tên>.controller.ts    # @GrpcMethod
  <tên>.service.ts       # PrismaService

# API Gateway — HTTP routes
apps/api-gateway/src/modules/ecommerce/<tên>/
  <tên>.controller.ts    # HTTP controller, define interfaces + gRPC service interface
  <tên>.swagger.ts       # @ApiXxxDocs() decorator functions

# Common lib — DTOs (validation + swagger)
libs/common/src/dtos/<tên>/
  <tên>.dto.ts
  index.ts

# Common lib — Enums
libs/common/src/enums/
  <tên>.enum.ts

# Proto
proto/ecommerce.proto     # messages + RPCs
```

**Các file cần sửa để register:**
- `apps/ecommerce-service/src/ecommerce-service.module.ts` — import module mới
- `apps/api-gateway/src/modules/ecommerce/ecommerce.module.ts` — register controller
- `libs/common/src/dtos/index.ts` — export DTOs
- `libs/common/src/enums/index.ts` — export enums

## 5. `customization_config` — format chuẩn dùng chung (MF-01 → MF-06)

`customization_config` là JSON field tồn tại trên cả `design_drafts` (MF-01) và `engraving_versions` (MF-02 trở đi). Format phải nhất quán xuyên suốt:

```jsonc
{
  // === Package selection — multi-select (Screen 2) ===
  // Chưa chọn = null. Đã chọn = array, 1-3 items, giá trị: "FP" | "SW" | "HB"
  "selectedBiometrics": ["SW", "FP"],

  // === Loại được khắc lên nhẫn (Screen 3 — Advanced Design) ===
  // null = chưa xác định, "fp" hoặc "sw" = 1 trong selectedBiometrics, có thể khắc lên nhẫn
  // HB không thể là engravedType
  "engravedType": "sw",

  // === Vị trí khắc trên nhẫn ===
  // Chỉ FP và SW có position. HB không có — HB không khắc lên nhẫn, chỉ memory card.
  // enabled = biometric này có được chọn để khắc không (từ MF-01 web: vị trí placeholder)
  // status = "pending" | "captured" — trạng thái dữ liệu biometric
  "engravingPositions": {
    "fp": {
      "enabled": false,
      "status": "pending",
      "position": { "x": 0.5, "y": 0.5 }        // normalized 0-1
    },
    "sw": {
      "enabled": true,
      "status": "pending",
      "position": { "startAngle": 90, "width": 180, "height": 3 }
    }
  },

  // === Memory card ===
  "memoryCard": {
    "recipientEmail": "friend@example.com",
    "cardTitle": "Our Special Ring",
    "greetingMessage": "Thank you!"
  },

  // === Preview URL ===
  "ringPreviewUrl": "https://res.cloudinary.com/.../preview.png"
}
```

### Nguyên tắc
| Field | Lưu ở đâu | Mục đích |
|-------|-----------|----------|
| `selectedBiometrics` | `engraving_versions.selected_biometrics` (column riêng) | Package selection — UI multi-select. Lưu dạng CSV: "SW","SW,FP" v.v. |
| `engravedType` | `customization_config` | Loại nào được khắc lên nhẫn |
| `engravingPositions` | `customization_config` | Vị trí khắc trên nhẫn (tọa độ/angle) |
| `memoryCard` | `customization_config` | Thiết kế memory card |
| `captureRoute` | `orders.capture_route` | Suy từ `selectedBiometrics`: chỉ `SW` → ONLINE, else OFFLINE |
| Biometric file URLs | `engraving_biometrics` | `raw_file_url` (audio/img), `processed_svg_url` (waveform/fingerprint SVG) |
| Segment, position của waveform | `engraving_biometrics.extra_data` | `selectedSegment`, `durationMs`... |
| `packageType` | `orders.package_type` | Server derive từ `selectedBiometrics`. Enum: `SW`/`FP`/`HB`/`SW_FP`/`SW_HB`/`FP_HB`/`ALL` |

### Luồng tạo `engraving_biometrics`

`engraving_biometrics` chỉ được tạo khi có dữ liệu biometric thật (sau capture), KHÔNG tạo trước:

1. Mỗi `biometric_type` trong `selectedBiometrics` tương ứng 1 row
2. `required_channel` = `'ENGRAVING'` nếu `biometric_type == engravedType`, else `'MEMORY_CARD'`
3. Chỉ set `raw_file_url` và `processed_svg_url` khi đã upload file thành công
4. Với ONLINE (SW): tạo row sau khi thu âm + Python xử lý waveform
5. Với OFFLINE (FP/HB): tạo row sau khi IoT capture tại store

```sql
-- Ví dụ: selectedBiometrics = ["SW","FP"], engravedType = "sw"
-- Tạo 2 rows:
-- 1. SW, required_channel = ENGRAVING, raw_file_url = audio.mp3, processed_svg_url = waveform.svg
-- 2. FP, required_channel = MEMORY_CARD, raw_file_url = fingerprint.png, processed_svg_url = fingerprint.svg
```
