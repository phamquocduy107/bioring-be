# Note: Git pull manifests repo tren VPS

Repo `bioring-be-manifests` la private, can SSH key de git pull/push.

SSH key `argocd_bioring_manifests` da duoc tao va add lam deploy key cho repo.

Moi lan SSH vao VPS, can chay:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/argocd_bioring_manifests
```

Sau do `git pull` / `git push` binh thuong.

Hoac them vao `~/.ssh/config` de khoi chay ssh-add moi lan:

```
Host github.com
  HostName github.com
  IdentityFile ~/.ssh/argocd_bioring_manifests
```
