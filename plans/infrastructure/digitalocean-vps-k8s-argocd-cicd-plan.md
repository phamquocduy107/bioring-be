# Ke hoach CI/CD: DigitalOcean Droplet + K8s + ArgoCD + GitHub Actions

Tai lieu nay huong dan tung buoc de trien khai `bioring-be` len mot VPS DigitalOcean Droplet bang Kubernetes nhe, ArgoCD va GitHub Actions.

Muc tieu cuoi cung:

1. Source code nam trong repo `bioring-be`.
2. Kubernetes manifests nam trong repo `bioring-be-manifests`.
3. GitHub Actions build Docker image khi push code.
4. GitHub Actions push image len container registry.
5. GitHub Actions cap nhat image tag trong repo manifests.
6. ArgoCD tren VPS tu dong sync thay doi tu repo manifests vao Kubernetes.

## 0. Tong quan kien truc

```txt
Developer
   |
   | git push
   v
GitHub repo: bioring-be
   |
   | GitHub Actions
   | - npm ci
   | - lint/test/build
   | - docker build
   | - docker push
   | - update manifest repo
   v
GitHub Container Registry / Docker registry

GitHub private repo: bioring-be-manifests
   |
   | ArgoCD watches this repo
   v
DigitalOcean Droplet
   |
   | k3s Kubernetes cluster
   v
Pods / Services / Ingress
```

Khuyen nghi cho DigitalOcean:

- Dung `k3s` thay vi `kubeadm`, vi Droplet nho se nhe va de setup hon.
- Dung GHCR, tuc GitHub Container Registry, vi CI/CD dang nam tren GitHub nen push image rat gon.
- Dung mot VPS Linux Ubuntu 22.04 LTS hoac 24.04 LTS.
- Chon Droplet toi thieu 2 vCPU / 4 GB RAM neu co the. 1 vCPU / 2 GB RAM van hoc duoc nhung ArgoCD + app + database se kha chat.
- Neu chua co domain, co the test bang public IP truoc. Domain va HTTPS lam sau.

## 1. Chuan bi tai khoan va repo

Can co:

- DigitalOcean account.
- GitHub account.
- Repo source code: `bioring-be`.
- Repo GitOps manifests private: `bioring-be-manifests`.
- Quyen admin tren ca 2 repo.

Kiem tra repo hien tai:

```txt
bioring-be/
├── apps/
│   ├── api-gateway/
│   └── sample-microservice/
├── libs/
├── nest-cli.json
├── package.json
└── package-lock.json

bioring-be-manifests/
└── k8s/
```

Cau truc hien tai cua `bioring-be-manifests`:

```txt
bioring-be-manifests/
├── apps/                          # ArgoCD Application definitions
│   ├── api-gateway-app.yaml
│   └── sample-microservice-app.yaml
└── k8s/
    ├── namespace.yaml
    ├── external-db-secret.yaml     # DATABASE_URL trỏ đến PostgreSQL Docker trên VPS
    ├── jwt-secret.yaml
    ├── api-gateway/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   └── ingress.yaml
    └── sample-microservice/
        ├── deployment.yaml
        ├── service.yaml
        └── configmap.yaml
```

## 2. Tao VPS tren DigitalOcean

### 2.1. Tao SSH key tren may local

Neu may ban chua co SSH key, tao key moi:

```powershell
ssh-keygen -t ed25519 -C "bioring-digitalocean" -f "$env:USERPROFILE\.ssh\bioring_do_ed25519"
```

Xem public key de copy len DigitalOcean:

```powershell
Get-Content "$env:USERPROFILE\.ssh\bioring_do_ed25519.pub"
```

Neu ban da co SSH key san, co the dung key cu trong:

```powershell
C:\Users\<your-user>\.ssh\id_ed25519.pub
```

### 2.2. Them SSH key vao DigitalOcean

Vao DigitalOcean dashboard:

1. Mo `cloud.digitalocean.com`.
2. Vao `Settings` -> `Security`.
3. Chon `Add SSH Key`.
4. Paste public key vua copy.
5. Dat ten, vi du `bioring-laptop`.
6. Luu lai.

### 2.3. Tao Droplet

Vao DigitalOcean dashboard:

1. Chon `Create` -> `Droplets`.
2. Region: chon gan nguoi dung hoac gan ban, vi du `Singapore`, neu co.
3. Image: `Ubuntu 22.04 LTS` hoac `Ubuntu 24.04 LTS`.
4. Size:
   - Khuyen nghi: Basic Droplet 2 vCPU / 4 GB RAM.
   - Toi thieu de hoc: 1 vCPU / 2 GB RAM, nhung co the can tat bot app hoac tang swap.
5. Authentication: chon SSH key da them.
6. Hostname: `bioring-k8s-dev`.
7. Bam `Create Droplet`.

Sau khi tao xong, ghi lai public IPv4 cua Droplet.

### 2.4. SSH vao Droplet

Neu dung key moi tao:

```powershell
ssh -i "$env:USERPROFILE\.ssh\bioring_do_ed25519" root@<DROPLET_PUBLIC_IP>
```

Neu dung key mac dinh:

```powershell
ssh root@<DROPLET_PUBLIC_IP>
```

DigitalOcean mac dinh cho SSH bang user `root`. Sau khi vao server, nen tao user deploy rieng.

### 2.5. Tao user deploy tren Droplet

Tren Droplet:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Thoat ra va SSH lai bang user `deploy`:

```powershell
ssh -i "$env:USERPROFILE\.ssh\bioring_do_ed25519" deploy@<DROPLET_PUBLIC_IP>
```

Sau khi test user `deploy` vao duoc, cac buoc sau nen dung user `deploy`.

## 3. Cau hinh network cho VPS

### 3.1. Tao DigitalOcean Cloud Firewall

Vao DigitalOcean dashboard:

1. Vao `Networking` -> `Firewalls`.
2. Chon `Create Firewall`.
3. Dat ten: `fw-bioring-k8s-dev`.
4. Inbound rules:

| Port | Protocol | Source | Muc dich |
| --- | --- | --- | --- |
| 22 | TCP | IP cua ban neu co the | SSH vao Droplet |
| 80 | TCP | All IPv4 / All IPv6 | HTTP ingress |
| 443 | TCP | All IPv4 / All IPv6 | HTTPS ingress |
| 30080 | TCP | IP cua ban | Tam thoi test NodePort neu can |
| 30443 | TCP | IP cua ban | Tam thoi test NodePort neu can |

5. Outbound rules: de mac dinh allow all.
6. Apply firewall vao Droplet `bioring-k8s-dev`.

Ghi chu:

- Khong mo port Kubernetes API `6443` ra public neu khong can.
- Khong expose ArgoCD public luc dau. Dung `kubectl port-forward` qua SSH la du.
- Neu source IP cua ban thay doi thuong xuyen, co the tam thoi mo SSH cho `All IPv4`, nhung nen doi lai khi co the.

### 3.2. Reserved IP tuy chon

Nen tao Reserved IP neu ban muon IP khong doi khi rebuild Droplet:

1. Vao `Networking` -> `Reserved IPs`.
2. Chon region trung voi Droplet.
3. Assign vao Droplet `bioring-k8s-dev`.
4. Dung Reserved IP nay cho DNS A record.

Neu chi hoc/test, public IP cua Droplet la du.

### 3.3. DNS tuy chon

Neu ban co domain:

1. Tao A record:

```txt
api.<your-domain> -> <DROPLET_OR_RESERVED_IP>
```

2. Sau nay Ingress se dung host:

```txt
api.<your-domain>
```

Neu chua co domain, bo qua DNS va test bang NodePort hoac curl truc tiep IP.

## 4. Setup VPS co ban

SSH vao VPS:

```powershell
ssh -i "$env:USERPROFILE\.ssh\bioring_do_ed25519" deploy@<DROPLET_PUBLIC_IP>
```

Cap nhat he thong:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git unzip htop ca-certificates
```

Neu Droplet chi co 1 GB hoac 2 GB RAM, nen tao swap 2 GB:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Cau hinh firewall tren VPS bang UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Neu sau khi bat UFW bi mat ket noi, kiem tra lai DigitalOcean Cloud Firewall va rule SSH.

### 4.1. Khoa SSH root tuy chon

Sau khi user `deploy` SSH duoc va co sudo, co the khoa root login:

```bash
sudo nano /etc/ssh/sshd_config
```

Dat:

```bash
PermitRootLogin no
PasswordAuthentication no
```

Restart SSH:

```bash
sudo systemctl restart ssh
```

Khong dong terminal hien tai truoc khi mo terminal moi va test SSH lai thanh cong.

## 5. Cai k3s Kubernetes

Neu dung UFW, k3s co the can cho phep traffic noi bo cua cluster. Voi single-node Droplet, cau hinh duoi day thuong on:

```bash
sudo ufw allow 6443/tcp comment 'k3s api local/admin only if needed'
sudo ufw allow 10250/tcp comment 'kubelet'
```

Neu khong muon expose 6443 ra public, dam bao DigitalOcean Cloud Firewall khong mo port 6443 cho internet.

Cai k3s:

```bash
curl -sfL https://get.k3s.io | sh -
```

Kiem tra cluster:

```bash
sudo kubectl get nodes
sudo kubectl get pods -A
```

Cho phep user hien tai dung `kubectl` khong can `sudo`:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
chmod 600 ~/.kube/config
kubectl get nodes
```

K3s mac dinh co san:

- Container runtime: containerd.
- CNI network.
- Traefik ingress controller.

Voi giai doan dau, co the dung Traefik mac dinh cua k3s de tiet kiem cong cai dat.

## 6. Cai ArgoCD tren k3s

Tao namespace:

```bash
kubectl create namespace argocd
```

Cai ArgoCD:

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Cho pods chay xong:

```bash
kubectl get pods -n argocd -w
```

Lay password admin ban dau:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

Mo ArgoCD UI qua port-forward:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Neu lenh tren chay tren Droplet qua SSH, tao SSH tunnel tu may local:

```powershell
ssh -i "$env:USERPROFILE\.ssh\bioring_do_ed25519" -L 8080:localhost:8080 deploy@<DROPLET_PUBLIC_IP>
```

Sau do tren Droplet, trong session SSH do, chay:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Tren may local, mo:

```txt
https://localhost:8080
```

Dang nhap:

- Username: `admin`
- Password: password vua lay

Sau khi dang nhap, doi password admin trong UI.

## 6.1. Ket noi ArgoCD voi private manifest repo

Vi `bioring-be-manifests` la private repo, ArgoCD can credential de doc repo.

Khuyen nghi dung SSH deploy key:

1. Tao SSH key rieng tren may local:

```powershell
ssh-keygen -t ed25519 -C "argocd-bioring-manifests" -f "$env:USERPROFILE\.ssh\argocd_bioring_manifests"
```

2. Copy public key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\argocd_bioring_manifests.pub"
```

3. Vao GitHub repo `bioring-be-manifests`:

```txt
Settings -> Deploy keys -> Add deploy key
```

4. Paste public key.
5. Dat ten `argocd-read-bioring-manifests`.
6. Khong tick `Allow write access`.
7. Luu deploy key.

8. Add private key vao ArgoCD qua UI:

```txt
ArgoCD UI -> Settings -> Repositories -> Connect Repo
```

Chon:

- Connection method: `SSH`
- Repository URL: `git@github.com:<owner>/bioring-be-manifests.git`
- SSH private key data: noi dung file `argocd_bioring_manifests`

Hoac dung ArgoCD CLI neu da cai:

```bash
argocd repo add git@github.com:<owner>/bioring-be-manifests.git \
  --ssh-private-key-path ~/.ssh/argocd_bioring_manifests
```

Trong `Application`, dung SSH repo URL:

```yaml
source:
  repoURL: git@github.com:<owner>/bioring-be-manifests.git
  targetRevision: main
  path: k8s/api-gateway
```

## 7. Chuan bi Dockerfile trong `bioring-be`

Can tao mot Dockerfile o root repo `bioring-be`, build theo app name.

Vi du muc tieu:

```bash
docker build --build-arg APP_NAME=api-gateway -t ghcr.io/<owner>/bioring-api-gateway:<tag> .
docker build --build-arg APP_NAME=sample-microservice -t ghcr.io/<owner>/bioring-sample-microservice:<tag> .
```

Dockerfile nen lam cac viec:

1. Dung Node LTS image.
2. Copy `package.json` va `package-lock.json`.
3. Chay `npm ci`.
4. Copy source code.
5. Chay `npm run prisma:generate` neu app can Prisma client.
6. Chay `npx nest build $APP_NAME`.
7. Runtime chi copy `dist`, `node_modules` can thiet, va Prisma generated files neu co.
8. Start bang:

```bash
node dist/apps/$APP_NAME/main
```

Can test local truoc khi dua vao CI:

```bash
npm ci
npm run build:gateway
npm run build:service
```

## 8. Chuan bi Kubernetes manifests

Trong repo `bioring-be-manifests`, tao manifests cho tung service.

### 8.1. Namespace

Tao file:

```txt
k8s/namespace.yaml
```

Noi dung:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: bioring
```

### 8.2. PostgreSQL tren Docker VPS (khong trong k3s)

PostgreSQL chay bang Docker tren VPS, khong nam trong k3s cluster. Tat ca dev ket noi den cung mot DB qua IP VPS.

Da chuan bi file:

```txt
k8s/external-db-secret.yaml   # DATABASE_URL tro den PostgreSQL Docker tren VPS
```

Noi dung:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: external-db-secret
  namespace: bioring
type: Opaque
stringData:
  DATABASE_URL: postgresql://postgres:<password>@<VPS_IP>:5432/bioring?schema=public
```

Y nghia:

- Secret nay duoc ca 2 deployment (`api-gateway` va `sample-microservice`) reference de lay `DATABASE_URL`.
- Khi co IP VPS va password that, sua `external-db-secret.yaml` roi commit.

Huong dan tao container PostgreSQL tren VPS (xem them `digitalocean-vps-postgre-plan.md`):

```bash
docker run -d \
  --name bioring-db \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<password> \
  -e POSTGRES_DB=bioring \
  -v bioring-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

Apply thu cong de test truoc ArgoCD:

```bash
kubectl apply -f k8s/external-db-secret.yaml
kubectl apply -f k8s/jwt-secret.yaml
```

### 8.3. Deployment cho api-gateway

Tao file:

```txt
k8s/api-gateway/deployment.yaml
```

Can co cac muc:

- `metadata.namespace: bioring`
- `replicas: 1`
- `image: ghcr.io/<owner>/bioring-api-gateway:<tag>`
- `containerPort`: port app dang listen, vi du `3000`
- `envFrom` neu dung ConfigMap/Secret
- `readinessProbe` va `livenessProbe` neu app co health endpoint

### 8.4. Service cho api-gateway

Tao file:

```txt
k8s/api-gateway/service.yaml
```

Loai service:

- `ClusterIP` neu expose qua Ingress.
- `NodePort` chi dung tam thoi de test nhanh.

### 8.5. Ingress cho api-gateway

Tao file:

```txt
k8s/api-gateway/ingress.yaml
```

Neu chua co domain, co the tam thoi bo qua Ingress va test bang NodePort.

Neu co domain:

- Tao DNS A record tro ve public IP cua VPS.
- Dung host vi du `api.bioring.example.com`.

### 8.6. Deployment va Service cho sample-microservice

Tao:

```txt
k8s/sample-microservice/deployment.yaml
k8s/sample-microservice/service.yaml
k8s/sample-microservice/configmap.yaml
```

Neu service chi duoc goi noi bo, dung `ClusterIP`, khong tao Ingress.

## 9. Private image va imagePullSecrets

Neu GHCR package la private, Kubernetes can secret de pull image.

Tao GitHub Personal Access Token:

1. GitHub -> Settings -> Developer settings -> Personal access tokens.
2. Tao token co quyen doc package:
   - `read:packages`
3. Tren VPS, tao secret:

```bash
kubectl create namespace bioring

kubectl create secret docker-registry ghcr-secret \
  --namespace bioring \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --docker-email=<email>
```

Trong Deployment them:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-secret
```

Neu de GHCR package public thi co the khong can buoc nay.

## 10. Tao ArgoCD Application

Co 2 cach:

- Tao bang UI ArgoCD.
- Tao YAML trong repo manifests.

Khuyen nghi dung YAML de quan ly bang Git.

Tao file:

```txt
apps/api-gateway-app.yaml
```

Noi dung can co:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-gateway
  namespace: argocd
spec:
  project: default
  source:
    repoURL: git@github.com:<owner>/bioring-be-manifests.git
    targetRevision: main
    path: k8s/api-gateway
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

Tao app tu VPS:

```bash
kubectl apply -f apps/api-gateway-app.yaml
```

Lam tuong tu cho `sample-microservice`.

Vi repo manifests private, phai hoan thanh buoc `6.1` truoc khi ArgoCD sync duoc.

## 11. Thiet lap GitHub Actions cho `bioring-be`

Tao file:

```txt
.github/workflows/ci-cd.yml
```

Workflow nen co cac job:

1. Checkout source.
2. Setup Node.
3. `npm ci`.
4. `npm run lint`.
5. `npm test`.
6. Build Docker images.
7. Login GHCR.
8. Push images.
9. Checkout repo `bioring-be-manifests`.
10. Update image tag trong deployment YAML.
11. Commit va push ve manifests repo.

Image tag nen dung:

```txt
${{ github.sha }}
```

Vi du image:

```txt
ghcr.io/<owner>/bioring-api-gateway:${{ github.sha }}
ghcr.io/<owner>/bioring-sample-microservice:${{ github.sha }}
```

## 12. GitHub secrets can tao

Trong repo `bioring-be`, vao:

```txt
Settings -> Secrets and variables -> Actions -> New repository secret
```

Can tao:

| Secret | Muc dich |
| --- | --- |
| `GHCR_USERNAME` | GitHub username hoac org |
| `GHCR_TOKEN` | Token co quyen push package |
| `MANIFESTS_REPO_TOKEN` | Token co quyen push vao repo `bioring-be-manifests` |

Quyen token cho GHCR:

- `write:packages`
- `read:packages`

Quyen token cho manifests repo:

- Fine-grained token nen cap `Contents: Read and write` cho repo `bioring-be-manifests`.

Neu source repo va manifests repo cung owner, co the dung deploy key hoac GitHub App sau nay. Lan dau nen dung fine-grained PAT de de debug.

## 13. Cach GitHub Actions update manifest

Nen dung cong cu YAML nhu `yq` thay vi replace text thu cong.

Vi du logic:

```bash
yq -i '.spec.template.spec.containers[0].image = "ghcr.io/<owner>/bioring-api-gateway:'"$GITHUB_SHA"'"' \
  k8s/api-gateway/deployment.yaml
```

Sau do commit:

```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add k8s/api-gateway/deployment.yaml
git commit -m "chore: deploy api-gateway ${GITHUB_SHA}"
git push
```

ArgoCD se thay repo manifests thay doi va sync ve cluster.

## 14. Thu tu trien khai lan dau

Lam theo dung thu tu nay de de debug:

1. Tao DigitalOcean Droplet.
2. SSH vao VPS thanh cong.
3. Gan DigitalOcean Cloud Firewall va mo port 80/443.
4. Cai k3s.
5. Kiem tra `kubectl get nodes`.
6. Cai ArgoCD.
7. Dang nhap ArgoCD qua port-forward.
8. Add private repo `bioring-be-manifests` vao ArgoCD bang SSH deploy key.
9. Tao Dockerfile cho `bioring-be`.
10. Build image local hoac bang GitHub Actions.
11. Push image len GHCR.
12. Tao container PostgreSQL bang Docker tren VPS (xem `digitalocean-vps-postgre-plan.md`).
13. Create secret `external-db-secret` trong k3s: `kubectl apply -f k8s/external-db-secret.yaml`
14. Tao manifests Kubernetes thu cong cho `api-gateway`.
15. Apply thu cong manifests tren VPS:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/external-db-secret.yaml
kubectl apply -f k8s/jwt-secret.yaml
kubectl apply -f k8s/api-gateway/
kubectl get pods -n bioring
kubectl logs -n bioring deploy/api-gateway
```

16. Khi chay on, moi tao ArgoCD Application.
17. Kiem tra ArgoCD sync duoc.
18. Tao GitHub Actions update manifests.
19. Push code thu va kiem tra app tu dong deploy.

## 15. Kiem tra va debug

Kiem tra pod:

```bash
kubectl get pods -n bioring
kubectl describe pod -n bioring <pod-name>
kubectl logs -n bioring <pod-name>
```

Kiem tra service:

```bash
kubectl get svc -n bioring
kubectl describe svc -n bioring api-gateway
```

Kiem tra ingress:

```bash
kubectl get ingress -n bioring
kubectl describe ingress -n bioring api-gateway
```

Kiem tra ArgoCD:

```bash
kubectl get applications -n argocd
kubectl describe application -n argocd api-gateway
```

Neu image pull loi:

- Kiem tra image co ton tai tren GHCR.
- Kiem tra package public/private.
- Kiem tra `imagePullSecrets`.
- Kiem tra token `read:packages`.

Neu app crash:

- Xem logs container.
- Kiem tra bien moi truong.
- Kiem tra ket noi database, Redis, Mongo, RabbitMQ.
- Kiem tra `PORT` app dang listen co khop `containerPort` va Service khong.

## 16. Bao mat va van hanh toi thieu

Nen lam:

- Gioi han port SSH chi cho IP cua ban trong DigitalOcean Cloud Firewall neu co the.
- Khong commit `.env` vao Git.
- Dung Kubernetes Secret cho password/token.
- Dung ConfigMap cho config khong nhay cam.
- Doi password admin ArgoCD sau khi cai.
- Khong expose ArgoCD public neu chua co HTTPS va auth can than.
- Backup manifests repo la du, vi cluster co the recreate tu Git.

Chua can lam ngay:

- Multi-node Kubernetes.
- Helm chart rieng.
- Service mesh.
- Monitoring day du bang Prometheus/Grafana.
- External secrets manager.

## 17. Moc hoan thanh

Checklist hoan thanh MVP:

- [ ] DigitalOcean Droplet tao xong va SSH duoc.
- [ ] User `deploy` tao xong va SSH duoc.
- [ ] Port 80/443 mo trong DigitalOcean Cloud Firewall.
- [ ] k3s cai xong.
- [ ] `kubectl get nodes` thanh cong.
- [ ] ArgoCD cai xong.
- [ ] Dang nhap ArgoCD duoc qua port-forward.
- [ ] ArgoCD doc duoc private repo `bioring-be-manifests`.
- [ ] PostgreSQL chay bang Docker tren VPS.
- [ ] Secret `external-db-secret` da apply vao k3s.
- [ ] `bioring-be` co Dockerfile build duoc `api-gateway`.
- [ ] GHCR co image `bioring-api-gateway`.
- [ ] `bioring-be-manifests` co manifests cho `api-gateway`.
- [ ] Pod `api-gateway` chay trong namespace `bioring`.
- [ ] Service/Ingress truy cap duoc API.
- [ ] ArgoCD Application sync thanh cong.
- [ ] GitHub Actions build va push image thanh cong.
- [ ] GitHub Actions update image tag trong manifests repo thanh cong.
- [ ] Push code moi tu dong deploy len VPS.

## 18. Huong mo rong sau MVP

Sau khi MVP chay on:

1. Them service that thay cho `sample-microservice`.
2. Them health endpoint cho tung app.
3. Them readiness/liveness probes.
4. Them HTTPS bang cert-manager va Let's Encrypt.
5. Them database managed service hoac database rieng tren VPS.
6. Them migration strategy cho Prisma.
7. Them rollback bang ArgoCD history.
8. Them monitoring/logging.
9. Them environment `dev`, `staging`, `prod` bang folder rieng:

```txt
k8s/
├── dev/
├── staging/
└── prod/
```

Voi mot DigitalOcean Droplet duy nhat, nen uu tien lam `dev` truoc, chay chac roi moi tach moi truong.
