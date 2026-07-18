# Plan: Thêm identity-service và biometric-service

## Tổng quan

Thêm 2 microservice mới (identity-service, biometric-service) vào NestJS monorepo,
tương tự ecommerce-service hiện tại, bao gồm source code, proto, api-gateway integration,
CI/CD, và ArgoCD manifests.

---

## 1. Source code (`C:\BTFPT\WDP\bioring-be`)

### 1.1 Proto files

| File | Nội dung |
|------|----------|
| `proto/identity.proto` | package: `identity`, service: `IdentityService`, rpc Ping |
| `proto/biometric.proto` | package: `biometric`, service: `BiometricService`, rpc Ping |

### 1.2 App: identity-service

| File | Mô tả |
|------|-------|
| `apps/identity-service/tsconfig.app.json` | extends tsconfig.json, output `dist/apps/identity-service` |
| `apps/identity-service/src/main.ts` | Microservice GRPC, port `IDENTITY_GRPC_URL` (default 50052) |
| `apps/identity-service/src/identity-service.module.ts` | Module với CommonModule, filter/pipe/interceptor global |
| `apps/identity-service/src/identity-service.controller.ts` | `@GrpcMethod('IdentityService', 'Ping')` |
| `apps/identity-service/src/identity-service.service.ts` | Logic xử lý Ping |
| `apps/identity-service/src/identity-service.controller.spec.ts` | Unit test |
| `apps/identity-service/test/jest-e2e.json` | E2E test config |
| `apps/identity-service/test/app.e2e-spec.ts` | E2E test spec |

### 1.3 App: biometric-service

| File | Mô tả |
|------|-------|
| `apps/biometric-service/tsconfig.app.json` | extends tsconfig.json, output `dist/apps/biometric-service` |
| `apps/biometric-service/src/main.ts` | Microservice GRPC, port `BIOMETRIC_GRPC_URL` (default 50053) |
| `apps/biometric-service/src/biometric-service.module.ts` | Module với CommonModule, filter/pipe/interceptor global |
| `apps/biometric-service/src/biometric-service.controller.ts` | `@GrpcMethod('BiometricService', 'Ping')` |
| `apps/biometric-service/src/biometric-service.service.ts` | Logic xử lý Ping |
| `apps/biometric-service/src/biometric-service.controller.spec.ts` | Unit test |
| `apps/biometric-service/test/jest-e2e.json` | E2E test config |
| `apps/biometric-service/test/app.e2e-spec.ts` | E2E test spec |

### 1.4 API Gateway modules

Mỗi service cần 1 module trong api-gateway:

| File | Mô tả |
|------|-------|
| `apps/api-gateway/src/modules/identity/identity.module.ts` | ClientsModule.register với gRPC identity |
| `apps/api-gateway/src/modules/identity/identity.controller.ts` | REST endpoints `/identity/health`, `/identity/ping` |
| `apps/api-gateway/src/modules/identity/identity.service.ts` | Proxy gRPC calls tới identity-service |
| `apps/api-gateway/src/modules/biometric/biometric.module.ts` | ClientsModule.register với gRPC biometric |
| `apps/api-gateway/src/modules/biometric/biometric.controller.ts` | REST endpoints `/biometric/health`, `/biometric/ping` |
| `apps/api-gateway/src/modules/biometric/biometric.service.ts` | Proxy gRPC calls tới biometric-service |

### 1.5 Config updates

| File | Thay đổi |
|------|----------|
| `nest-cli.json` | Thêm `identity-service` và `biometric-service` vào `projects` |
| `apps/api-gateway/src/app.module.ts` | Import `IdentityModule` và `BiometricModule` |
| `.env` | Thêm `IDENTITY_GRPC_URL`, `BIOMETRIC_GRPC_URL` |
| `.env.example` | Thêm `IDENTITY_GRPC_URL`, `BIOMETRIC_GRPC_URL` |

---

## 2. CI/CD

Không cần thay đổi CI/CD (`ci-cd.yml`) vì nó tự động:
- `discover-apps`: đọc `nest-cli.json` projects với type=application
- `build-and-push`: build Docker image với `APP_NAME=${{ matrix.app }}`
- `update-manifests`: update image tag trong `k8s/<app>/deployment.yaml`

Sau khi thêm vào `nest-cli.json`, CI sẽ tự build và deploy identity-service, biometric-service.

---

## 3. Manifests (`C:\BTFPT\WDP\bioring-be-manifests`)

### 3.1 identity-service manifests

| File | Mô tả |
|------|-------|
| `k8s/identity-service/configmap.yaml` | env: `IDENTITY_GRPC_URL=0.0.0.0:50052` |
| `k8s/identity-service/deployment.yaml` | image, port 50052, initContainer prisma migrate, probes |
| `k8s/identity-service/service.yaml` | ClusterIP port 50052 |

### 3.2 biometric-service manifests

| File | Mô tả |
|------|-------|
| `k8s/biometric-service/configmap.yaml` | env: `BIOMETRIC_GRPC_URL=0.0.0.0:50053` |
| `k8s/biometric-service/deployment.yaml` | image, port 50053, initContainer prisma migrate, probes |
| `k8s/biometric-service/service.yaml` | ClusterIP port 50053 |

### 3.3 Update api-gateway deployment

Thêm env vars:
- `IDENTITY_GRPC_URL: identity-service:50052`
- `BIOMETRIC_GRPC_URL: biometric-service:50053`

---

## 4. Quy trình chạy local

```bash
# Chạy toàn bộ services (cần thêm vào concurrently)
npm run dev

# Hoặc chạy riêng từng service:
nest start identity-service --watch    # Cần thêm script
nest start biometric-service --watch   # Cần thêm script
```

---

## 5. Kiểm tra

- `npm run lint` — ESLint
- `npm test` — Jest unit tests
- `npm run build` — Build toàn bộ
- Deployment tự động qua GitHub Actions khi push main
