# Plan: Tự động hóa service lifecycle (thêm/xóa service)

## Vấn đề

Hiện tại, thêm hoặc xóa một service (microservice) trong NestJS monorepo `bioring-be` cần nhiều bước thủ công:

1. Thêm/xóa app code trong monorepo
2. Thêm/xóa image tag trong CI/CD matrix (`.github/workflows/ci-cd.yml`)
3. Thêm/xóa thư mục manifest trong `bioring-be-manifests/k8s/<service>/`
4. Thêm/xóa element trong ApplicationSet (`apps/bioring-services-appset.yaml`)

Mục tiêu: Chỉ cần tạo app mới bằng `npx nest generate app` (hoặc xóa app), push lên `main`,
**mọi thứ còn lại tự động** đến lúc service chạy (hoặc biến mất) trong k3s.

---

## Phạm vi tự động

| Bước | Khi thêm service | Khi xóa service |
|------|-----------------|-----------------|
| Tạo/xóa app code | Thủ công (`npx nest generate app`) | Thủ công (git rm) |
| Tạo/xóa K8s manifest files (`deployment.yaml`, `service.yaml`, `configmap.yaml`) | **Thủ công** | **Thủ công** |
| Thêm/xóa CI/CD matrix | **Tự động** (discover-apps) | **Tự động** |
| Build & push Docker image | **Tự động** (CI) | **Tự động** (không còn trong danh sách) |
| Update image tag trong manifests | **Tự động** (CI update tag) | — |
| Thêm/xóa ApplicationSet entry | **Tự động** (git directory generator) | **Tự động** |
| ArgoCD sync | **Tự động** | **Tự động** (prune) |

---

## Thay đổi 1: ApplicationSet dùng `git` directory generator

**File:** `bioring-be-manifests/apps/bioring-services-appset.yaml`

Thay `list` generator bằng `git` directory generator để ArgoCD tự động quét các thư mục con trong `k8s/`:

```yaml
spec:
  generators:
    - git:
        repoURL: git@github.com:phamquocduy107/bioring-be-manifests.git
        revision: main
        directories:
          - path: k8s/*
  template:
    metadata:
      name: '{{ path.basename }}'
    spec:
      project: default
      source:
        repoURL: git@github.com:phamquocduy107/bioring-be-manifests.git
        targetRevision: main
        path: '{{ path }}'
      destination:
        server: https://kubernetes.default.svc
        namespace: bioring
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
```

**Cơ chế:**
- Khi thư mục `k8s/new-service/` xuất hiện trong manifests repo → ArgoCD thấy thư mục mới → tạo Application → deploy
- Khi thư mục `k8s/old-service/` bị xóa khỏi manifests repo → ArgoCD thấy thư mục biến mất → xóa Application tương ứng → `prune: true` xóa toàn bộ resources trong k3s

---

## Thay đổi 2: CI/CD — job `discover-apps`

**File:** `bioring-be/.github/workflows/ci-cd.yml`

Thêm job `discover-apps` đọc `nest-cli.json`, lọc projects `type: "application"`, xuất ra 2 outputs:

```yaml
jobs:
  discover-apps:
    runs-on: ubuntu-latest
    outputs:
      apps: ${{ steps.set-matrix.outputs.apps }}
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: set-matrix
        run: |
          APPS=$(jq -r '
            [.projects | to_entries[] | select(.value.type == "application") | .key]
            | join(" ")
          ' nest-cli.json)
          echo "apps=$APPS" >> "$GITHUB_OUTPUT"
          echo "matrix={\"app\": $(echo "$APPS" | jq -Rc 'split(" ")')}" >> "$GITHUB_OUTPUT"
```

**⚠️ Lỗi đã gặp (quan trọng):** Cả 2 dòng `echo` đều phải có `>> "$GITHUB_OUTPUT"`. Dòng `apps=$APPS` dùng trong `update-manifests` để loop, nếu thiếu `>> "$GITHUB_OUTPUT"` thì `APPS` trong `update-manifests` là **rỗng** → không update tag service nào, dù `build-and-push` chạy ngon lành.

`matrix` output dùng cho `build-and-push` (strategy matrix), `apps` output dùng cho `update-manifests` (loop).

---

## Thay đổi 3: CI/CD — build-and-push với matrix động

**File:** `bioring-be/.github/workflows/ci-cd.yml`

```yaml
  build-and-push:
    needs: [ci, discover-apps]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix: ${{ fromJson(needs.discover-apps.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.GHCR_REGISTRY }}
          username: ${{ secrets.GHCR_USERNAME }}
          password: ${{ secrets.GHCR_TOKEN }}
      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ env.GHCR_REGISTRY }}/${{ secrets.GHCR_USERNAME }}/bioring-${{ matrix.app }}:${{ github.sha }}
          build-args: APP_NAME=${{ matrix.app }}
```

Matrix tự động gồm tất cả apps hiện có (api-gateway, ecommerce-service, test-service). Nếu thêm app mới, nó tự xuất hiện trong matrix.

---

## Thay đổi 4: CI/CD — update-manifests động

**File:** `bioring-be/.github/workflows/ci-cd.yml`

```yaml
  update-manifests:
    needs: [build-and-push, discover-apps]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: ${{ env.MANIFESTS_REPO }}
          token: ${{ secrets.MANIFESTS_REPO_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Update image tags
        env:
          APPS: ${{ needs.discover-apps.outputs.apps }}
        run: |
          npm install -g yq
          for app in $APPS; do
            if [ -d "k8s/$app" ]; then
              yq -i \
                '.spec.template.spec.containers[0].image = "${{ env.GHCR_REGISTRY }}/${{ secrets.GHCR_USERNAME }}/bioring-'${app}':${{ github.sha }}"' \
                "k8s/${app}/deployment.yaml"
            fi
          done
      - name: Commit and push
        env:
          APPS: ${{ needs.discover-apps.outputs.apps }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          FILES=""
          for app in $APPS; do
            if [ -f "k8s/$app/deployment.yaml" ]; then
              FILES="$FILES k8s/$app/deployment.yaml"
            fi
          done
          if [ -n "$FILES" ]; then
            git add $FILES
            git commit -m "chore: deploy ${{ github.sha }}"
            git push
          else
            echo "No manifests to update"
          fi
```

**Cơ chế:**
- `needs: [build-and-push, discover-apps]` — chỉ update khi build thành công (nếu 1 app build fail, job này skip, các app khác cũng không được update tag — trade-off để đảm bảo image tồn tại trước khi deploy)
- Loop qua `$APPS` từ `discover-apps`
- Chỉ update nếu thư mục `k8s/<app>/` tồn tại (developer chưa tạo manifest → skip)
- Dùng `yq -i` để sửa image tag trong `deployment.yaml`

---

## Xử lý xóa service

**Cơ chế:** Thủ công.

Developer tự xóa thư mục `k8s/<name>/` trong manifests repo. ArgoCD tự động phát hiện thư mục biến mất và prune toàn bộ resources.

```bash
git rm -r k8s/old-service/
git commit -m "chore: remove old-service"
git push
```

Lý do chọn thủ công:
- Tránh xóa nhầm nếu CI có bug hoặc nest-cli.json tạm thời bị lỗi
- Developer cần chủ động kiểm tra service đã thực sự không còn cần thiết

---

## Hướng dẫn thêm service mới (quy trình đã kiểm nghiệm)

### Tạo app (thủ công)

```bash
cd bioring-be
npx nest generate app my-new-service
```

### Quyết định loại service

Dựa trên test-service đã triển khai thực tế:

| Loại | Proto | Main port | Ví dụ |
|------|-------|-----------|-------|
| gRPC service | `proto/<tên>.proto` package `test` | 50052+ | `test-service` |
| HTTP gateway | Express Truyền thống | 3000 | `api-gateway` |

**Lưu ý khi tạo gRPC service:**
- `main.ts`: dùng `NestFactory.createMicroservice` với `Transport.GRPC` (xem `apps/test-service/src/main.ts`)
- `controller.ts`: dùng `@GrpcMethod('ServiceName', 'MethodName')`
- `module.ts`: import `CommonModule` từ `@app/common` + global providers (`FitRpcExceptionFilter`, `CustomValidationPipe`, `LoggingInterceptor`, `TimeoutInterceptor`)
- Proto file: tạo trong `proto/<tên>.proto` với package riêng

### Tạo manifest (thủ công)

Cần 3 file trong `bioring-be-manifests/k8s/<tên-service>/`:

1. **`deployment.yaml`** — copy từ service tương tự, sửa:
   - `name`, `labels`, `app` selector
   - Image: `ghcr.io/phamquocduy107/bioring-<tên>:<SHA>` (CI sẽ tự update SHA)
   - `containerPort` (gRPC: 5005x, HTTP: 300x)
   - `envFrom` → `configMapRef` (nếu cần configmap)
   - Probes: gRPC → `tcpSocket`, HTTP → `httpGet`
   - Resources
2. **`service.yaml`** — ClusterIP, port trùng targetPort
3. **`configmap.yaml`** — chứa biến môi trường như `NODE_ENV`, `TEST_SERVICE_GRPC_URL` (dùng `envFrom` trong deployment)

Ví dụ configmap cho gRPC service:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-service-config
  namespace: bioring
data:
  NODE_ENV: production
  TEST_SERVICE_GRPC_URL: 0.0.0.0:50052
```

### Push

```bash
git add . && git commit -m "feat: add my-new-service"
git push
# riêng manifests repo
git add . && git commit -m "chore: add manifests for my-new-service"
git push
```

### CI tự động
1. `discover-apps` → phát hiện app mới
2. `ci` → lint + test (cần pass)
3. `build-and-push` → build image: `ghcr.io/.../bioring-my-new-service:<sha>`
4. `update-manifests` → update tag trong `deployment.yaml` → commit vào manifests repo

### ArgoCD tự động
1. Phát hiện thư mục `k8s/my-new-service/` mới
2. Tạo Application "my-new-service"
3. Sync → deploy vào namespace `bioring`

---

## Các file bị ảnh hưởng (đã implement)

| File | Thay đổi |
|------|----------|
| `bioring-be-manifests/apps/bioring-services-appset.yaml` | `list` → `git directory` generator |
| `bioring-be/.github/workflows/ci-cd.yml` | Thêm `discover-apps` job, dynamic matrix + update-manifests |
| `bioring-be/proto/test.proto` | **Tạo mới** — proto cho test-service gRPC |
| `bioring-be/apps/test-service/` | **Tạo mới** — gRPC microservice (main.ts, controller, service, module) |
| `bioring-be/apps/api-gateway/src/modules/test-service/` | **Tạo mới** — gRPC client module gọi test-service |
| `bioring-be-manifests/k8s/test-service/` | **Tạo mới** — deployment.yaml, service.yaml, configmap.yaml |
| `bioring-be-manifests/k8s/api-gateway/deployment.yaml` | Thêm `TEST_SERVICE_GRPC_URL` env |

---

## Bài học từ quá trình triển khai

### Bug 1: Thiếu `>> "$GITHUB_OUTPUT"` trong discover-apps

```
echo "apps=$APPS"                          ← SAI: chỉ in log, không set output
echo "matrix=..." >> "$GITHUB_OUTPUT"      ← ĐÚNG
```

Hậu quả: `$APPS` trong `update-manifests` rỗng → loop không chạy → không update tag nào.
`build-and-push` vẫn chạy ngon vì nó dùng `matrix` output (đã được set đúng).

### Bug 2: Image tag `:latest` trong deployment.yaml

Khi tạo manifest mới, dùng `:latest` làm placeholder → ArgoCD deploy nhưng image chưa tồn tại trên GHCR.
Fix: dùng SHA thật (có thể lấy từ commit hiện tại). Sau đó CI sẽ update lên SHA mới.

### Bug 3: Lint fail khi generate app mới

`npx nest generate app` tạo code mới có thể vi phạm ESLint config:
- `main.ts`: thiếu `void bootstrap()` → floating promise warning
- `test/app.e2e-spec.ts`: dùng `import * as request from 'supertest'` gây unsafe type errors
- Fix: `void bootstrap()`, và dùng `import request from 'supertest'` + `import { App } from 'supertest/types'`

### Bug 4: Port conflict

Nhiều service cần port riêng. Quy ước hiện tại:
- `api-gateway`: 3000 (HTTP)
- `ecommerce-service`: 50051 (gRPC)
- `test-service`: 50052 (gRPC)
- Service mới: port tiếp theo 50053+

---

## Luồng hoạt động hoàn chỉnh (đã kiểm nghiệm)

### Thêm service mới

```
Developer:
  1. npx nest generate app my-new-service
  2. Tạo proto/<tên>.proto (nếu gRPC)
  3. Sửa main.ts, controller, module theo pattern gRPC
  4. Tạo thủ công k8s/my-new-service/
     - deployment.yaml
     - service.yaml
     - configmap.yaml
  5. Push cả 2 repo lên main

GitHub Actions:
  1. discover-apps: đọc nest-cli.json → phát hiện my-new-service
  2. ci: lint + test → PASS (cần fix lint issues từ code generated)
  3. build-and-push: build image → ghcr.io/.../bioring-my-new-service:<sha>
  4. update-manifests:
     - Thấy thư mục k8s/my-new-service/ tồn tại
     - Update image tag trong deployment.yaml
     - Commit + push vào bioring-be-manifests

ArgoCD:
  - Phát hiện thư mục k8s/my-new-service/
  - Tạo Application "my-new-service"
  - Sync → tạo Deployment, Service, ConfigMap trong namespace bioring
  → Service chạy trong k3s
```

### Xóa service

```
Developer:
  1. Xóa app code: git rm -r apps/my-old-service
  2. Xóa thư mục manifests: git rm -r k8s/my-old-service/
  3. Push cả 2 repo lên main

GitHub Actions:
  1. discover-apps: không còn my-old-service
  2. build-and-push: không build cho my-old-service
  3. update-manifests: không có gì để update

ArgoCD:
  - Phát hiện thư mục k8s/my-old-service/ biến mất
  - Xóa Application "my-old-service"
  - prune: true → xóa toàn bộ resources
  → Service biến mất khỏi k3s
```

---

## Tổng kết: việc gì tự động, việc gì thủ công

### Khi thêm service
| Bước | Làm bởi | Ghi chú |
|------|---------|---------|
| `npx nest generate app` | Developer | Có thể cần fix lint |
| Tạo proto file (nếu gRPC) | Developer | `proto/<tên>.proto` |
| Sửa main.ts / controller / module | Developer | Theo pattern có sẵn |
| Tạo `k8s/<name>/deployment.yaml` | Developer | Copy + sửa |
| Tạo `k8s/<name>/service.yaml` | Developer | Copy + sửa |
| Tạo `k8s/<name>/configmap.yaml` | Developer | Copy + sửa |
| Push code | Developer | Cả 2 repo |
| Phát hiện app mới → build image | **CI** | |
| Update image tag | **CI** | |
| ArgoCD phát hiện thư mục → deploy | **ArgoCD** | |

### Khi xóa service
| Bước | Làm bởi | Ghi chú |
|------|---------|---------|
| Xóa app code | Developer | `git rm -r apps/<name>` |
| Xóa thư mục manifests | Developer | `git rm -r k8s/<name>` |
| Push code | Developer | Cả 2 repo |
| ArgoCD prune | **ArgoCD** | Tự động xóa resources |
