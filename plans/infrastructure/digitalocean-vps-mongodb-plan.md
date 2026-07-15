# MongoDB Setup — Shared Dev MongoDB trên VPS

Chạy MongoDB bằng Docker trên VPS (cùng VPS với PostgreSQL/Redis), dùng chung cho các tính năng cần document store.

> **Ghi chú:** Nếu chưa có VPS + Docker, làm theo bước 1-3 trong `digitalocean-vps-postgre-plan.md` trước.

## 1. Tạo container MongoDB

```bash
# Pull image
docker pull mongo:7

# Tạo volume cho persistent data
docker volume create bioring-mongodb-data

# Chạy container
docker run -d \
  --name bioring-mongodb \
  --restart unless-stopped \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=<your-user> \
  -e MONGO_INITDB_ROOT_PASSWORD=<your-password> \
  -e MONGO_INITDB_DATABASE=bioring \
  -v bioring-mongodb-data:/data/db \
  mongo:7
```

> **`<your-user>` / `<your-password>`:** do bạn tự đặt, đây là root user của MongoDB. Nhớ giữ lại để dùng ở các bước sau.
> **Lưu ý:** Nếu chưa cần auth (dev ban đầu), có thể bỏ 2 biến `MONGO_INITDB_ROOT_USERNAME` và `MONGO_INITDB_ROOT_PASSWORD`. Nhưng khuyến nghị luôn bật auth để tránh lộ data.

## 2. Mở port 27017 cho team (có giới hạn IP)

```bash
# Chỉ cho phép IP cụ thể — không để 0.0.0.0/0
ufw allow from <IP-dev-1> to any port 27017 proto tcp
ufw allow from <IP-dev-2> to any port 27017 proto tcp
```

> **`<IP-dev-1>` / `<IP-dev-2>`:** public IP của từng dev trong team (lấy từ `curl ifconfig.me`).

> **Không mở 27017 ra internet.** MongoDB không có TLS mặc định, password gửi plaintext.

## 3. Kết nối từ local

Mỗi dev đặt trong `.env`:

```env
# Không auth
MONGODB_URI=mongodb://<VPS_IP>:27017/bioring

# Có auth
MONGODB_URI=mongodb://<user>:<password>@<VPS_IP>:27017/bioring?authSource=admin
```

> **`<VPS_IP>`:** public IPv4 của DigitalOcean Droplet (xem trong DigitalOcean dashboard).
> **`<user>` / `<password>`:** nếu dùng root → giá trị đã đặt ở bước 1; nếu tạo user riêng → giá trị ở bước 4.

## 4. Tạo user cho app (nếu dùng auth)

Kết nối vào container và tạo user riêng cho app (thay vì dùng root):

```bash
docker exec -it bioring-mongodb mongosh -u <root-user> -p <root-password> \
  --authenticationDatabase admin
```

> **`<root-user>` / `<root-password>`:** giá trị `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` đã đặt ở bước 1.

```js
// Trong mongosh:
use bioring
db.createUser({
  user: "bioring_app",
  pwd: "<app-password>",
  roles: [{ role: "readWrite", db: "bioring" }]
})
exit
```

> **`<app-password>`:** do bạn tự đặt cho user app.

Sau đó `.env` dùng:

```env
MONGODB_URI=mongodb://bioring_app:<app-password>@<VPS_IP>:27017/bioring?authSource=bioring
```

> **`<app-password>`:** password vừa đặt cho user `bioring_app` ở bước 4.
> **`<VPS_IP>`:** public IPv4 của DigitalOcean Droplet.

## 5. Kiểm tra kết nối

```bash
# Từ VPS
docker exec -it bioring-mongodb mongosh -u <user> -p <password> \
  --authenticationDatabase admin \
  --eval "db.runCommand({ ping: 1 })"
# Kết quả: { ok: 1 }

# Liệt kê databases
docker exec -it bioring-mongodb mongosh -u <user> -p <password> \
  --authenticationDatabase admin \
  --eval "show dbs"
```

> **`<user>` / `<password>`:** có thể dùng root (bước 1) hoặc user app (bước 4).

## 6. Backup nhanh

```bash
docker exec bioring-mongodb mongodump \
  -u <user> -p <password> \
  --authenticationDatabase admin \
  --out /tmp/backup-$(date +%Y%m%d)
docker cp bioring-mongodb:/tmp/backup-$(date +%Y%m%d) .
```

> **`<user>` / `<password>`:** root user (bước 1) — cần quyền đọc toàn bộ database.

## 7. Khi nào cần production

- Bật authentication (luôn nên bật)
- Thêm replica set cho high availability
- Bật TLS
- Dùng Kubernetes: chạy MongoDB qua Helm chart bitnami/mongodb hoặc MongoDB Community Operator
