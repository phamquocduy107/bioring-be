# Order List — Engraving Enrichment (MF08 P0.1)

> Verified against code — Last updated: 2026-07-28

---

## Change

`GET /api/v1/orders` and `GET /api/v1/orders/admin` now embed full engraving data (same shape as `GET /api/v1/orders/:id`) instead of returning `versions: []` / `biometricAssets: []`.

---

## Response Shape — Engraving field in list endpoints

```json
{
  "engraving": {
    "id":                "550e8400-e29b-41d4-a716-446655440003",
    "orderId":           "550e8400-e29b-41d4-a716-446655440001",
    "userId":            "550e8400-e29b-41d4-a716-446655440000",
    "productId":         "prod-classic-band",
    "uniqueProductId":   "RS-A7B9X2",
    "approvedVersionId": "550e8400-e29b-41d4-a716-446655440004",
    "status":            "ACTIVE",
    "versions": [
      {
        "id":                "550e8400-e29b-41d4-a716-446655440004",
        "engravingId":       "550e8400-e29b-41d4-a716-446655440003",
        "versionNumber":     1,
        "selectedMaterialId":"mat-gold-18k",
        "selectedGemstoneId":"gmt-diamond-05",
        "ringSize":          "7",
        "ringStyle":         "Nhẫn cưới Classic",
        "ringShape":         "ROUND",
        "customizationConfig":"{\"engravedType\":\"sw\",\"selectedBiometrics\":[\"SW\"],\"engravingPositions\":{\"sw\":{\"enabled\":true,\"status\":\"pending\",\"position\":{\"startAngle\":45,\"width\":180}}},\"memoryCard\":false}",
        "status":            "PENDING",
        "managerId":         "",
        "managerNote":       "",
        "reviewedAt":        "",
        "createdAt":         "2026-06-24T10:00:00.000Z",
        "selectedMaterial": {
          "id": "mat-gold-18k",
          "name": "Vàng 18K",
          "purity": "75%",
          "color": "Vàng",
          "currentPricePerGram": 1600000
        },
        "selectedGemstone": {
          "id": "gmt-diamond-05",
          "type": "Kim cương",
          "carat": 0.5,
          "cut": "Round Brilliant",
          "color": "D",
          "clarity": "VS1",
          "certificationCode": "GIA-123456",
          "price": 15000000,
          "isAvailable": true
        }
      }
    ],
    "biometricAssets": [],
    "product": {
      "id": "prod-classic-band",
      "name": "Nhẫn cưới Classic",
      "description": "Nhẫn cưới vàng 18K",
      "basePrice": 12000000,
      "thumbnailUrl": "https://...",
      "model3dUrl": "https://..."
    }
  }
}
```

## Key notes

| Field | Source | Note |
|---|---|---|
| `versions[].ringStyle` | `v.ring_style \|\| product.name` | Fallback đến product name nếu null |
| `versions[].selectedMaterial` | Joined from product_materials | Object rỗng `{}` nếu `selectedMaterialId` null |
| `versions[].selectedGemstone` | Joined from gemstones | Object rỗng `{}` nếu `selectedGemstoneId` null |
| `product` | Joined from products | Always present (engraving always has productId) |

## Endpoints affected

| Endpoint | Change |
|---|---|
| `GET /api/v1/orders` | `engraving` field now has full versions/biometricAssets/product |
| `GET /api/v1/orders/admin` | Same |
| `GET /api/v1/orders/:id` | No change (already had full data) |

## Prisma include added to list queries

```ts
engraving: {
  include: {
    versions: {
      include: {
        product_materials: true,
        gemstones: true,
      },
    },
    biometric_assets: true,
    products: true,
  },
},
```

## BE mapping method

```ts
// file: apps/ecommerce-service/src/order/order.service.ts
private mapEngravingForOrder(orderId: string, e: Prisma.engravingsGetPayload<{ include: { ... } }>): EngravingForOrderDto
```
