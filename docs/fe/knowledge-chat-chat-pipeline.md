# Knowledge Chat — Pipeline quy trình 1 lượt chat

Tài liệu mô tả **toàn bộ pipeline** từ lúc FE gửi câu hỏi đến khi nhận response, theo từng intent: bước nào chạy, khi nào truy vấn catalog/Qdrant/LLM, khi nào dừng sớm (clarification / template).

---

## 1. Tổng quan kiến trúc

```text
FE (Web Guest / Web User / Mobile)
   │  POST .../query  { question, chatSessionId? }
   ▼
API Gateway
   │  gRPC AskQuestion
   ▼
rag-service (NestJS)          ← điều phối nghiệp vụ
   │  1) session + context (DB)
   │  2) POST Python /intent/detect
   │  3) dispatch theo intent
   │     ├─ catalog DB (products / packages)   ← Nest
   │     └─ POST Python /query                 ← RAG + LLM
   ▼
rag_engine (Python)
   │  embedding → Qdrant → prompt → LLM (hoặc template zero-LLM)
   ▼
rag-service lưu assistant message → trả HTTP JSON cho FE
```

| Thành phần | Việc làm |
|------------|----------|
| **API Gateway** | Auth (Bearer / guest cookie), proxy gRPC |
| **rag-service** | Session, preferences, ownership, search catalog, gọi Python |
| **rag_engine** | Detect intent, retrieve Qdrant, build prompt, LLM / template |
| **PostgreSQL** | `ai_sessions`, `ai_messages`, `products`, packages… |
| **Qdrant** | Vector chunks knowledge (policy, package, ring_guide…) |

---

## 2. Pipeline 1 lượt `ask` (chi tiết từng bước)

```text
┌─ A. Validate + resolve session
│     - userId XOR guestSessionId
│     - có chatSessionId → check ownership
│     - không có → tạo session mới (title = 80 ký tự đầu câu hỏi)
│
├─ B. Build chat context (DB)
│     - recent messages
│     - conversationSummary (nếu có)
│     - userPreferences đã lưu
│     - lastIntent / currentIntent
│
├─ C. Intent detect  →  Python POST /intent/detect
│     - Rules-first (keyword + slot extract)
│     - LLM fallback nếu rules yếu
│     - Output: intent, extractedRequirements, missingFields,
│               productFilters, retrievalTypes,
│               shouldAskClarifyingQuestion, clarificationData?
│
├─ D. Persist user turn
│     - lưu user message
│     - merge preferences vào session
│
├─ E. Dispatch theo intent  (xem §3)
│     - có thể EARLY RETURN (clarification) — không gọi /query
│     - có thể search Products / Packages (Nest → Postgres)
│     - gọi Python POST /query (retrieval + answer)
│
├─ F. Post-process
│     - RING + 0 products → gắn suggestionChips
│     - lưu assistant message + metadata
│     - cập nhật last_message, current_intent
│     - (async) regenerate summary nếu đủ điều kiện
│
└─ G. Response HTTP
      type, intent, answer, sources,
      suggestedProducts, suggestedPackages,
      missingFields, productFilters,
      shouldAskClarifyingQuestion, clarificationData?,
      suggestionChips?
```

---

## 3. Ma trận: Intent × truy vấn gì × có LLM không

| Intent | Clarification sớm? | Catalog Products | Catalog Packages | Qdrant retrievalTypes | Gọi `/query` (Python) | LLM final? |
|--------|--------------------|------------------|------------------|----------------------|----------------------|------------|
| `RING_RECOMMENDATION` | Có nếu thiếu ≥2 field quan trọng (purpose/budget/style) hoặc quá sparse | **Có** (hard: budget/material/stone; soft-rank: purpose/style) | Không | `ring_guide`, `gemstone_guide` | Chỉ khi **không** clarify | Có nếu có chunk; không → template |
| `GEMSTONE_ADVICE` | Không | Có **nếu** có `stoneName`/`stoneColor` | Không | `gemstone_guide`, `ring_guide` | Luôn | Có nếu có chunk; không → template |
| `PACKAGE_QA` | Không | Không | **Có** | `package`, `policy` | Luôn | Có nếu có chunk/packages; không → template |
| `POLICY_QA` | Không | Không | Không | `policy` | Luôn | Có nếu có chunk; không → template |
| `GENERAL_RAG_QA` | Không | Không | Không | `general` (+ broad map từ detect) | Luôn | Có nếu có chunk; không → template |

### Khi nào **không** gọi Python `/query`

1. **Clarification** (`RING_RECOMMENDATION` + `shouldAskClarifyingQuestion=true`)  
   → rag-service trả `type: "clarification"` + `clarificationData` ngay, **0 LLM**, **0 Qdrant**, **0 catalog**.

### Khi nào Python `/query` **không gọi LLM** (template)

Trong rag_engine, nếu sau retrieval **không có chunk** phù hợp:

| Intent | Có candidates? | Template |
|--------|----------------|----------|
| RING | Có products | `TEMPLATE_RING_PRODUCTS_NO_DOCS` (vẫn trả products) |
| RING | Không products | `TEMPLATE_NO_PRODUCTS` (+ Nest gắn `suggestionChips`) |
| PACKAGE | Có packages | `TEMPLATE_PACKAGE_NO_DOCS` |
| PACKAGE | Không | `TEMPLATE_NO_PACKAGE` |
| POLICY | — | `TEMPLATE_NO_POLICY` |
| GEMSTONE | — | `TEMPLATE_GEMSTONE_NO_DOCS` |
| GENERAL | — | `TEMPLATE_NO_KNOWLEDGE` |

Nếu **có chunk** → build prompt + LLM → answer (có thể kèm products/packages đã truyền sẵn).

---

## 4. Flow theo từng intent (case-by-case)

### 4.1 `RING_RECOMMENDATION`

```text
User: "Gợi ý nhẫn cầu hôn dưới 10 triệu"
                │
                ▼
        /intent/detect
        purpose=engagement, budgetMax=10_000_000
        missing style? (1 field) → thường KHÔNG clarify
                │
                ▼
        Nest searchRings(productFilters)
        hard: base_price ≤ 10tr, is_active
        soft-rank: purpose/style keyword
                │
        ┌───────┴────────┐
        │                │
   có products      0 products
        │                │
        ▼                ▼
   /query + products   /query (products=[])
   Qdrant ring_guide   → template hoặc LLM tư vấn chung
        │                │
        ▼                ▼
   suggestedProducts   suggestionChips (nới filter)
   type=ring_recommendation
```

**Clarify path** (vd: chỉ nói “Tư vấn nhẫn”):

```text
detect → missing purpose + budget (+ style)
→ type=clarification + clarificationData (chips/slider)
→ DỪNG (không catalog, không /query)
```

**FE sau clarify:** gửi text theo chip/slider → lượt sau đi tiếp pipeline bình thường.

---

### 4.2 `GEMSTONE_ADVICE`

```text
User: "Sapphire bền không?"
  → detect GEMSTONE_ADVICE
  → nếu có stone filter → searchRings phụ
  → /query retrievalTypes=[gemstone_guide, ring_guide]
  → answer + optional products
```

Không clarification. Không `suggestionChips` (chip chỉ gắn ở RING khi 0 products).

---

### 4.3 `PACKAGE_QA`

```text
User: "Gói premium gồm gì?" / "Khắc vân tay thế nào?"
  → detect PACKAGE_QA
     (biometric keywords cũng map PACKAGE_QA, không còn custom_design)
  → Nest searchPackages
  → /query retrievalTypes=[package, policy]
  → suggestedPackages + answer
```

---

### 4.4 `POLICY_QA`

```text
User: "Bảo hành thế nào?"
  → detect POLICY_QA
  → không catalog
  → /query retrievalTypes=[policy]
  → answer + sources
```

---

### 4.5 `GENERAL_RAG_QA`

```text
User: "BIORING là gì?"
  → fallback GENERAL_RAG_QA
  → /query broad knowledge
  → answer
```

---

## 5. Các loại “truy vấn” trong hệ thống

| Loại truy vấn | Ai gọi | Khi nào | Mục đích |
|---------------|--------|---------|----------|
| **Session/messages DB** | Nest | Mọi ask + GET messages | Context, lịch sử, preferences |
| **Intent detect HTTP** | Nest → Python | Mọi ask | Intent + slots + clarification? |
| **Products catalog** | Nest Prisma | RING (luôn nếu không clarify); GEMSTONE (nếu có đá) | `suggestedProducts` / Product Candidates cho LLM |
| **Packages catalog** | Nest | PACKAGE_QA | `suggestedPackages` |
| **Qdrant vector search** | Python `/query` | Mọi intent đã qua `/query` | Context tài liệu theo `retrievalTypes` |
| **LLM final** | Python | Có chunk (hoặc policy có context) | Viết câu trả lời |
| **LLM intent** | Python detect | Chỉ khi rules confidence thấp | Phân loại intent khó |

---

## 6. Response branches FE cần handle

```text
                    ask response
                         │
         ┌───────────────┼───────────────────┐
         ▼               ▼                   ▼
 shouldAskClarifying  suggestionChips    suggestedProducts
 Question=true        .length>0          .length>0
         │               │                   │
         ▼               ▼                   ▼
 clarificationData   render nút nới     render card nhẫn
 chips / slider      filter             (+ answer)
 gửi question tiếp   gửi chip.question
```

| Branch | `type` điển hình | UI |
|--------|------------------|-----|
| Clarification | `clarification` | Theo `clarificationData.inputType` |
| Ring có SP | `ring_recommendation` | Answer + product cards |
| Ring hết SP | `ring_recommendation` (hoặc template) | Answer + `suggestionChips` |
| Package | `package_answer` | Answer + package cards |
| Policy | `policy_answer` | Answer + sources |
| Gemstone | `gemstone_advice` | Answer (+ products nếu có) |
| General | `rag_answer` | Answer + sources |

---

## 7. Session state xuyên suốt các lượt

Mỗi lượt ask cập nhật:

| State | Vai trò lượt sau |
|-------|------------------|
| `user_preferences` | Merge slot; follow-up “dưới 20 triệu” / “bỏ lọc đá” chỉnh filter |
| `current_intent` / `lastIntent` | Follow-up mơ hồ kế thừa intent |
| `summary` | Rút gọn history dài (async) |
| Messages | Context + lazy load `?limit=&before=` |

**Intent switch** (vd ring → policy): preferences chọn nhẫn **không bị xóa**.

---

## 8. Knowledge type gắn retrieval (nhắc lại)

| Intent | `retrievalTypes` mặc định |
|--------|---------------------------|
| RING_RECOMMENDATION | `ring_guide`, `gemstone_guide` |
| GEMSTONE_ADVICE | `gemstone_guide`, `ring_guide` |
| PACKAGE_QA | `package`, `policy` |
| POLICY_QA | `policy` |
| GENERAL_RAG_QA | `general` (+ broad từ detect map) |

Upload document chọn `documentType` → auto map retrieval types (không còn `custom_design`).

---

## 9. Sơ đồ một dòng (cheat sheet)

```text
FE ask
 → Gateway auth
 → Nest session + context
 → Python detect intent
 → [RING thiếu slot?] → clarification → STOP
 → [RING/GEMSTONE/PACKAGE?] → Nest catalog search
 → Python /query (Qdrant ± LLM / template)
 → [RING + 0 products?] → suggestionChips
 → Nest save messages → FE
```

---

## 10. Tài liệu liên quan

| Doc | Nội dung |
|-----|----------|
| [knowledge-chat-fe-integration.md](./knowledge-chat-fe-integration.md) | API Web/Mobile, auth, clarification, chips, FAQ |
| [knowledge-chat-intent-cases.md](./knowledge-chat-intent-cases.md) | Casebook intent + ví dụ câu hỏi |

---

## 11. Debug nhanh khi “sai đáp án”

| Hiện tượng | Kiểm tra |
|------------|----------|
| Clarify oan | `missingFields`, `shouldAskClarifyingQuestion` từ detect |
| 0 products dù DB có | Hard filter budget/material/stone; log `productFilters` |
| Answer generic + NGUỒN | Có chunk Qdrant nhưng products rỗng → LLM tư vấn chung |
| Template ngắn | `/query` zero chunk → template path |
| Chip sai | Chỉ khi RING + 0 products; chip theo `productFilters` active |
| Sai intent | Keyword rules vs LLM fallback; xem `debug.intentSource` nếu bật |
