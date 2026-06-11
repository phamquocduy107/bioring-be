# Docs: Cách tách phần dùng chung để làm template NestJS microservice

Mục tiêu của tài liệu này là tách phần nền tảng dùng chung ra khỏi dự án hiện tại để biến repo thành một template sạch. Sau này chỉ cần clone repo này là có thể bắt đầu một NestJS microservice app mới ngay.

## Cách dùng checklist này

- Mỗi mục dùng dạng checkbox để bạn tick khi hoàn thành.
- Làm theo đúng thứ tự từ trên xuống dưới.
- Nếu một mục có nhiều file con, hãy copy xong cả cụm rồi mới tick.
- Gợi ý trạng thái:
	- `[ ]` chưa làm
	- `[~]` đang làm dở
	- `[x]` đã xong

## 1. Mục tiêu template

Template nên chứa 3 lớp chính:

1. Khung monorepo và cấu hình build/lint.
2. Shared libraries dùng chung cho nhiều service.
3. Một app starter tối thiểu để nhân bản nhanh.

Không nên giữ các module nghiệp vụ riêng của OrchidPal trong template.

## 2. Checklist copy theo từng phase

### Phase A - Dọn nền repo

- [ ] Tạo repo template mới sạch, không lẫn code nghiệp vụ cũ.
- [x] Giữ lại `package.json` và kiểm tra lại tên package, scripts, dependencies.
- [x] Giữ lại `nest-cli.json` và kiểm tra các project trong monorepo.
- [x] Giữ lại `tsconfig.json` và `tsconfig.build.json`.
- [x] Giữ lại `eslint.config.mjs`.
- [x] Giữ lại `.prettierrc`.
- [x] Giữ lại `.gitignore`.
- [x] Tạo sẵn `.env.example` cho template mới.

### Phase B - Copy `libs/common`

Đây là phần quan trọng nhất, vì nó chứa gần như toàn bộ logic dùng chung.

- [x] Copy nguyên thư mục `libs/common`.
- [x] Giữ `libs/common/src/common.module.ts`.
- [x] Giữ `libs/common/src/index.ts`.
- [x] Giữ `libs/common/src/config`.
- [x] Giữ `libs/common/src/constants`.
- [x] Giữ `libs/common/src/decorators`.
- [x] Giữ `libs/common/src/dtos`.
- [x] Giữ `libs/common/src/enums`.
- [x] Giữ `libs/common/src/filters`.
- [x] Giữ `libs/common/src/guards`.
- [x] Giữ `libs/common/src/interceptors`.
- [x] Giữ `libs/common/src/interfaces`.
- [x] Giữ `libs/common/src/pipes`.
- [x] Giữ `libs/common/src/queue`.
- [x] Giữ `libs/common/src/rbac`.
- [x] Giữ `libs/common/src/swagger`.

Sau khi copy xong, kiểm tra các phần lõi sau:

- [x] `CustomValidationPipe`
- [x] `AllExceptionsFilter`
- [x] `FitRpcExceptionFilter`
- [x] `AuthGuard`
- [x] `LoggingInterceptor`
- [x] `TimeoutInterceptor`
- [x] `TransformInterceptor`
- [x] `RmqModule` và `RmqService`
- [x] `BullConfigModule`
- [x] helper Swagger và decorator dùng chung

### Phase C - Copy hạ tầng dữ liệu và cache

Chỉ giữ nếu template của bạn muốn có sẵn các lớp hạ tầng này.

- [x] Copy `libs/prisma`.
- [x] Giữ `libs/prisma/src/prisma.module.ts`.
- [x] Giữ `libs/prisma/src/prisma.service.ts`.
- [x] Giữ `libs/prisma/prisma/schema.prisma` (đã làm sạch, chỉ giữ datasource + generator + Example model mẫu).
- [x] Copy `libs/redis`.
- [x] Giữ `libs/redis/src/redis.module.ts`.
- [x] Giữ `libs/redis/src/redis.service.ts`.
- [x] Copy `libs/mongo`.
- [x] Giữ `libs/mongo/src/mongo.module.ts`.
- [x] Giữ `libs/mongo/src/mongo.service.ts`.

### Phase D - Giữ app starter tối thiểu

Nên chỉ giữ 2 kiểu app mẫu để sau này clone ra service mới:

- [x] Giữ một app HTTP/gateway tối thiểu (`apps/nestjs-template` — có Swagger, AuthGuard, global providers).
- [x] Giữ một app microservice tối thiểu (`apps/nestjs-template2` — TCP, FitRpcExceptionFilter).
- [x] Mỗi app chỉ giữ bootstrap, module, controller/service mẫu.
- [x] Xóa toàn bộ domain đặc thù của OrchidPal khỏi app mẫu.

### Phase E - Dọn domain nghiệp vụ cũ

Không copy các phần này sang template chung:

- [x] Xóa toàn bộ module nghiệp vụ trong `apps/api-gateway/src/modules` (template không có domain cụ thể).
- [x] Xóa các domain riêng như auth, users, rbac, products, carts, orders, payment, shipments, telemetry, devices, garden, refund-return.
- [x] Xóa hoặc tách riêng `docker-compose.yml` (không copy vào template).
- [x] Xóa các env key đặc thù của dự án hiện tại như `PAYOS_*`, `MQTT_*`, queue/service name riêng.

### Phase F - Rà lại cấu hình map và script

- [x] Kiểm tra lại alias trong `tsconfig.json` (đủ 4 alias: common, prisma, redis, mongo).
- [x] Kiểm tra lại path mapping trong `package.json` (jest moduleNameMapper cho 4 libs).
- [x] Xóa alias không tồn tại như `@app/util` (không copy vào template).
- [x] Đổi tên app, queue, service name, swagger title sang tên trung tính.
- [x] Chuẩn hóa biến môi trường để dùng cho nhiều dự án (`.env.example` đã làm sạch).
- [x] Kiểm tra các script trong `package.json` để không phụ thuộc tên app OrchidPal.

### Phase G - Validation cuối

- [x] Chạy `npm install` hoặc `npm i` để chắc dependency không lỗi.
- [x] Chạy build.
- [x] Chạy lint.
- [ ] Chạy test nếu template có test base.
- [x] Mở lại `nest-cli.json` để xác nhận chỉ còn project/lib thật sự cần.
- [ ] Commit repo template khi mọi phase đều đã tick xong.

## 3. Checklist copy theo thứ tự thực hiện thực tế

Đây là thứ tự mình khuyên bạn làm khi copy từng phần qua:

1. [ ] Copy file cấu hình gốc trước.
2. [x] Copy `libs/common` tiếp theo.
3. [x] Copy `libs/prisma`, `libs/redis`, `libs/mongo` nếu cần.
4. [x] Giữ lại một gateway app mẫu.
5. [x] Giữ lại một microservice app mẫu.
6. [x] Xóa toàn bộ module nghiệp vụ OrchidPal.
7. [x] Rà lại alias, env, script, tên app.
8. [x] Tạo `.env.example` chuẩn chung.
9. [x] Chạy build/lint/test.
10. [ ] Commit template sạch.

## 4. Tiêu chí xong từng phần

Bạn có thể coi một phần là hoàn thành khi:

- File hoặc folder đã được copy sang repo template mới.
- Không còn import bị đứt do thiếu file.
- Không còn tên service/domain OrchidPal trong phần đó.
- Build của phần vừa copy không báo lỗi mới.

## 5. Phần nên giữ lại

### 5.1. Cấu hình gốc của monorepo

Giữ các file sau để mọi repo mới có cùng chuẩn:

- `package.json`
- `nest-cli.json`
- `tsconfig.json`
- `tsconfig.build.json`
- `eslint.config.mjs`
- `.prettierrc`
- `.gitignore`

### 5.2. Shared libraries

Nên copy nguyên các lib dùng chung sau:

- `libs/common`
- `libs/prisma`
- `libs/redis`
- `libs/mongo`

Trong đó `libs/common` là phần quan trọng nhất, gồm:

- `CommonModule`
- `CustomValidationPipe`
- `AllExceptionsFilter`
- `FitRpcExceptionFilter`
- `AuthGuard`
- `LoggingInterceptor`
- `TimeoutInterceptor`
- `TransformInterceptor`
- `RmqModule` và `RmqService`
- `BullConfigModule`
- các decorator, constant, DTO, guard, filter, swagger helper

### 5.3. App starter tối thiểu

Nên giữ 2 kiểu app mẫu:

- 1 app HTTP/gateway mẫu
- 1 app microservice mẫu

Mỗi app chỉ cần bootstrap tối thiểu, không gắn nghiệp vụ OrchidPal.

## 6. Kết luận

Nếu mục tiêu là clone về rồi dev ngay, template nên gồm:

- monorepo config
- shared libs
- một app gateway starter
- một app microservice starter
- `.env.example`
- cấu hình lint, prettier, tsconfig và nest-cli

Toàn bộ nghiệp vụ OrchidPal nên để ngoài template.