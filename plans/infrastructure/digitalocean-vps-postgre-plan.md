# Database Setup — Shared Dev PostgreSQL trên VPS

Chạy PostgreSQL bằng Docker trên VPS, dùng chung cho cả team dev local.

## 1. Tạo VPS (DigitalOcean Droplet)

```bash
# Thông số tối thiểu
# - OS: Ubuntu 24.04 LTS
# - Plan: Basic, $6/tháng (1 vCPU, 1GB RAM, 25GB SSD)
# - Datacenter: Chọn gần team nhất (VD: Singapore)
# - Authentication: SSH key (tạo key pair nếu chưa có)
# - Cloud Firewall: mở 22 (SSH) từ IP team
```

Sau khi tạo, kiểm tra kết nối:

```bash
ssh root@<VPS_IP>
```

## 2. Cài đặt Docker

```bash
# Update hệ thống
apt update && apt upgrade -y

# Cài các gói cơ bản
apt install -y curl git unzip htop ca-certificates

# Cài Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Cho phép user hiện tại chạy docker không cần sudo
usermod -aG docker $USER

# Logout rồi login lại để áp dụng
exit
ssh root@<VPS_IP>
```

Xác nhận Docker hoạt động:

```bash
docker --version
docker run hello-world
```

## 3. Cấu hình firewall

Dùng ufw (có sẵn trên Ubuntu):

```bash
# Cho phép SSH từ IP team
ufw allow from <IP-của-bạn> to any port 22 proto tcp
ufw allow from <IP-đồng-nghiệp> to any port 22 proto tcp

# Bật firewall
ufw enable

# Kiểm tra trạng thái
ufw status verbose
```

Sau bước này, VPS đã có Docker + firewall SSH cơ bản.

## 4. Tạo container PostgreSQL

```bash
# Pull image
docker pull postgres:16-alpine

# Tạo volume cho data persistent
docker volume create bioring-pgdata

# Chạy container
docker run -d \
  --name bioring-db \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<your-password> \
  -e POSTGRES_DB=bioring \
  -v bioring-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

## 5. Mở port 5432 cho team (có giới hạn IP)

```bash
# Chỉ cho phép IP cụ thể — không để 0.0.0.0/0
ufw allow from <IP-dev-1> to any port 5432 proto tcp
ufw allow from <IP-dev-2> to any port 5432 proto tcp
```

> **Không mở 5432 ra internet** — database không có TLS, password gửi plaintext. Nếu team dùng VPN, chỉ allow subnet VPN.

## 6. Kết nối từ local

Mỗi dev đặt trong `.env`:

```env
DATABASE_URL=postgresql://postgres:<password>@<VPS_IP>:5432/bioring?schema=public
```

## 7. Backup nhanh

```bash
docker exec bioring-db pg_dump -U postgres bioring > backup-$(date +%Y%m%d).sql
```

## Khi nào cần production

Sau đó quyết định lại kiến trúc DB:
- Nếu vẫn chạy Docker VPS: copy container này, đổi password, thêm replica
- Nếu muốn vào k3s: viết lại StatefulSet + Service + PVC (phần `k8s/postgres/` đã xoá, viết lại từ đầu)
