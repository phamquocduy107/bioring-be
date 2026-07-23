### BIORING - SYSTEM FLOW DOCUMENTATION (UPDATED)

#### 1. DESCRIPTION

- **Mô tả:** Hệ thống thương mại điện tử O2O kết hợp Trợ lý AI tư vấn và công nghệ sinh trắc học để chế tác nhẫn trơn cá nhân hóa (khắc vân tay, sóng âm; nhịp tim hiển thị trên memory card).
- **Platform:** Web (FE: NextJS, BE: NestJS) - App (React Native).
- **Mục tiêu:** Người dùng tự thiết kế nhẫn dựa trên mẫu nhẫn có sẵn, thay đổi loại đá, shape đá, vật liệu, size, khắc vân tay/sóng âm (điều chỉnh kích thước, vị trí). Người dùng cũng thiết kế thiệp (memory card). Trong đơn hàng gửi về sẽ có nhẫn kèm theo card cứng chứa mã QR, người dùng quét để xem memory card này (chứa voice, waveform, nhịp tim, thông điệp,...).
- **Package model (linh hoạt):** Người dùng chọn tổ hợp từ 1-3 loại sinh trắc học: **Finger Print (FP)**, **Sound Wave (SW)**, **Heart Beat (HB)**, bắt buộc chọn ít nhất 1. Có 7 tổ hợp:
  - **SW** → ONLINE (có thể thực hiện từ xa)
  - **HB** → OFFLINE (bắt buộc ra cửa hàng)
  - **FP** → OFFLINE
  - **SW+FP** → OFFLINE
  - **SW+HB** → OFFLINE
  - **FP+HB** → OFFLINE
  - **ALL (SW+FP+HB)** → OFFLINE
  - **Lưu ý:** Chỉ **FP** và **SW** là có thể khắc lên nhẫn. **HB** chỉ hiển thị trên memory card, không khắc lên nhẫn.
  - **Quan trọng:** Dù chọn nhiều loại (VD: SW+FP, ALL) thì cũng **chỉ được chọn 1 loại duy nhất (FP hoặc SW) để khắc lên nhẫn**. Loại còn lại vẫn được thu thập và hiển thị đầy đủ trong memory card nhưng không khắc vật lý lên nhẫn.
- **Quy trình thiết kế 3 màn hình trên Mobile:**
  1. **Thiết kế cơ bản (Simple Design):** Chọn mẫu nhẫn, loại đá, shape đá, vật liệu, kích thước → Bấm **Continue**.
  2. **Chọn gói (Package Selection):** Chọn tổ hợp biometric (FP, SW, HB) → Xác định capture route (ONLINE/OFFLINE) → Bấm **Next**.
  3. **Thiết kế nâng cao (Advanced Design):** Tuỳ theo tổ hợp đã chọn, hiển thị giao diện tương ứng (thu âm, chọn đoạn khắc 3s, slider chỉnh vị trí, preview mock fingerprint/sound wave...).
- **Tổng quan:** Web hiển thị dạng promo, không có chức năng đăng nhập/đăng ký cho người mới. Guest được định danh bằng **`guest_session_id`** (UUID) lưu trong cookie, tự động tạo khi truy cập web. Cho phép design nhẫn trên web và lấy được **Design code** để nhập vào mobile. Web có dashboard cho admin/manager/staff. App bắt buộc login (bằng Google), cho phép tìm kiếm, thiết kế, quản lý đơn hàng. Khách hàng có tài khoản sẽ thanh toán theo từng đợt (Deposit). Đặc biệt, hệ thống hỗ trợ luồng riêng cho **khách vãng lai (Walk-in Guest)** không cần tạo tài khoản, thao tác qua thiết bị của nhân viên, thanh toán 100% (Full Payment) và theo dõi đơn hàng bằng mã **Order Lookup Code**.
- **Lưu ý:** Có hệ thống quản lý giao hàng nội bộ và hệ thống quản lý bảo hành. Lấy vân tay và nhịp tim thực hiện tại cửa hàng bằng thiết bị IoT. Có 3 loại thiết kế: Cơ bản, nâng cao (khắc vân tay, sound wave) và memory card (hiển thị vân tay, sound wave, nhịp tim; cho phép nhập email người nhận optional để chia sẻ quyền sở hữu). HB không khắc lên nhẫn — chỉ hiển thị trên memory card.

#### 2. ACTOR

*(Giữ nguyên như bản cũ, bao gồm: Customer, Store Staff, Manager, Jeweler/Production Staff, Delivery/Logistics Staff, System Admin)*

#### 3. MAIN FLOW (CẬP NHẬT THÀNH 6 FLOW)

| Mã | Main flow | Actor | Mô tả ngắn |
| --- | --- | --- | --- |
| **MF-01** | Omnichannel Design Exploration (Khám phá và thiết kế đa kênh) | Customer, System, AI | Customer xem bộ sưu tập, chọn mẫu, sử dụng AI gợi ý. Thực hiện **Thiết kế cơ bản** + **chọn vị trí khắc FP/SW** (dùng mock image trên web). Lấy **Design Code** để tiếp tục trên App. |
| **MF-02** | Online Custom Ring Order (Đặt hàng thiết kế Online) | Customer, System, AI, Manager, Jeweler | Customer login App, nhập Design Code hoặc thiết kế mới. Qua 3 màn hình: (1) **Thiết kế cơ bản** -> (2) **Chọn gói (SW)** -> (3) **Thiết kế nâng cao** (thu âm, chọn 3s waveform, slider vị trí). Manager duyệt -> **Deposit** -> Jeweler chế tác -> **Remaining Payment**. |
| **MF-03** | Store Biometric Capture Order (Đặt hàng sinh trắc học tại cửa hàng) | Customer, Store Staff, IoT Device, System, Manager, Jeweler | Customer có tài khoản, chọn tổ hợp biometric (FP/HB/SW+FP/...). Xem **mock data preview** trên App. Thanh toán **Deposit 1** -> IoT capture tại store -> Manager duyệt -> **Deposit 2** -> Jeweler chế tác -> **Remaining Payment**. |
| **MF-04** | Walk-in Guest In-store Order (Khách vãng lai đặt tại cửa hàng) | Walk-in Guest, Store Staff, System, IoT Device, Manager, Jeweler | Store staff hỗ trợ khách vãng lai thiết kế qua iPad. Qua 3 màn hình design. Chọn tổ hợp biometric bất kỳ. Manager duyệt -> **Full Payment (100%)** -> **Order Lookup Code** -> Jeweler chế tác. |
| **MF-05** | Delivery, Pickup & QR Memory (Giao nhận và Mã QR Kỷ niệm) | Customer, Store/Delivery Staff, System, Manager, Jeweler | Jeweler hoàn thiện -> **Manager Accept (Nghiệm thu)** -> System báo Ready for Delivery. Khách nhận hàng, kích hoạt bảo hành và quét QR Memory bằng Secret key. |
| **MF-06** | Warranty & Service Claim (Bảo hành và Dịch vụ sau bán) | Customer, System, Manager, Store Staff, Jeweler | Customer tra cứu bảo hành bằng tài khoản hoặc **Order Lookup Code**. Tạo ticket -> Báo giá phí phát sinh (nếu có) -> Khách confirm -> Bàn giao nhẫn -> Xử lý dịch vụ. |

#### 4. BUSINESS RULE (BỔ SUNG)

- **BR-A01 đến BR-A08:** *(Giữ nguyên như bản cũ)*.
- **BR-A09:** Khách hàng Online (Flow 2) không cần duyệt lại bản Final sau khi Manager đã Approve. Hệ thống tự động chuyển sang bước Deposit.
- **BR-A10:** Đơn hàng Package 2 tại cửa hàng (Flow 3) yêu cầu thanh toán chia làm 3 giai đoạn: Deposit 1 (trước khi dùng IoT) -> Deposit 2 (sau khi Manager duyệt mẫu) -> Remaining Payment (trước khi nhận hàng).
- **BR-A11:** Khách vãng lai (Walk-in Guest - Flow 4) bắt buộc phải thanh toán 100% (Full Payment) ngay khi chốt đơn, không áp dụng chính sách đặt cọc nhiều đợt.
- **BR-A12:** Mọi sản phẩm sau khi Jeweler chế tác xong phải qua bước Manager kiểm tra và nghiệm thu (Accept) thì mới được chuyển sang trạng thái Ready for Delivery.
- **BR-A13:** Dịch vụ bảo hành/sửa chữa nằm ngoài chính sách miễn phí bắt buộc phải được xuất báo giá (Quotation) và có sự xác nhận thanh toán/đồng ý (Confirm) của khách hàng trước khi Store Staff tiếp nhận sản phẩm vật lý.
- **BR-A14:** Quy trình thiết kế trên Mobile gồm 3 màn hình bắt buộc theo thứ tự: (1) Simple Design → (2) Package Selection → (3) Advanced Design. Không được bỏ qua hoặc đảo thứ tự.
- **BR-A15:** Package Selection bắt buộc chọn ít nhất 1 biometric type (FP, SW, HB). Capture route xác định tự động: **ONLINE** nếu chỉ chọn SW; **OFFLINE** nếu có FP và/hoặc HB. **Lưu ý:** Chỉ **FP** và **SW** là có thể khắc lên nhẫn. **HB** chỉ hiển thị trên memory card, không có vị trí khắc trên nhẫn. **Quan trọng:** Dù chọn nhiều loại có thể khắc (FP+SW), người dùng **chỉ được chọn 1 loại duy nhất** để khắc lên nhẫn. Loại còn lại vẫn được thu thập và hiển thị trong memory card.
- **BR-A16:** Trong màn hình Advanced Design:
  - Nếu là **ONLINE (chỉ SW)**: Cho phép thu âm trực tiếp (5-15s), hiển thị waveform real-time, cho phép chọn đoạn 3s để khắc, slider chỉnh vị trí trên model 3D.
  - Nếu là **OFFLINE (có FP và/hoặc SW)**: Dữ liệu biometric thật chỉ được thu thập tại cửa hàng bằng IoT. Trên App hiển thị **dữ liệu placeholder** để người dùng thao tác chọn vị trí trước. Gồm các trường hợp:
    - **Có SW (và không FP)**: Hiển thị placeholder waveform, cho chọn 3s và slider vị trí (không cho thu âm thật). SW là engraving type mặc định.
    - **Có FP (và không SW)**: Hiển thị placeholder fingerprint trên model 3D, slider chỉnh vị trí. FP là engraving type mặc định.
    - **Có cả SW + FP**: Bắt buộc người dùng **chọn 1 trong 2 (FP hoặc SW)** để làm engraving type (loại khắc lên nhẫn). Loại còn lại chỉ hiển thị trong memory card. Sau khi chọn, hiển thị màn hình cấu hình tương ứng (placeholder waveform hoặc placeholder fingerprint).
  - **HB**: KHÔNG hiển thị trong Advanced Design engraving. HB chỉ được cấu hình trong phần memory card (hiển thị nhịp tim, không khắc lên nhẫn).
  - Vị trí khắc (position) đã được người dùng chọn từ trước (trên Web ở MF-01) sẽ được giữ nguyên khi thay placeholder data bằng dữ liệu thật.
  - `customization_config` lưu trường `engravedType` để xác định loại nào được khắc lên nhẫn (giá trị: `"fp"` hoặc `"sw"`).
- **BR-A17:** Memory card cho phép nhập **email người nhận (optional)**. Nếu người nhận sau này đăng ký tài khoản bằng email đó, họ sẽ được gắn quyền sở hữu memory card (shared ownership).
- **BR-A18:** Đối với các đơn có ít nhất 1 biometric type cần OFFLINE, giao diện Advanced Design phải hiển thị warning: "Đây chỉ là bản xem và chỉnh sửa trước. Để có thể sử dụng dữ liệu thật, vui lòng đến cửa hàng."

#### PAYMENT SUMMARY

| Flow | Capture Route | Thanh toán |
|------|---------------|-----------|
| MF-02 (Online - SW only) | ONLINE | 1 lần Deposit → Remaining Payment |
| MF-03 (Offline - có FP/HB) | OFFLINE | Deposit 1 (giữ IoT) → Deposit 2 (sau duyệt) → Remaining Payment |
| MF-04 (Walk-in) | OFFLINE (hoặc ONLINE nếu chỉ SW) | Full Payment (100% 1 lần) |
| MF-05 | - | Remaining Payment (nếu là đơn MF-02/MF-03) |

---

#### 5. CHI TIẾT CÁC FLOW

**A. Flow 1: Omnichannel Design Exploration (Web)**

1. Customer truy cập website. Hệ thống tự động tạo **`guest_session_id`** (UUID) lưu trong cookie trình duyệt.
2. Xem bộ sưu tập, chọn mẫu, xem vật liệu, mức giá tham khảo.
3. System hiển thị chi tiết (2D, 3D detail, inspiration...).
4. Customer thực hiện **Thiết kế cơ bản (Simple Design)**: Style & Shape, Metal/Material, Stone Type/Size, Ring Size, Finish.
5. **Customer chọn kích cỡ nhẫn (Choose Ring Size)**. *Hệ thống có popup khuyến khích người dùng sử dụng app trên điện thoại để đo size chính xác.*
6. **Chọn vị trí khắc (Engraving Position - optional):**
   - Web hiển thị các **placeholder images** (hình mẫu) cho fingerprint và/hoặc sound wave.
   - Người dùng kéo thả để đặt vị trí khắc FP và/hoặc SW lên hình ảnh placeholder của nhẫn.
   - Dữ liệu vị trí (góc, toạ độ X/Y, scale) được lưu vào `customization_config` với `status = "pending"`.
   - *Lưu ý:* Đây chỉ là vị trí tạm, `imageUrl` sẽ được replace bằng URL thật sau khi thu thập sinh trắc học. HB không khắc lên nhẫn nên không có bước này.
   - *`engravedType` chưa xác định ở bước này* — việc chọn loại nào (FP/SW) để khắc lên nhẫn sẽ được quyết định ở màn hình Advanced Design trên Mobile (MF-02/03/04) sau khi chọn package.
7. Toàn bộ dữ liệu được lưu vào `design_drafts` với `guest_session_id` (từ cookie), `design_source = "WEB"`, `status = "DRAFT"`.
8. System sinh ra mã thiết kế duy nhất **(Generate Design Code, VD: RS-A7B9X2)**.
9. Khách hàng lưu mã này để tiếp tục thiết kế (chọn package, thiết kế nâng cao) bằng cách đăng nhập trên Mobile App. *(Web chỉ hỗ trợ Simple Design + Engraving Position, không có Package Selection hay Advanced Design thu âm/waveform thật).*

**B. Flow 2: Online Custom Ring Order (Mobile - Chỉ SW - ONLINE)**

Flow 2 cho phép **lưu dần (incremental save)** — mọi dữ liệu thiết kế đều được save ngay vào `engraving_versions.customization_config` qua `PATCH /api/v1/engravings/:versionId/config`. User có thể out ra bất cứ lúc nào, quay lại sau tiếp tục từ bước còn dang dở.

1. Customer Login vào App (Ring Studio).
2. **Nhập Design Code hoặc tạo mới:**
   - Nếu có Design Code (từ MF-01 web): gọi `ClaimDesignDraft` → System tạo **Engraving + EngravingVersion v1** copy customization_config từ draft, draft chuyển `CONVERTED`. **Đồng thời tạo record `qr_memories` mặc định** với `qr_code` (nanoid), `access_pin_hash` (SHA256), `is_locked = true`. Trả về `engravingVersionId` để mobile dùng cho mọi lần save tiếp theo.
   - Nếu thiết kế mới: gọi `CreateEngraving` → System tạo Engraving + EngravingVersion v1 rỗng + `qr_memories` mặc định. Trả về `engravingVersionId`.
   - *Data đã lưu:* EngravingVersion v1 + qr_memories trong DB, order_id = null, draft.status = CONVERTED.
3. **Màn hình 1 - Simple Design + Position** (incremental save):
   - Load `customization_config` từ EngravingVersion mới nhất.
   - Nếu đã có vị trí (từ MF-01): hiển thị lên model 3D.
   - Bấm **Continue** → `PATCH /api/v1/engravings/:versionId/config { customizationConfig: { ..., engravingPositions } }`.
   - *Data đã lưu:* Vị trí khắc (tọa độ, góc, scale) trong customization_config.engravingPositions.
   - *Nếu user out ra:* Quay lại sau → load EngravingVersion → thấy engravingPositions đã có → hiển thị lại đúng vị trí.
4. **Màn hình 2 - Package Selection** (incremental save):
   - Chọn **SW (Sound Wave)** → capture route = **ONLINE**.
   - Bấm **Next** → `PATCH /api/v1/engravings/:versionId/config { customizationConfig: { ..., selectedBiometrics: ['SW'] } }`.
   - *Data đã lưu:* customization_config có thêm `selectedBiometrics: ['SW']`.
   - *Nếu user out ra:* Quay lại sau → thấy selectedBiometrics đã có → bỏ qua màn hình này.
   - *captureRoute tự suy:* `['SW']` → ONLINE, có FP/HB → OFFLINE.
5. **Màn hình 3 - Advanced Design (SW only)** (incremental save từng bước nhỏ):
   - Hiển thị **model 3D tương tác** của nhẫn (có thể xoay, zoom).
   - **Bước 5a - Ghi âm:** User thu âm 5-15 giây. Mobile gọi API `POST /api/v1/me/engravings/:engravingId/biometrics` (Multipart upload) để gửi file audio trực tiếp.
     - Server lưu trữ và tạo biometric asset, trả về `biometricAssetId`. (Biometric asset chạy ngầm qua Python REVIEW pipeline để tạo PBR Textures).
   - **Bước 5b - Chọn 3s + vị trí:**
     - Mobile polling API `GET /api/v1/me/biometric-assets/:assetId/viewer-assets` để lấy bộ `viewerFiles` (normalMap, alphaMap, roughnessMap...).
     - Mobile render model 3D bằng Decal Mesh với bộ texture PBR. User chọn đoạn 3s, kéo slider vị trí. Gọi `PATCH /api/v1/engravings/:versionId/config { customizationConfig: { ..., engravingPositions: { sw: { selectedSegment, position } } } }`. Đồng thời gọi `POST /api/v1/me/biometric-assets/:assetId/confirm-placement` để chốt vị trí.
   - *Data đã lưu:* Hệ thống tạo `BiometricAsset`, lưu vết ở `engraving_biometrics`. Customization config lưu vị trí khắc.
   - *Nếu user out ra sau bước 5a:* Quay lại sau → gọi `GET /api/v1/me/engravings/:engravingId/biometrics` lấy được `biometricAssetId` → gọi `viewer-assets` → hiển thị lại model 3D → tiếp tục bước 5b.
6. **Thiết kế memory card** (QR memory):
   - Nhập cardTitle, greetingMessage, recipientEmail (optional).
   - Bấm **Save** → gọi `PUT /api/v1/qr-memories/:engravingId { cardTitle, greetingMessage, recipientEmail }`.
   - *Data đã lưu:* trực tiếp trong `qr_memories` table (card_title, greeting_message, recipient_email). **Không lưu trong customization_config.**
   - *Nếu user out ra:* Quay lại sau → load `qr_memories` record → thấy dữ liệu → tiếp tục chỉnh sửa hoặc bỏ qua.
7. **Tạo đơn hàng — sau Package Selection:**
   - Gọi `POST /api/v1/orders { engravingId, packageType }`.
   - **Lưu ý:** Lúc này `selectedBiometrics` đã lưu qua PATCH config. Server dùng `packageType` client gửi để xác định captureRoute và initial status.
   - System tạo Order với `engraving_id = engravingId` (1:1), `status = AWAITING_SUBMIT`.
   - *Data:* Order mới trong DB, engraving gắn vào order qua `orders.engraving_id`.
   - **Sau đó tiếp tục Advanced Design + Memory Card** (order đang AWAITING_SUBMIT).
8. **Manager thực hiện Final Design Review** (1 order = 1 engraving, không còn granular review).
   - Manager gửi `PATCH /api/v1/orders/:id/review { action, note }`.
9. Nếu Manager Reject:
   - **EngravingVersion hiện tại** → `REJECTED` (giữ lại lịch sử).
   - **engravings.status** → `REJECTED`.
   - System **tự động tạo EngravingVersion mới** (version_number + 1, status = `PENDING`) copy toàn bộ `customization_config` từ version vừa bị reject.
   - Order status → `REVISION_REQUIRED`.
   - **Customer chỉnh sửa → gọi `POST /api/v1/engravings/versions/:id/resubmit`** → version → `PENDING`, order → `PENDING_REVIEW`.
   - *Lưu ý:* `PATCH config` chỉ lưu tạm, KHÔNG đẩy đi duyệt. Phải gọi resubmit riêng.
10. Nếu Manager Approve:
    - **EngravingVersion hiện tại** → `APPROVED`, set `approved_version_id` trên engraving.
    - **engravings.status** → `APPROVED`.
    - Hệ thống cập nhật `qr_memories.biometric_display_settings` từ `engraving_biometrics` data (waveform SVG URL, fingerprint SVG URL, v.v.).
    - Order → `AWAITING_DEPOSIT`. Yêu cầu khách hàng thanh toán Deposit 2.
11. Customer thanh toán **Deposit 2** (30% min 3000) để xác nhận bắt đầu sản xuất.
12. **Customer chọn địa chỉ giao hàng:**
    - Màn hình Delivery Options hiển thị sau khi deposit callback thành công.
    - Customer có thể **thêm mới** hoặc **chọn địa chỉ có sẵn** từ `user_addresses`.
    - Gọi `POST /api/v1/orders/:id/delivery-preference` với `{ addressId, method: 'DELIVERY' | 'PICKUP' }`.
    - Hệ thống tạo `shipments` record với `status = 'PENDING'`.
    - Order vẫn giữ `AWAITING_REMAINING`.
13. System assign task cho Jeweler (1 task).
14. Jeweler hoàn thành chế tác nhẫn (Complete).
15. Customer thanh toán **Remaining Payment** trước khi nhận sản phẩm.
    - Nếu đã có shipment PENDING → server auto update `status = 'ACTIVE'`.
    - Nếu `method = 'DELIVERY'` → order → `READY_FOR_DELIVERY`.
    - Nếu `method = 'PICKUP'` → order → `READY_FOR_PICKUP`.

**C. Flow 3: Store Biometric Capture Order (Mobile - Có FP/SW - OFFLINE)**

1. Customer Login vào App, nhập Design Code (nếu có) để đồng bộ thiết kế cơ bản và vị trí khắc.
2. **Màn hình 1 - Simple Design + Position:** Kế thừa từ Design Code hoặc thiết kế mới. Load `customization_config` (vị trí FP/SW từ web) → bấm **Continue**.
3. **Màn hình 2 - Package Selection:** Chọn tổ hợp biometric có FP và/hoặc SW (VD: FP, SW+FP, SW+HB, FP+HB, ALL) → capture route = **OFFLINE**. Bấm **Next**.
4. **POST /orders { engravingId, packageType } → `AWAITING_DEPOSIT_1`** (tạo order ngay, để charge IoT fee).
5. **Customer thanh toán Deposit 1** (IoT fee cố định) → `AWAITING_CAPTURE`.
6. Customer đến cửa hàng. Store Staff xác minh đơn hàng, chuẩn bị thiết bị IoT.
7. Store Staff hỗ trợ lấy dữ liệu (vân tay, giọng nói) thông qua IoT Device:
   - Staff gọi `POST /api/v1/admin/biometric-assets/fingerprint` (hoặc `soundwave`) để upload raw data → **Python REVIEW pipeline**.
   - Staff xem kết quả render PBR qua `GET /api/v1/admin/biometric-assets/:assetId`. (Nếu cần có thể `reprocess` hoặc `textures` lại).
   - Khi hoàn thiện, Staff duyệt tài sản: `POST /api/v1/admin/biometric-assets/:assetId/approve`.
   - Cuối cùng, Staff gán asset này vào đơn hàng của khách: `POST /api/v1/admin/biometric-assets/:assetId/assign`.
8. **Màn hình 3 - Advanced Design (OFFLINE - với dữ liệu thật sau IoT):**
   - App Customer gọi `GET /api/v1/me/engravings/:engravingId/biometrics` để lấy danh sách biometric (gồm `biometricAssetId` do Staff gán).
   - Dùng `assetId`, App gọi `GET /api/v1/me/biometric-assets/:assetId/viewer-assets` lấy bộ PBR Textures (normalMap, alphaMap, overlayPng...) và render lên model 3D (Decal Mesh).
   - Giao diện phụ thuộc vào tổ hợp đã chọn:
     - **Có cả SW + FP (SW+FP / ALL):** Hiển thị UI **chọn engraving type**: "Bạn muốn khắc loại nào lên nhẫn? (FP hoặc SW). Loại còn lại sẽ vào memory card."
       - *Sau khi chọn (VD FP):* Hiển thị PBR texture vân tay trên nhẫn 3D. Khách kéo slider vị trí. Gọi `PATCH /api/v1/engravings/:versionId/config` để lưu tọa độ. Đồng thời gọi `POST /api/v1/me/biometric-assets/:assetId/confirm-placement` để chốt Decal UV. Lưu `engravedType = "fp"|"sw"`.
     - **HB only:** Không khắc lên nhẫn. `engravedType = null`. Chuyển thẳng sang bước 9.
9. **Thiết kế memory card** (kèm recipient email optional - xem BR-A17). HB được cấu hình tại đây (hiển thị nhịp tim, không khắc lên nhẫn).
10. **PATCH /orders/:id/submit → `PENDING_REVIEW`**.
11. **Manager thực hiện Final Design Review** (1 order = 1 engraving).
12. Nếu Reject → engraving version REJECTED + branch mới, order → `REVISION_REQUIRED`. Chỉnh sửa → resubmit.
13. Nếu Approve → engraving APPROVED, order → `AWAITING_DEPOSIT`.
14. Customer thanh toán **Deposit 2** (30% min 3000) để xác nhận bắt đầu chế tác.
15. **Customer chọn địa chỉ giao hàng:**
    - Màn hình Delivery Options hiển thị sau khi deposit callback thành công.
    - Customer có thể **thêm mới** hoặc **chọn địa chỉ có sẵn** từ `user_addresses`.
    - Gọi `POST /api/v1/orders/:id/delivery-preference` với `{ addressId, method: 'DELIVERY' | 'PICKUP' }`.
    - Hệ thống tạo `shipments` record với `status = 'PENDING'`.
    - Order vẫn giữ `AWAITING_REMAINING`.
16. System assign task cho Jeweler (1 task). Jeweler sản xuất xong báo Complete.
17. Customer thanh toán **Remaining Payment** trước khi nhận hàng.
    - Nếu đã có shipment PENDING → server auto update `status = 'ACTIVE'`.
    - Nếu `method = 'DELIVERY'` → order → `READY_FOR_DELIVERY`.
    - Nếu `method = 'PICKUP'` → order → `READY_FOR_PICKUP`.

**D. Flow 4: Walk-in Guest In-store Order (Luồng khách vãng lai - iPad Staff)**

1. Khách vãng lai (Walk-in Guest) đến trực tiếp cửa hàng. Store Staff tiếp đón và mở Ring Catalog trên iPad.
2. **Màn hình 1 - Simple Design + Position:** Staff hỗ trợ khách chọn mẫu, cấu hình thiết kế cơ bản, chọn vị trí khắc FP/SW (dùng placeholder image). Bấm **Continue**.
3. **Màn hình 2 - Package Selection:** Khách chọn tổ hợp biometric bất kỳ (SW, FP, HB, SW+FP, SW+HB, FP+HB, ALL).
   - Nếu chỉ chọn **SW** → capture route = **ONLINE** (xử lý online trên iPad).
   - Nếu có **FP và/hoặc HB** → capture route = **OFFLINE** (dùng IoT tại chỗ).
4. **Màn hình 3 - Advanced Design:**
   - **Trường hợp ONLINE (chỉ SW):** Ghi âm trực tiếp trên iPad (5-15s) → chọn 3s waveform → slider chỉnh vị trí (kế thừa từ bước 2) → preview 3D real-time. `engravedType = "sw"`.
   - **Trường hợp OFFLINE (có FP/SW):**
     - Staff thực hiện upload IoT (`POST /fingerprint`), sau đó duyệt (`POST /approve`) và gán (`POST /assign`) thông qua bộ API Admin của Biometric Asset.
     - App trên iPad tự động lấy `viewer-assets` của `assetId` vừa duyệt để hiển thị 3D PBR Model vô cùng chân thực ngay trước mặt khách. Khách chốt vị trí (`POST /confirm-placement`).
     - Nếu có **cả FP + SW**: Chọn 1 loại để khắc lên nhẫn.
     - Lưu `engravedType` tương ứng.
   - **HB:** Không khắc lên nhẫn, chỉ cấu hình trong memory card.
5. Thiết kế memory card (kèm recipient email optional). HB được cấu hình tại đây.
6. Gửi thiết kế lên System. **Manager thực hiện Review**.
7. Sau khi Manager Approve, System tạo **Guest Order** (Không yêu cầu đăng ký tài khoản).
8. Khách hàng **thanh toán toàn bộ (Full Payment - 100%)**.
9. Hệ thống sinh **Order Lookup Code (VD: ORD-123)** cấp cho khách.
10. System assign task cho Jeweler tiến hành sản xuất.

**E. Flow 5: Delivery, Pickup & QR Memory**

1. Nhẫn được Jeweler chế tác xong (Complete).
2. **Manager kiểm tra sản phẩm thực tế và thực hiện Accept (Nghiệm thu)** trên hệ thống.
3. System cập nhật trạng thái đơn hàng thành **Ready for Delivery** và gửi thông báo (App/Email) cho Customer.
4. Customer thanh toán Remaining Payment (Đối với đơn Flow 2, Flow 3. Đơn Walk-in Flow 4 đã thanh toán Full nên bỏ qua).
5. Lựa chọn hình thức nhận hàng:
   - **Store Pickup:** Khách đến cửa hàng. Store Staff kiểm tra mã đơn, bàn giao sản phẩm trực tiếp.
   - **Internal Delivery:** Nhân viên giao hàng nội bộ đóng gói, tạo mã tracking, đi giao và xác nhận khách nhận hàng.
6. Customer nhận sản phẩm vật lý. Hệ thống tự động **Kích hoạt bảo hành (Activate Warranty)** bao gồm bảo hành giấy và bảo hành điện tử.
7. Customer hoặc người được tặng quét mã QR Memory đi kèm.
8. Yêu cầu nhập Secret Key. Nếu đúng, màn hình hiển thị nội dung Memory Card (Voice, waveform, vân tay, nhịp tim (HB), thông điệp...).
9. *Nếu người dùng đã nhập **recipient email** khi thiết kế memory card: system ghi nhận shared ownership. Khi người nhận đăng ký tài khoản bằng email đó, họ sẽ tự động sở hữu memory card này (xem BR-A17).*

**F. Flow 6: Warranty & Service Claim**

1. Customer bắt đầu quy trình yêu cầu bảo hành/dịch vụ bằng cách:
   - Xem trực tiếp từ danh sách đơn đã mua (khách có Account).
   - Hoặc nhập mã **Order Lookup Code** (khách vãng lai).
2. System hiển thị trạng thái bảo hành (View Warranty Status) và lịch sử dịch vụ.
3. Customer chọn loại dịch vụ cần hỗ trợ (Warranty claim, Cleaning, Adjust Size, Repair...).
4. Customer mô tả vấn đề và Upload hình ảnh/video tình trạng sản phẩm (Submit Service Request).
5. System tạo Service ticket và phân tuyến cho Manager.
6. **Manager kiểm tra (Review result):** Check chính sách bảo hành, tính hợp lệ.
   - *Trường hợp trong phạm vi bảo hành (Approved Warranty):* Duyệt yêu cầu miễn phí.
   - *Trường hợp ngoài phạm vi bảo hành (Reject/Paid Service):* Hệ thống xuất thông báo phí phát sinh và báo giá (Fee notice, quotation) gửi cho khách hàng.
7. **Khách hàng xác nhận (Confirm):** Xem báo giá và đồng ý thanh toán thêm phí dịch vụ.
8. Khách hàng mang nhẫn đến cửa hàng hoặc gửi qua vận chuyển.
9. **Store Staff tiếp nhận (Confirm condition):** Kiểm tra tình trạng vật lý đối chiếu với ticket, xác nhận nhận hàng và chuyển phiếu cho bộ phận sản xuất.
10. Jeweler thực hiện sửa chữa, vệ sinh, chỉnh size. Sau khi xong (Received product + ticket update), cập nhật chi phí (nếu có biến động nhẹ) lên System.
11. Customer thanh toán chi phí sửa chữa (Extra Payment If Any).
12. Customer nhận lại sản phẩm hoàn thiện. System cập nhật lại Warranty history.
