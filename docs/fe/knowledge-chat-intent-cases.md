# Knowledge Chat — Intent casebook (cho Web/Mobile FE)

Tài liệu này mô tả các **trường hợp intent “đầy đủ”** như FE đang cần: đầu vào user hỏi gì, hệ thống detect intent gì, có trả `clarificationData` không, và FE nên render UI ra sao.

> Quy ước chung: FE gửi lại câu hỏi bằng **text tiếng Việt** để matcher (purpose/style/budget) bắt được slot tốt nhất.

---

## 0. Format FE cần dùng

Response chung:

```ts
{
  type: string; // "clarification" | "ring_recommendation" | "gemstone_advice" | "package_answer" | "policy_answer" | "rag_answer"
  intent: string; // "RING_RECOMMENDATION" | "GEMSTONE_ADVICE" | "PACKAGE_QA" | "POLICY_QA" | "GENERAL_RAG_QA"
  answer: string;
  suggestedProducts: any[];
  suggestedPackages: any[];
  missingFields: string[];
  shouldAskClarifyingQuestion: boolean;
  clarificationData: ClarificationData | null;
}
```

Khi `shouldAskClarifyingQuestion === true`:
- `type` = `"clarification"`
- `clarificationData.field` chỉ dùng 1 trong: `purpose` | `budgetMax` | `style`
- `clarificationData.inputType`:
  - `"chips"`: FE render các nút từ `clarificationData.options`
  - `"slider"`: FE render slider từ `clarificationData.min/max/step`

---

## 1. `RING_RECOMMENDATION` — đầy đủ (cases)

### 1.1 Case: Đủ `purpose + budgetMax + style`
**User hỏi**
- `Nhẫn cưới phong cách tối giản dưới 10 triệu`

**Hệ thống trả**
- `type`: `"ring_recommendation"`
- `intent`: `"RING_RECOMMENDATION"`
- `shouldAskClarifyingQuestion`: `false`
- `missingFields`: `[]`

**FE render**
- Hiển thị `answer`
- Hiển thị `suggestedProducts` (card nhẫn)
- `suggestedPackages`: `[]`

---

### 1.2 Case: Thiếu `purpose` → chips
**User hỏi**
- `Nhẫn dưới 15 triệu phong cách sang trọng`

**Hệ thống trả**
- `type`: `"clarification"`
- `intent`: `"RING_RECOMMENDATION"`
- `shouldAskClarifyingQuestion`: `true`
- `missingFields`: chứa `purpose` (thường kèm các missing quan trọng khác tùy ngữ cảnh)
- `clarificationData`:
  - `field: "purpose"`
  - `inputType: "chips"`
  - `options`: `[Cầu hôn, Cưới, Kỷ niệm, Đeo hằng ngày]`

**FE render**
- Render chips 4 nút.

**FE gửi lại câu hỏi (khuyến nghị)**
- Lấy `label` tiếng Việt của chip user vừa bấm (vd: `"Nhẫn cầu hôn ..."` hoặc ghép vào câu).
- Không gửi `value` kiểu `engagement/wedding/...` (vì extractor rule match theo tiếng Việt).

---

### 1.3 Case: Thiếu `budgetMax` → slider
**User hỏi**
- `Nhẫn cưới phong cách cổ điển`

**Hệ thống trả**
- `type`: `"clarification"`
- `intent`: `"RING_RECOMMENDATION"`
- `shouldAskClarifyingQuestion`: `true`
- `missingFields`: chứa `budgetMax` (hoặc trường hợp code chưa suy ra budgetMax)
- `clarificationData`:
  - `field: "budgetMax"`
  - `inputType: "slider"`
  - `min/max/step`: (min=1,000,000; max=50,000,000; step=1,000,000; unit="VNĐ")

**FE render**
- Render slider kéo + hiển thị VNĐ.

**FE gửi lại câu hỏi (khuyến nghị)**
- Sau khi user chọn tiền `V`, gửi text dạng:
  - `Nhẫn dưới {V} triệu ...`
- Matcher có logic ưu tiên dạng `dưới X triệu`, nên “dưới {X} triệu” là format an toàn.

---

### 1.4 Case: Thiếu `style` → chips
**User hỏi**
- `Nhẫn cầu hôn dưới 20 triệu`

**Hệ thống trả**
- `type`: `"clarification"`
- `intent`: `"RING_RECOMMENDATION"`
- `shouldAskClarifyingQuestion`: `true`
- `missingFields`: chứa `style`
- `clarificationData`:
  - `field: "style"`
  - `inputType: "chips"`
  - `options`: `[Tối giản, Sang trọng, Cổ điển, Nổi bật]`

**FE render**
- Render chips style.

**FE gửi lại câu hỏi (khuyến nghị)**
- Ghép `label` tiếng Việt vào question để style slot được match (vd: `"Nhẫn cầu hôn dưới 20 triệu tối giản"`).

---

### 1.5 Case: Follow-up mơ hồ kế thừa intent trước
**Giả sử trước đó**
- User đã hỏi và hệ thống ở `RING_RECOMMENDATION`

**User hỏi tiếp**
- `Còn mẫu tương tự không?`

**Hệ thống trả**
- Nếu vẫn có đủ preferences để kế thừa: hệ thống giữ `intent = RING_RECOMMENDATION`
- Nếu vẫn thiếu input quan trọng: trả tiếp `type: "clarification"`.

**FE render**
- Giống các case `RING_RECOMMENDATION`: nếu có `clarificationData` thì render UI theo field.

---

## 2. `GEMSTONE_ADVICE` — cases

### 2.1 Case: Hỏi đá quý (đơn giản)
**User hỏi**
- `Sapphire bền không?`

**Hệ thống trả**
- `type`: `"gemstone_advice"`
- `intent`: `"GEMSTONE_ADVICE"`
- `shouldAskClarifyingQuestion`: `false`

**FE render**
- Hiển thị `answer`
- `suggestedProducts` có thể có (nếu classifier extract được stoneColor/stoneName để rag-service search rings)

---

### 2.2 Case: Hỏi có ràng buộc màu/tên đá
**User hỏi**
- `Nhẫn có đá xanh hợp da?`

**Hệ thống trả**
- `intent`: `"GEMSTONE_ADVICE"`
- rag-service có thể tìm `Product Candidates` nếu có `stoneColor/stoneName`.

**FE render**
- Hiển thị `answer`
- `suggestedProducts` (nếu có) để user chọn mẫu.

---

## 3. `PACKAGE_QA` — cases

### 3.1 Case: Hỏi gói dịch vụ
**User hỏi**
- `Gói premium bao gồm những gì?`

**Hệ thống trả**
- `type`: `"package_answer"`
- `intent`: `"PACKAGE_QA"`
- `suggestedPackages`: có

**FE render**
- Card gói dịch vụ từ `suggestedPackages`
- Hiển thị `answer`

---

### 3.2 Case: Hỏi biometric/signal → vẫn là `PACKAGE_QA`
**User hỏi**
- `Nhẫn khắc vân tay hoạt động thế nào?`
- hoặc `Nhẫn từ giọng nói ...`
- hoặc `sóng âm/waveform ...`

**Hệ thống trả**
- `intent`: `"PACKAGE_QA"` (không còn “custom_design”)
- `suggestedPackages`: có

**FE render**
- Card gói phù hợp từ `suggestedPackages`

---

## 4. `POLICY_QA` — cases

### 4.1 Case: Hỏi chính sách
**User hỏi**
- `Shop có bảo hành không?`
- `Đổi trả trong bao lâu?`
- `Giao hàng mất bao lâu?`

**Hệ thống trả**
- `type`: `"policy_answer"`
- `intent`: `"POLICY_QA"`
- `suggestedProducts/suggestedPackages`: `[]`

**FE render**
- Chỉ hiển thị `answer`
- (Nếu có) hiển thị `sources` để user xem trích dẫn.

---

## 5. `GENERAL_RAG_QA` — cases

### 5.1 Case: Câu hỏi không khớp intent rõ
**User hỏi**
- `BIORING là gì?`
- `Cửa hàng ở đâu?`

**Hệ thống trả**
- `type`: `"rag_answer"` (fallback)
- `intent`: `"GENERAL_RAG_QA"`

**FE render**
- Hiển thị `answer`
- `sources` nếu có.

---

## 6. FAQ (gợi ý câu hỏi theo intent) — quick dùng cho FE

- `RING_RECOMMENDATION`:
  - `Gợi ý nhẫn cầu hôn dưới 10 triệu`
  - `Nhẫn đeo hằng ngày sang trọng dưới 5 triệu`
- `GEMSTONE_ADVICE`:
  - `Sapphire và kim cương khác nhau thế nào?`
  - `Đá ruby giá bao nhiêu?`
- `PACKAGE_QA`:
  - `Có những gói dịch vụ nào?`
  - `Khắc vân tay lên nhẫn như thế nào?`
- `POLICY_QA`:
  - `Chính sách bảo hành như thế nào?`
  - `Có được đổi trả không?`
- `GENERAL_RAG_QA`:
  - `BIORING là gì?`
  - `Liên hệ tư vấn trực tiếp`

