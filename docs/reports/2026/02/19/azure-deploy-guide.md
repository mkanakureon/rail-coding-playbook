# Azure Container Apps デプロイ手順書

## 概要

kaedevn-monorepo の4つのアプリを Azure Container Apps にデプロイする手順。

## 前提条件

- Azure CLI (`az`) インストール済み
- Docker Desktop 起動済み
- ACR (Azure Container Registry) へのアクセス権限あり

## リソース構成

| Container App | ACR イメージ名 | ソースディレクトリ | ビルドコンテキスト | ポート |
|--------------|---------------|-------------------|-------------------|-------|
| ca-api | hono-api | `apps/hono` | アプリディレクトリ | 8080 |
| ca-editor | editor | `apps/editor` | アプリディレクトリ | 5176 |
| ca-nextjs | ca-nextjs | `apps/next` | アプリディレクトリ | 3000 |
| ca-preview | preview-app | `packages/web` | **monorepo ルート** | 3000 |

- **リソースグループ:** `rg-next-aca-min`
- **ACR 名:** `acrnextacamin`
- **リージョン:** Japan East

## デプロイ手順

### 1. ACR ログイン

```bash
az acr login -n acrnextacamin
```

### 2. ユニークタグ生成

```bash
TAG=$(git rev-parse --short HEAD)-$(date +%s)
echo "TAG=$TAG"
```

### 3. Docker イメージビルド

全てのコマンドは monorepo ルートから実行する。

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)

# hono-api（アプリディレクトリからビルド）
cd "$REPO_ROOT/apps/hono"
docker build -t acrnextacamin.azurecr.io/hono-api:$TAG --platform linux/amd64 .

# editor（アプリディレクトリからビルド）
cd "$REPO_ROOT/apps/editor"
docker build -t acrnextacamin.azurecr.io/editor:$TAG --platform linux/amd64 .

# ca-nextjs（アプリディレクトリからビルド）
cd "$REPO_ROOT/apps/next"
docker build -t acrnextacamin.azurecr.io/ca-nextjs:$TAG --platform linux/amd64 .

# preview-app（monorepo ルートから -f で実行。core/compiler/interpreter に依存するため）
cd "$REPO_ROOT"
docker build -t acrnextacamin.azurecr.io/preview-app:$TAG --platform linux/amd64 -f packages/web/Dockerfile .
```

> **preview-app のビルドコンテキストが異なる理由:**
> `packages/web/Dockerfile` は `packages/core`, `packages/compiler`, `packages/interpreter` を COPY するため、
> monorepo ルートをビルドコンテキストにする必要がある。`packages/web` からビルドすると失敗する。

### 4. ACR にプッシュ

```bash
docker push acrnextacamin.azurecr.io/hono-api:$TAG
docker push acrnextacamin.azurecr.io/editor:$TAG
docker push acrnextacamin.azurecr.io/ca-nextjs:$TAG
docker push acrnextacamin.azurecr.io/preview-app:$TAG
```

### 5. Container App 更新

```bash
az containerapp update --name ca-api --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/hono-api:$TAG

az containerapp update --name ca-editor --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/editor:$TAG

az containerapp update --name ca-nextjs --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/ca-nextjs:$TAG

az containerapp update --name ca-preview --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/preview-app:$TAG
```

### 6. デプロイ確認

```bash
az containerapp list --resource-group rg-next-aca-min \
  --query "[].{name:name, image:properties.template.containers[0].image, status:properties.runningStatus}" \
  -o table
```

全アプリの status が `Running` になっていれば成功。

## 一括デプロイスクリプト

以下のコマンドで全アプリを一括デプロイできる。

```bash
#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
TAG=$(git rev-parse --short HEAD)-$(date +%s)
RG="rg-next-aca-min"
ACR="acrnextacamin"
REGISTRY="$ACR.azurecr.io"

echo "=== ACR ログイン ==="
az acr login -n $ACR

echo "=== ビルド (TAG: $TAG) ==="
cd "$REPO_ROOT/apps/hono"    && docker build -t $REGISTRY/hono-api:$TAG    --platform linux/amd64 .
cd "$REPO_ROOT/apps/editor"  && docker build -t $REGISTRY/editor:$TAG      --platform linux/amd64 .
cd "$REPO_ROOT/apps/next"    && docker build -t $REGISTRY/ca-nextjs:$TAG   --platform linux/amd64 .
cd "$REPO_ROOT"              && docker build -t $REGISTRY/preview-app:$TAG --platform linux/amd64 -f packages/web/Dockerfile .

echo "=== プッシュ ==="
docker push $REGISTRY/hono-api:$TAG
docker push $REGISTRY/editor:$TAG
docker push $REGISTRY/ca-nextjs:$TAG
docker push $REGISTRY/preview-app:$TAG

echo "=== Container App 更新 ==="
az containerapp update --name ca-api     --resource-group $RG --image $REGISTRY/hono-api:$TAG
az containerapp update --name ca-editor  --resource-group $RG --image $REGISTRY/editor:$TAG
az containerapp update --name ca-nextjs  --resource-group $RG --image $REGISTRY/ca-nextjs:$TAG
az containerapp update --name ca-preview --resource-group $RG --image $REGISTRY/preview-app:$TAG

echo "=== 確認 ==="
az containerapp list --resource-group $RG \
  --query "[].{name:name, image:properties.template.containers[0].image, status:properties.runningStatus}" \
  -o table

echo "=== デプロイ完了 (TAG: $TAG) ==="
```

## 禁止事項

| やってはいけないこと | 理由 |
|-------------------|------|
| `az acr build` を使う | monorepo 全体をクラウドに送るので遅い |
| `:latest` タグだけで更新 | 同じ digest だと新リビジョンが作られない |
| preview-app を `packages/web` からビルド | 他パッケージ（core, compiler, interpreter）への依存があるため失敗する |

## 本番 URL

| アプリ | URL |
|-------|-----|
| API | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Editor | https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Next.js | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Preview | https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io |

## トラブルシューティング

### Next.js ビルド失敗: `Cannot find module '@vitejs/plugin-react'`

`vitest.config.ts` がビルドコンテキストに含まれている。`apps/next/.dockerignore` にテスト関連ファイルを追加する。

```
vitest.config.ts
**/*.test.tsx
**/*.test.ts
```

### Container App が更新されない

タグが前回と同じ可能性がある。`$(date +%s)` でタイムスタンプを付与し、必ずユニークなタグを使う。

### ログ確認

```bash
az containerapp logs show --name ca-api --resource-group rg-next-aca-min --follow
```
