# NestJS Microservice Template

Đây là một template hoàn chỉnh để xây dựng hệ thống phân tán với **NestJS** theo kiến trúc Monorepo. Template đã được cấu hình sẵn các thành phần dùng chung (core, hạ tầng, cache, queue) để bạn có thể tập trung ngay vào việc phát triển nghiệp vụ.

## 🌟 Các tính năng và thư viện tích hợp sẵn

- **Kiến trúc Monorepo**: Dễ dàng quản lý nhiều ứng dụng (API Gateway, Microservices) và thư viện dùng chung trong một repository.
- **API Gateway**: Mẫu ứng dụng HTTP được tích hợp sẵn **Swagger** (tại `/docs`), CORS, Cookie Parser và hệ thống global Guard/Interceptor.
- **Microservice**: Mẫu ứng dụng Microservice dùng giao thức TCP (hoặc RabbitMQ) với `FitRpcExceptionFilter` tùy biến.
- **Cơ sở dữ liệu**: Tích hợp sẵn **Prisma** (PostgreSQL) và **Mongoose** (MongoDB).
- **Caching & Queue**: Tích hợp sẵn **Redis** (`ioredis`) và **BullMQ** (có sẵn Bull-Board UI).
- **Giao tiếp Message Broker**: Đã thiết lập sẵn module `RmqModule` và `RmqService` để kết nối và truyền tin qua **RabbitMQ**.
- **Common Library (`libs/common`)**: Thư viện dùng chung chứa:
  - Các Decorator tự định nghĩa (`@Public`, `@CurrentUser`, `@Roles`, `@Permission`,...).
  - DTOs, Enums, Constants chuẩn mực.
  - Global Exception Filters (`AllExceptionsFilter`, `FitRpcExceptionFilter`).
  - Global Interceptors (`LoggingInterceptor`, `TimeoutInterceptor`, `TransformInterceptor`).
  - Phân quyền RBAC.

## 🚀 Hướng dẫn bắt đầu nhanh

### 1. Cài đặt

Yêu cầu môi trường: **Node.js (>= 20)**.

```bash
# Clone repo của bạn
$ git clone <your-repo-url> my-microservice-project
$ cd my-microservice-project

# Cài đặt các gói phụ thuộc
$ npm install
```

### 2. Cấu hình biến môi trường

Tạo file `.env` từ file mẫu:

```bash
$ cp .env.example .env
```

Vui lòng cập nhật các thông số kết nối Database (PostgreSQL, MongoDB), Redis, và RabbitMQ trong file `.env` theo môi trường của bạn.

### 3. Khởi tạo Prisma (Nếu dùng PostgreSQL)

Bạn cần sửa file `libs/prisma/prisma/schema.prisma` theo mô hình dữ liệu thực tế của dự án, sau đó chạy:

```bash
# Đồng bộ schema lên database (Development)
$ npm run prisma:migrate

# Generate Prisma Client
$ npm run prisma:generate
```

### 4. Chạy dự án (Development)

Sử dụng lệnh `dev` để chạy đồng thời cả API Gateway và Microservice mẫu thông qua thư viện `concurrently`:

```bash
$ npm run dev
```

Hoặc chạy từng service độc lập:

```bash
# Chạy API Gateway (Mặc định ở cổng 3000)
$ npm run start:gateway

# Chạy Microservice (Mặc định TCP cổng 3001)
$ npm run start:service
```

Sau khi chạy thành công API Gateway, hãy truy cập [http://localhost:3000/docs](http://localhost:3000/docs) để xem tài liệu Swagger.

## 🛠 Cấu trúc thư mục

```text
nestjs-template/
├── apps/
│   ├── nestjs-template/      # Ứng dụng HTTP (API Gateway) mẫu
│   └── nestjs-template2/     # Ứng dụng TCP (Microservice) mẫu
├── libs/
│   ├── common/               # Core logic, module dùng chung (Auth, Filters, Queue,...)
│   ├── mongo/                # Module kết nối MongoDB (Mongoose)
│   ├── prisma/               # Module kết nối PostgreSQL (Prisma)
│   └── redis/                # Module kết nối Redis (ioRedis)
├── .env.example              # Mẫu biến môi trường
├── nest-cli.json             # Cấu hình Nest CLI cho Monorepo
├── package.json              # Khai báo thư viện và script
└── tsconfig.json             # Cấu hình TypeScript (Kèm path alias)
```

## 📜 Các lệnh (Scripts) hữu ích

| Lệnh | Ý nghĩa |
|------|---------|
| `npm run dev` | Khởi chạy đồng thời tất cả các ứng dụng trong chế độ `--watch`. |
| `npm run build` | Build toàn bộ ứng dụng (nest build). |
| `npm run lint` | Kiểm tra và tự động sửa lỗi syntax với ESLint. |
| `npm run format` | Định dạng lại code với Prettier. |
| `npm run prisma:generate` | Tạo mã nguồn Prisma Client dựa trên file `schema.prisma`. |
| `npm run prisma:pull` | Pull cấu trúc database hiện tại về `schema.prisma`. |
| `npm run prisma:migrate` | Áp dụng thay đổi `schema.prisma` lên database (chỉ dùng ở môi trường dev). |

## 💡 Lưu ý khi tạo Microservice mới

Khi muốn tạo thêm một ứng dụng mới trong Monorepo:

1. Chạy lệnh: `npx nest generate app my-new-service`
2. Mở file `nest-cli.json` để kiểm tra cấu hình của app mới.
3. Nếu ứng dụng mới là HTTP (có dùng Swagger), hãy thêm plugin `@nestjs/swagger` vào mảng `compilerOptions.plugins` của app đó trong `nest-cli.json`.
4. Cập nhật câu lệnh start/build tương ứng vào `package.json` (ví dụ: `"start:my-service": "nest start my-new-service --watch"`).

---
*Được tạo thành công từ việc tách cấu trúc cốt lõi của OrchidPal.*
