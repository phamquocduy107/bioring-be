# Knowledge Chat — Tài liệu tích hợp FE (Web + Mobile)

> Phiên bản cập nhật: structured `clarificationData` (chips/slider), `suggestionChips` khi hết sản phẩm, loại bỏ `custom_design` intent.
>
> Pipeline 1 lượt chat (intent → catalog → RAG → response): xem [knowledge-chat-chat-pipeline.md](./knowledge-chat-chat-pipeline.md).

---

## 1. Xác thực (Authentication)

### 1.1 Luồng đăng nhập Google OAuth

```text
┌─────────────┐   redirect    ┌──────────────┐   callback    ┌──────────────┐
│  FE (Web)   │ ────────────→ │ Google OAuth  │ ────────────→ │  BE Gateway  │
│  or Mobile  │               │  Consent      │               │  /api/v1/auth/google│
└─────────────┘               └──────────────┘               │  /callback   │
                                                              └──────┬───────┘
                                                                     │
                                              ┌──────────────────────┴───────────────────┐
                                              │                                          │
                                         Web (browser)                              Mobile (app)
                                              │                                          │
                                    Set-Cookie: refresh_token              redirect → appScheme://
                                    redirect → FRONTEND_URL?token=xxx      ?token=xxx&refreshToken=xxx
```

#### Web

1. FE mở: `GET {GATEWAY}/api/v1/auth/google`
2. User consent Google → callback BE
3. BE redirect về `{FRONTEND_URL}?token={accessToken}` + set cookie `refresh_token` (HttpOnly, Secure)
4. FE lấy `accessToken` từ URL query param, lưu vào memory/state (không lưu localStorage)

#### Mobile

1. App mở WebView/browser: `GET {GATEWAY}/api/v1/auth/google?state=platform:mobile,redirect:{appScheme}://auth`
2. User consent Google → callback BE
3. BE redirect về `{appScheme}://auth?token={accessToken}&refreshToken={refreshToken}`
4. App nhận cả `accessToken` + `refreshToken` qua deep link, lưu vào secure storage

### 1.2 Refresh token

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=xxx    ← Web (tự động gửi với credentials: 'include')
```

Response:

```json
{ "accessToken": "new-jwt-token" }
```

+ `Set-Cookie: refresh_token=new-refresh-token` (rotate)

**Mobile**: không dùng cookie, gọi refresh bằng cách gửi `refreshToken` trong body hoặc header tùy implementation. Nếu BE chỉ đọc cookie thì Mobile cần wrap trong header `Cookie`.

### 1.3 Logout

```http
POST /api/v1/auth/logout
Cookie: refresh_token=xxx
```

BE clear cookie + revoke refresh token phía server.

### 1.4 Lấy thông tin user

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

---

## 2. Ba chế độ gọi Chat API

| | Guest Web | User Web | User Mobile |
|--|-----------|----------|-------------|
| Auth | Cookie `guest_session_id` (HttpOnly, tự set) | `Authorization: Bearer <accessToken>` | `Authorization: Bearer <accessToken>` |
| Base path | `/api/v1/knowledge/chat/guest` | `/api/v1/knowledge/chat` | `/api/v1/knowledge/chat` |
| Credentials | `credentials: 'include'` | `credentials: 'include'` | Không cần (dùng Bearer) |
| Session storage | Cookie trình duyệt (~30 ngày) | Theo tài khoản | Theo tài khoản |

---

## 3. API Reference

### 3.1 Guest APIs (Web — public, không cần login)

> Mọi request Guest **bắt buộc** `credentials: 'include'` để browser gửi/nhận cookie `guest_session_id`.

| Method | Path | Body / Query |
|--------|------|------|
| `POST` | `/api/v1/knowledge/chat/guest/sessions` | `{ "title": "optional" }` |
| `GET` | `/api/v1/knowledge/chat/guest/sessions` | — |
| `GET` | `/api/v1/knowledge/chat/guest/sessions/{sessionId}/messages` | `?limit=30&before=<messageId>` |
| `POST` | `/api/v1/knowledge/chat/guest/query` | `{ "question": "...", "chatSessionId": "optional" }` |

Guest **không** dùng `documentIds`. Không có `chatSessionId` → hệ thống tự tạo session mới.

### 3.2 User APIs (Web + Mobile — cần Bearer token)

| Method | Path | Body / Query |
|--------|------|------|
| `POST` | `/api/v1/knowledge/chat/sessions` | `{ "title": "optional" }` |
| `GET` | `/api/v1/knowledge/chat/sessions` | — |
| `GET` | `/api/v1/knowledge/chat/sessions/{sessionId}/messages` | `?limit=30&before=<messageId>` |
| `POST` | `/api/v1/knowledge/chat/query` | `{ "question": "...", "chatSessionId": "optional", "documentIds": [] }` |

Header: `Authorization: Bearer <accessToken>`

### 3.3 Lazy load lịch sử tin nhắn (cursor)

Dùng cho cả Guest và User:

```http
GET .../sessions/{sessionId}/messages?limit=30
GET .../sessions/{sessionId}/messages?limit=30&before={nextCursor}
```

| Query | Ý nghĩa |
|-------|---------|
| `limit` | Số tin mỗi page (default `50`, max `100`) |
| `before` | `messageId` của tin **cũ nhất** FE đang có. Bỏ trống = lấy N tin **mới nhất** |

Response:

```json
{
  "messages": [
    { "id": "...", "sessionId": "...", "role": "user", "content": "...", "createdAt": "..." }
  ],
  "hasMore": true,
  "nextCursor": "uuid-of-oldest-message-in-this-page"
}
```

- `messages`: luôn theo thời gian **tăng dần (ASC)** trong page.
- `hasMore`: còn tin cũ hơn không.
- `nextCursor`: id tin cũ nhất trong page → dùng làm `before` lần sau.

**FE flow:**

```text
1. Mở session → GET ?limit=30
   → render messages, lưu nextCursor, hasMore

2. User scroll lên đầu list + hasMore === true
   → GET ?limit=30&before={nextCursor}
   → prepend messages vào đầu list
   → cập nhật nextCursor / hasMore từ response mới

3. hasMore === false → dừng load
```

Không cần dedupe nếu dùng đúng `before=nextCursor` (mỗi page không overlap).

Mỗi message trong lịch sử (đặc biệt `role=assistant`) có thể kèm:

```json
{
  "id": "...",
  "role": "assistant",
  "content": "...",
  "intent": "RING_RECOMMENDATION",
  "type": "ring_recommendation",
  "sources": [],
  "suggestedProducts": [ { "id": "...", "name": "...", "price": 1500000 } ],
  "suggestedPackages": [],
  "productFilters": {},
  "missingFields": [],
  "clarificationData": null,
  "suggestionChips": [],
  "createdAt": "..."
}
```

FE khi load lịch sử: render card sản phẩm từ `message.suggestedProducts` giống lúc nhận query response.

### 3.4 Suggestion chips khi hết sản phẩm khớp

Khi `intent === "RING_RECOMMENDATION"` và `suggestedProducts` rỗng, BE trả thêm:

```json
{
  "suggestionChips": [
    {
      "label": "Ngân sách dưới 10 triệu",
      "question": "Ngân sách dưới 10 triệu",
      "action": "expand_budget"
    },
    {
      "label": "Bỏ lọc phong cách",
      "question": "Bỏ lọc phong cách",
      "action": "clear_style"
    },
    {
      "label": "Nới hết lọc",
      "question": "Nới hết lọc",
      "action": "relax_all"
    }
  ]
}
```

**Quy tắc BE (FE không hardcode):**
- Chỉ hiện chip tương ứng filter đang active trong `productFilters`
- Có `budgetMax` → chip nới ngân sách (bước kế: 10tr / 20tr / 50tr)
- Có `stoneName`/`stoneColor` → `Bỏ lọc đá`
- Có `style` → `Bỏ lọc phong cách`
- ≥2 filter siết → thêm `Nới hết lọc`
- **Không** hiện `Bỏ lọc đá` nếu user không lọc đá
- Tối đa 3 chip

**Ví dụ case ảnh:** `Nhẫn đeo hàng ngày Sang trọng dưới 5 triệu`
→ chips: `Ngân sách dưới 10 triệu` | `Bỏ lọc phong cách` | `Nới hết lọc`

---

## 4. Response format (chung cho Guest, User Web, User Mobile)

```typescript
interface ChatQueryResponse {
  messageId: string;
  sessionId: string;
  type: string;
  // "clarification" | "ring_recommendation" | "gemstone_advice"
  // | "package_answer" | "policy_answer" | "rag_answer"

  intent: string;
  // "RING_RECOMMENDATION" | "GEMSTONE_ADVICE" | "PACKAGE_QA"
  // | "POLICY_QA" | "GENERAL_RAG_QA"

  answer: string;

  sources: {
    documentId?: string;
    source?: string;
    page?: number;
    score?: number;
    contentPreview?: string;
  }[];

  suggestedProducts: {
    id: string;
    name: string;
    price: number;
    material: string;
    style: string;
    purpose: string;
    stoneName: string;
    stoneColor: string;
    imageUrl: string;
    tags: string[];
    reason: string;
  }[];

  suggestedPackages: {
    id: string;
    name: string;
    description: string;
    price: number;
    includedServices: string[];
    estimatedDays: number;
    warranty: string;
  }[];

  missingFields: string[];
  productFilters: Record<string, unknown>;
  shouldAskClarifyingQuestion: boolean;
  clarificationData: ClarificationData | null;
  suggestionChips: {
    label: string;
    question: string;
    action: 'expand_budget' | 'clear_stone' | 'clear_style' | 'relax_all';
  }[];
}
```

---

## 5. Clarification — Render UI động (chips / slider)

Khi `shouldAskClarifyingQuestion === true`, response chứa `clarificationData`:

```typescript
interface ClarificationData {
  field: string;                // "purpose" | "budgetMax" | "style"
  question: string;             // Câu hỏi hiển thị cho user
  inputType: "chips" | "slider";

  // Khi inputType === "chips":
  options?: { label: string; value: string }[];

  // Khi inputType === "slider":
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}
```

### 5.1 Thiếu `purpose` → Chips

```json
{
  "field": "purpose",
  "question": "Bạn muốn nhẫn dùng cho dịp nào ạ?",
  "inputType": "chips",
  "options": [
    { "label": "Cầu hôn", "value": "engagement" },
    { "label": "Cưới", "value": "wedding" },
    { "label": "Kỷ niệm", "value": "anniversary" },
    { "label": "Đeo hằng ngày", "value": "daily" }
  ]
}
```

**UI**: render 4 nút bấm. Khi bấm → gửi query mới: `"Nhẫn cầu hôn"`.

### 5.2 Thiếu `budgetMax` → Slider

```json
{
  "field": "budgetMax",
  "question": "Ngân sách dự kiến khoảng bao nhiêu ạ?",
  "inputType": "slider",
  "min": 1000000,
  "max": 50000000,
  "step": 1000000,
  "unit": "VNĐ"
}
```

**UI**: render slider kéo 1tr–50tr. Khi confirm → gửi query: `"Ngân sách dưới 15 triệu"`.

### 5.3 Thiếu `style` → Chips

```json
{
  "field": "style",
  "question": "Bạn thích phong cách nào ạ?",
  "inputType": "chips",
  "options": [
    { "label": "Tối giản", "value": "minimalist" },
    { "label": "Sang trọng", "value": "luxury" },
    { "label": "Cổ điển", "value": "classic" },
    { "label": "Nổi bật", "value": "bold" }
  ]
}
```

### 5.4 Thứ tự hỏi

Hệ thống hỏi **từng field một**: `purpose` → `budgetMax` → `style`. Sau mỗi câu trả lời, hệ thống tự detect field tiếp theo còn thiếu hoặc trả kết quả tư vấn nếu đã đủ.

---

## 6. Intent & Response type mapping

| Intent | Trigger keywords | type trả về | Products? | Packages? |
|--------|-----------------|-------------|-----------|-----------|
| `RING_RECOMMENDATION` | nhẫn, mẫu, gợi ý, cầu hôn, cưới, ngân sách, dưới X triệu | `ring_recommendation` hoặc `clarification` | Có | Không |
| `GEMSTONE_ADVICE` | đá, sapphire, ruby, kim cương, moissanite, màu đá, ý nghĩa đá | `gemstone_advice` | Có thể | Không |
| `PACKAGE_QA` | gói, package, premium, vân tay, giọng nói, biometric, sóng âm, khắc vân tay | `package_answer` | Không | Có |
| `POLICY_QA` | bảo hành, đổi trả, hoàn tiền, giao hàng, thanh toán, chính sách | `policy_answer` | Không | Không |
| `GENERAL_RAG_QA` | fallback — không khớp intent nào rõ ràng | `rag_answer` | Không | Không |

---

## 7. FAQ — Bộ câu hỏi gợi ý cho chat UI

FE nên hiển thị các câu gợi ý khi mở chat mới hoặc khi chat trống. Bấm gợi ý = gửi query tương ứng.

### Tư vấn nhẫn

| Câu hỏi gợi ý | Intent kỳ vọng |
|---------------|----------------|
| Gợi ý nhẫn cầu hôn dưới 10 triệu | RING_RECOMMENDATION |
| Nhẫn cưới vàng trắng phong cách tối giản | RING_RECOMMENDATION |
| Nhẫn kỷ niệm ngày cưới có đá sapphire | RING_RECOMMENDATION |
| Nhẫn đeo hằng ngày sang trọng dưới 5 triệu | RING_RECOMMENDATION |
| Mẫu nhẫn platinum có kim cương | RING_RECOMMENDATION |

### Tư vấn đá quý

| Câu hỏi gợi ý | Intent kỳ vọng |
|---------------|----------------|
| Sapphire và kim cương khác nhau thế nào? | GEMSTONE_ADVICE |
| Đá nào hợp cho nhẫn cầu hôn? | GEMSTONE_ADVICE |
| Ý nghĩa của các màu đá quý | GEMSTONE_ADVICE |
| Moissanite có bền không? | GEMSTONE_ADVICE |
| Đá ruby giá bao nhiêu? | GEMSTONE_ADVICE |

### Gói dịch vụ & cá nhân hóa

| Câu hỏi gợi ý | Intent kỳ vọng |
|---------------|----------------|
| Có những gói dịch vụ nào? | PACKAGE_QA |
| Gói premium bao gồm những gì? | PACKAGE_QA |
| Khắc vân tay lên nhẫn như thế nào? | PACKAGE_QA |
| Nhẫn từ giọng nói hoạt động ra sao? | PACKAGE_QA |
| So sánh gói standard và premium | PACKAGE_QA |

### Chính sách

| Câu hỏi gợi ý | Intent kỳ vọng |
|---------------|----------------|
| Chính sách bảo hành như thế nào? | POLICY_QA |
| Có được đổi trả không? | POLICY_QA |
| Giao hàng mất bao lâu? | POLICY_QA |
| Hình thức thanh toán nào được hỗ trợ? | POLICY_QA |
| Chính sách hủy đơn hàng | POLICY_QA |

### Câu hỏi chung

| Câu hỏi gợi ý | Intent kỳ vọng |
|---------------|----------------|
| BIORING là gì? | GENERAL_RAG_QA |
| Cửa hàng ở đâu? | GENERAL_RAG_QA |
| Liên hệ tư vấn trực tiếp | GENERAL_RAG_QA |

---

## 8. Code mẫu tích hợp

### 8.1 Web (Next.js / React)

```typescript
const GATEWAY = process.env.NEXT_PUBLIC_API_URL; // http://localhost:3000

type AuthMode = 'guest' | 'user';

function chatBase(mode: AuthMode) {
  return mode === 'guest'
    ? `${GATEWAY}/api/v1/knowledge/chat/guest`
    : `${GATEWAY}/api/v1/knowledge/chat`;
}

async function chatFetch(
  mode: AuthMode,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (mode === 'user' && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${chatBase(mode)}${path}`, {
    ...init,
    headers,
    credentials: 'include', // guest cookie + refresh cookie
  });

  if (res.status === 401 && mode === 'user') {
    // accessToken hết hạn → refresh
    const refreshRes = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const { accessToken: newToken } = await refreshRes.json();
      headers.set('Authorization', `Bearer ${newToken}`);
      const retry = await fetch(`${chatBase(mode)}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
      if (!retry.ok) throw new Error(await retry.text());
      return retry.json();
    }
    throw new Error('Session expired, please login again');
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Guest (chưa login) ───
export const guestCreateSession = (title?: string) =>
  chatFetch('guest', '/sessions', { method: 'POST', body: JSON.stringify({ title }) });

export const guestListSessions = () =>
  chatFetch('guest', '/sessions');

export const guestGetMessages = (sessionId: string) =>
  chatFetch('guest', `/sessions/${sessionId}/messages`);

export const guestAsk = (question: string, chatSessionId?: string) =>
  chatFetch('guest', '/query', {
    method: 'POST',
    body: JSON.stringify({ question, chatSessionId }),
  });

// ─── User (đã login) ───
export const userCreateSession = (token: string, title?: string) =>
  chatFetch('user', '/sessions', { method: 'POST', body: JSON.stringify({ title }) }, token);

export const userListSessions = (token: string) =>
  chatFetch('user', '/sessions', {}, token);

export const userGetMessages = (token: string, sessionId: string) =>
  chatFetch('user', `/sessions/${sessionId}/messages`, {}, token);

export const userAsk = (token: string, question: string, chatSessionId?: string) =>
  chatFetch('user', '/query', {
    method: 'POST',
    body: JSON.stringify({ question, chatSessionId }),
  }, token);
```

### 8.2 Mobile (React Native / Flutter — ví dụ fetch)

```typescript
// Mobile không dùng cookie → chỉ dùng User APIs với Bearer token.
// accessToken + refreshToken lưu trong SecureStore / Keychain.

const GATEWAY = 'https://api.bioring.vn'; // production URL

async function mobileChatFetch(
  path: string,
  init: RequestInit = {},
  accessToken: string,
) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);

  // Mobile không cần credentials: 'include' (không có cookie)
  const res = await fetch(`${GATEWAY}/api/v1/knowledge/chat${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Mobile APIs ───
export const mobileCreateSession = (token: string, title?: string) =>
  mobileChatFetch('/sessions', { method: 'POST', body: JSON.stringify({ title }) }, token);

export const mobileListSessions = (token: string) =>
  mobileChatFetch('/sessions', {}, token);

export const mobileGetMessages = (token: string, sessionId: string) =>
  mobileChatFetch(`/sessions/${sessionId}/messages`, {}, token);

export const mobileAsk = (token: string, question: string, chatSessionId?: string) =>
  mobileChatFetch('/query', {
    method: 'POST',
    body: JSON.stringify({ question, chatSessionId }),
  }, token);
```

### 8.3 Mobile — Login flow (Deep Link)

```typescript
// React Native example
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

const APP_SCHEME = 'bioring'; // bioring://auth

async function loginWithGoogle() {
  const redirectUri = `${APP_SCHEME}://auth`;
  const state = `platform:mobile,redirect:${encodeURIComponent(redirectUri)}`;
  const url = `${GATEWAY}/api/v1/auth/google?state=${encodeURIComponent(state)}`;

  const result = await WebBrowser.openBrowserAsync(url);
  // Sau khi callback, BE redirect về bioring://auth?token=xxx&refreshToken=xxx
}

// Lắng nghe deep link
Linking.addEventListener('url', async ({ url }) => {
  const parsed = Linking.parse(url);
  if (parsed.path === 'auth' && parsed.queryParams?.token) {
    await SecureStore.setItemAsync('accessToken', parsed.queryParams.token as string);
    await SecureStore.setItemAsync('refreshToken', parsed.queryParams.refreshToken as string);
    // Navigate vào app
  }
});
```

### 8.4 Mobile — Refresh token

```typescript
async function refreshAccessToken(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  // BE đọc refresh_token từ cookie, mobile cần gửi qua cookie header
  const res = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `refresh_token=${refreshToken}` },
  });

  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();

  // Lưu token mới
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  // Nếu BE trả refreshToken mới trong Set-Cookie, parse và lưu
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/refresh_token=([^;]+)/);
    if (match) await SecureStore.setItemAsync('refreshToken', match[1]);
  }

  return data.accessToken;
}
```

---

## 9. UI Flow tổng quan

```text
┌──────────────────────────────────────────────────────────┐
│                    MỞ TRANG CHAT                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  accessToken?  ──── Không ──→  mode = GUEST (Web only)   │
│       │                        └─ dùng Guest APIs        │
│      Có                           + credentials:'include'│
│       │                                                  │
│       ▼                                                  │
│  mode = USER (Web + Mobile)                              │
│  └─ dùng User APIs + Bearer header                       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              HIỂN THỊ FAQ GỢI Ý (section 7)              │
│              User bấm gợi ý hoặc tự gõ câu hỏi          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  POST .../query { question, chatSessionId? }             │
│                         │                                │
│                         ▼                                │
│  ┌─ shouldAskClarifyingQuestion?                         │
│  │   YES → render clarificationData                      │
│  │         chips (nút bấm) hoặc slider (kéo chọn)       │
│  │         user chọn → gửi query mới                     │
│  │                                                       │
│  │   NO  → render answer                                 │
│  │         + suggestedProducts (card nhẫn)                │
│  │         + suggestedPackages (card gói)                 │
│  │         + sources (nếu có)                             │
│  └───────────────────────────────────────────────────────│
│                                                          │
│  Lưu sessionId → dùng cho câu hỏi tiếp theo             │
└──────────────────────────────────────────────────────────┘
```

---

## 10. Lưu ý quan trọng

| # | Lưu ý |
|---|-------|
| 1 | **Web**: mọi request đều cần `credentials: 'include'` (guest cookie + refresh cookie) |
| 2 | **Mobile**: không cần `credentials`, chỉ dùng Bearer header. Refresh token lưu secure storage |
| 3 | Guest cookie `guest_session_id` là **HttpOnly** → FE không đọc/ghi được, cũng không cần |
| 4 | Khi user login giữa chừng (Web): đổi mode sang user, tạo session mới, **không reuse** guest session |
| 5 | Timeout API query có thể **5–30 giây** (RAG + LLM processing), UI nên show loading |
| 6 | `clarificationData` chỉ có khi `shouldAskClarifyingQuestion === true` |
| 7 | Khi `clarificationData === null` nhưng `shouldAskClarifyingQuestion === true`: dùng `answer` làm text fallback |
| 8 | accessToken (JWT) hết hạn → gọi `POST /api/v1/auth/refresh` để lấy token mới |
| 9 | Mobile login qua Google: dùng `state=platform:mobile,redirect:{appScheme}://auth` |
| 10 | Không lưu accessToken vào localStorage (Web) — chỉ lưu trong memory/state |

---

## 11. CORS & Cookie config (cho DevOps/BE)

```text
Web dev:
  FE: http://localhost:5173
  BE: http://localhost:3000
  → CORS origin: http://localhost:5173, credentials: true
  → Cookie: SameSite=Lax, Secure=false (dev), Path=/

Production:
  FE: https://bioring.vn
  BE: https://api.bioring.vn
  → CORS origin: https://bioring.vn, credentials: true
  → Cookie: SameSite=Lax, Secure=true, Path=/

Mobile:
  Không dùng cookie → CORS không ảnh hưởng
  Chỉ cần BE allow Authorization header
```

---

## 12. Swagger

| Platform | Tag | Auth scheme |
|----------|-----|-------------|
| Guest Web | **Knowledge - Chat (Guest)** | Cookie `guest-session` |
| User Web / Mobile | **Knowledge - Chat** | Bearer `access-token` |
| Auth | **Auth** | — |

Docs: `{GATEWAY}/docs`

---

## 13. Checklist chỉnh sửa FE (suggestion chips)

### Bỏ
- [ ] Xóa hardcode 3 nút cố định: `Ngân sách 20 triệu` / `Bỏ lọc đá` / `Nới hết lọc`
- [ ] Không tự suy chip từ text answer

### Thêm
- [ ] Đọc `suggestionChips` từ response query
- [ ] Chỉ render khi `Array.isArray(suggestionChips) && suggestionChips.length > 0`
- [ ] Mỗi chip: hiển thị `chip.label`
- [ ] onClick → gửi `POST .../query` với `question: chip.question` (giữ `chatSessionId`)
- [ ] Không gửi `chip.action` làm question (action chỉ để style/analytics nếu cần)

### Ví dụ render

```tsx
{res.suggestionChips?.length > 0 && (
  <div className="suggestion-chips">
    {res.suggestionChips.map((chip) => (
      <button
        key={chip.label}
        type="button"
        onClick={() => ask(chip.question, sessionId)}
      >
        {chip.label}
      </button>
    ))}
  </div>
)}
```

### Không nhầm với clarification
| Field | Khi nào | UI |
|-------|---------|-----|
| `clarificationData` | thiếu purpose/budget/style | chips / slider theo `inputType` |
| `suggestionChips` | đã đủ filter nhưng **0 sản phẩm** | nút nới điều kiện |

Hai loại có thể không cùng lúc: clarification thì chưa search catalog; suggestionChips sau khi search rỗng.

