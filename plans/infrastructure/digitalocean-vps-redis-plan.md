# Redis Setup — Shared Dev Redis trên VPS

Chạy Redis bằng Docker trên VPS (cùng VPS với PostgreSQL), dùng chung cho cache và BullMQ queue.

> **Ghi chú:** Nếu chưa có VPS + Docker, làm theo bước 1-3 trong `digitalocean-vps-postgre-plan.md` trước.

## 1. Tạo container Redis

```bash
# Pull image
docker pull redis:7-alpine

# Tạo volume cho data persistent (phòng khi restart mất cache thì không sao,
# nhưng nếu dùng BullMQ thì job queue cần persist)
docker volume create bioring-redis-data

# Chạy container
docker run -d \
  --name bioring-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v bioring-redis-data:/data \
  redis:7-alpine \
  redis-server --requirepass <your-redis-password> --appendonly yes
```

Giải thích flag:
- `--requirepass`: yêu cầu password khi kết nối
- `--appendonly yes`: ghi log để phục hồi data khi restart (quan trọng nếu dùng BullMQ)

## 2. Mở port 6379 cho team (có giới hạn IP)

```bash
# Chỉ cho phép IP cụ thể
ufw allow from <IP-dev-1> to any port 6379 proto tcp
ufw allow from <IP-dev-2> to any port 6379 proto tcp
```

> **Không mở 6379 ra internet.** Nếu có thể, chỉ cho phép cùng subnet VPS (các container khác gọi qua `127.0.0.1` hoặc Docker network).

## 3. Kết nối từ local

Mỗi dev đặt trong `.env`:

```env
REDIS_URL=redis://:<password>@<VPS_IP>:6379
```

Định dạng URL có password: `redis://:<password>@host:port`

## 4. Kiểm tra kết nối

```bash
# Từ VPS
docker exec -it bioring-redis redis-cli -a <password> ping
# Kết quả: PONG

# Đếm key hiện có
docker exec -it bioring-redis redis-cli -a <password> dbsize
```

## 5. Khi nào cần production

- Nếu vẫn chạy Docker VPS: thêm replica, bật TLS, dùng Sentinel hoặc Redis Cluster
- Nếu vào k3s: chạy Redis qua Helm chart bitnami/redis (có hỗ trỳ replica + sentinel sẵn), hoặc dùng Redis StatefulSet đơn giản cho dev
