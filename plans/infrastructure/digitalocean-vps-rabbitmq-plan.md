# RabbitMQ Setup — Shared Dev RabbitMQ trên VPS

Chạy RabbitMQ bằng Docker trên VPS (cùng VPS với PostgreSQL/Redis), dùng chung cho message queue giữa các microservice.

> **Ghi chú:** Nếu chưa có VPS + Docker, làm theo bước 1-3 trong `digitalocean-vps-postgre-plan.md` trước.

## 1. Tạo container RabbitMQ

```bash
# Pull image (có sẵn management UI)
docker pull rabbitmq:4.0-management-alpine

# Tạo volume cho persistent data
docker volume create bioring-rabbitmq-data

# Chạy container
docker run -d \
  --name bioring-rabbitmq \
  --restart unless-stopped \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=<your-user> \
  -e RABBITMQ_DEFAULT_PASS=<your-password> \
  -e RABBITMQ_DEFAULT_VHOST=/ \
  -v bioring-rabbitmq-data:/var/lib/rabbitmq \
  rabbitmq:4.0-management-alpine
```

> **`<your-user>` / `<your-password>`:** do bạn tự đặt, dùng để đăng nhập management UI và kết nối từ app. Nhớ giữ lại để điền vào `.env`.

Giải thích port:
- `5672`: AMQP — kết nối từ app (api-gateway, ecommerce-service)
- `15672`: Management UI — truy cập web để quản lý queue/exchange

## 2. Mở port cho team (có giới hạn IP)

```bash
# Chỉ cho phép IP cụ thể — không để 0.0.0.0/0
ufw allow from <IP-dev-1> to any port 5672 proto tcp
ufw allow from <IP-dev-2> to any port 5672 proto tcp

# Nếu cần management UI (khuyến nghị chỉ allow IP của bạn)
ufw allow from <IP-của-bạn> to any port 15672 proto tcp
```

> **`<IP-dev-1>` / `<IP-dev-2>`:** public IP của từng dev trong team (có thể lấy từ `curl ifconfig.me`).
> **`<IP-của-bạn>`:** public IP của máy bạn, dùng `curl ifconfig.me` để biết.

> **Không mở 5672/15672 ra internet.** Management UI nên tunnel qua SSH nếu có thể.

## 3. Kết nối từ local

Mỗi dev đặt trong `.env`:

```env
RABBITMQ_USER=<your-user>
RABBITMQ_PASS=<your-password>
RABBITMQ_HOST=<VPS_IP>
RABBITMQ_PORT=5672
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=myapp
```

> **`<your-user>` / `<your-password>`:** giá trị đã đặt ở bước 1.
> **`<VPS_IP>`:** public IPv4 của DigitalOcean Droplet (xem trong DigitalOcean dashboard).

URI tự động build từ các biến trên: `amqp://user:pass@host:port/vhost`

## 4. Management UI

Truy cập `http://<VPS_IP>:15672` với user/password đã đặt.

> **`<VPS_IP>`:** public IPv4 của DigitalOcean Droplet.

Từ local có thể tunnel qua SSH để không expose port:

```bash
ssh -L 15672:localhost:15672 root@<VPS_IP>
# Sau đó mở http://localhost:15672
```

## 5. Kiểm tra kết nối

```bash
# Từ VPS — dùng rabbitmqctl
docker exec bioring-rabbitmq rabbitmqctl status

# Kiểm tra users
docker exec bioring-rabbitmq rabbitmqctl list_users

# Kiểm tra queues
docker exec bioring-rabbitmq rabbitmqctl list_queues
```

## 6. Tạo exchange (nếu cần thủ công)

Mặc định app sẽ tự tạo exchange khi khởi động. Nếu cần tạo tay:

```bash
docker exec bioring-rabbitmq rabbitmqadmin declare exchange \
  name=myapp type=topic durable=true
```

## 7. Khi nào cần production

- Thêm replica bằng RabbitMQ cluster
- Bật TLS cho AMQP (port 5671)
- Dùng Kubernetes: chạy RabbitMQ qua Helm chart bitnami/rabbitmq
