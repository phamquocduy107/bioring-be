# Hướng dẫn thêm/xóa service

## I. Thêm service mới

### Developer làm

```bash
# 1. Tạo app trong monorepo
npx nest generate app my-new-service

# 2. Tạo thư mục manifest trong bioring-be-manifests
cd ../bioring-be-manifests
mkdir -p k8s/my-new-service

# 3. Tạo deployment.yaml (copy từ service tương tự, sửa tên + port)
cp k8s/ecommerce-service/deployment.yaml k8s/my-new-service/
# Sửa: name, labels, image, ports, env, probes...

# 4. Tạo service.yaml (copy từ service tương tự, sửa tên + port)
cp k8s/ecommerce-service/service.yaml k8s/my-new-service/
# Sửa: name, selector, port

# 5. Push cả 2 repo
cd ../bioring-be
git add . && git commit -m "feat: add my-new-service"
git push

cd ../bioring-be-manifests
git add . && git commit -m "chore: add manifests for my-new-service"
git push
```

### GitHub Actions tự làm

- Đọc `nest-cli.json` → phát hiện `my-new-service`
- Build Docker image → `ghcr.io/.../bioring-my-new-service:<sha>`
- Update image tag trong `k8s/my-new-service/deployment.yaml`
- Commit + push vào `bioring-be-manifests`

### ArgoCD tự làm

- Phát hiện thư mục `k8s/my-new-service/` mới
- Tạo Application "my-new-service"
- Sync → tạo Deployment + Service trong namespace `bioring`
- Service chạy trong k3s 🟢

---

## II. Xóa service

### Developer làm

```bash
# 1. Xóa app code trong bioring-be
cd bioring-be
git rm -r apps/my-old-service

# 2. Xóa thư mục manifest trong bioring-be-manifests
cd ../bioring-be-manifests
git rm -r k8s/my-old-service

# 3. Push cả 2 repo
cd ../bioring-be
git add . && git commit -m "feat: remove my-old-service"
git push

cd ../bioring-be-manifests
git add . && git commit -m "chore: remove manifests for my-old-service"
git push
```

### GitHub Actions tự làm

- `discover-apps`: không còn `my-old-service` trong `nest-cli.json`
- Không build image cho service cũ
- `update-manifests`: không có gì để update

### ArgoCD tự làm

- Phát hiện thư mục `k8s/my-old-service/` biến mất
- Xóa Application "my-old-service"
- `prune: true` → xóa toàn bộ K8s resources
- Service biến mất khỏi k3s 🔴

---

## III. Cheat sheet

| Hành động | Ai làm | Lệnh / Ghi chú |
|-----------|--------|----------------|
| Tạo app code | **Dev** | `npx nest generate app <name>` |
| Tạo `deployment.yaml` | **Dev** | Copy từ service hiện có, sửa lại |
| Tạo `service.yaml` | **Dev** | Copy từ service hiện có, sửa lại |
| Push code | **Dev** | Push cả 2 repo |
| Build Docker image | **CI** | Tự động phát hiện app |
| Update image tag | **CI** | `yq` vào `deployment.yaml` |
| Tạo Application | **ArgoCD** | Phát hiện thư mục mới |
| Deploy vào k3s | **ArgoCD** | Sync + tự động |
| Xóa app code | **Dev** | `git rm -r apps/<name>` |
| Xóa thư mục manifests | **Dev** | `git rm -r k8s/<name>` |
| Xóa Application + resources | **ArgoCD** | Tự động prune |

---

## IV. Lưu ý

- **Tên thư mục trong `k8s/` phải trùng với tên app trong `nest-cli.json`** (ArgoCD dùng tên thư mục để tạo Application)
- Nếu service cần giao tiếp với service khác (vd: api-gateway gọi ecommerce-service qua gRPC), nhớ thêm env var tương ứng trong `deployment.yaml`
- Nếu service dùng database, copy luôn init container Prisma migration từ service hiện có
- Port mới không được trùng với port của service khác
