# Lay mat khau ArgoCD admin

Tren VPS, chay:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

## Mo ArgoCD UI

Tren VPS, mo port-forward:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Tren local (may tinh cua ban), mo SSH tunnel:

```powershell
ssh -i "$env:USERPROFILE\.ssh\bioring_do_ed25519" -L 8080:localhost:8080 deploy@165.232.166.111
```

Mo trinh duyet: `https://localhost:8080`

- Username: `admin`
- Password: ket qua lenh tren
