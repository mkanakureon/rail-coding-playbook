# Azure Container Apps リリース報告書

- **日時**: 2026-02-18 08:45〜08:56 JST (UTC 23:45〜23:56)
- **実施者**: mukunasi@divakk.co.jp
- **対象環境**: Azure Container Apps (rg-next-aca-min / japaneast)

## 概要

全4サービスの Container Apps が古いイメージで動作しており、最新コードが反映されていなかった問題を解消。
ACR 上のイメージを最新化し、全 Container Apps を新リビジョンに更新した。

## 更新前の状態

| サービス | 旧リビジョン作成日時 | ACR 最新プッシュ日時 | 差分 |
|---------|---------------------|---------------------|------|
| ca-api | 14:20:49 | 17:35:06 | 3時間遅れ |
| ca-editor | 13:23:14 | 17:39:00 | 4時間遅れ |
| ca-nextjs | 15:57:10 | 17:32:09 | 1.5時間遅れ |
| ca-preview | 14:15:16 | 16:04:16 | 2時間遅れ |

### 発生していたエラー

1. **ca-editor (502 Bad Gateway)**: 古いイメージに nginx proxy が含まれており、バックエンドへの SSL handshake が失敗
2. **ca-nextjs (ECONNREFUSED)**: 古いイメージに Next.js rewrites が残っており、`localhost:8080` へのプロキシが失敗

## 実施内容

### Step 1: プラットフォーム問題の発見と解決

ACR の最新イメージのプラットフォームを調査した結果、以下が判明:

| イメージ | プラットフォーム | 原因 |
|---------|---------------|------|
| hono-api:latest | **linux/arm64** | Apple Silicon Mac でビルド |
| ca-nextjs:latest | **linux/arm64** | Apple Silicon Mac でビルド |
| editor:latest | linux/amd64 | 正常 |
| preview-app:latest | linux/amd64 | 正常 |

Azure Container Apps は `linux/amd64` のみサポートのため、arm64 イメージではデプロイ失敗。

### Step 2: ACR 上でのリビルド (linux/amd64)

`az acr build` を使用し、ACR 上で `linux/amd64` イメージを再ビルド:

```bash
az acr build --registry acrnextacamin --image hono-api:latest \
  --platform linux/amd64 apps/hono
# Run ID: ce13 - 1m49s で成功

az acr build --registry acrnextacamin --image ca-nextjs:latest \
  --platform linux/amd64 apps/next
# Run ID: ce12 - 2m40s で成功
```

### Step 3: Container Apps 更新

全4サービスを `az containerapp update` で更新。
`:latest` タグが同一のため新リビジョンが作成されないケースに対処し、`DEPLOY_VERSION` 環境変数を追加して新リビジョン作成を強制。

```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
az containerapp update --name <name> --resource-group rg-next-aca-min \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"
```

## 更新後の状態

| サービス | 新リビジョン | 作成日時 (UTC) | HealthState | ProvisioningState |
|---------|------------|---------------|-------------|-------------------|
| ca-api | `ca-api--0000009` | 23:53:58 | Healthy | Provisioned |
| ca-editor | `ca-editor--0000005` | 23:54:24 | Healthy | Provisioned |
| ca-nextjs | `ca-nextjs--0000006` | 23:54:43 | Healthy | Provisioned |
| ca-preview | `ca-preview--0000006` | 23:55:01 | Healthy | Provisioned |

## 動作確認結果

### エンドポイント確認

| サービス | URL | HTTP Status |
|---------|-----|-------------|
| API | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health | `{"status":"ok"}` |
| Next.js | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/ | 200 |
| Editor | https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io/ | 200 |
| Preview | https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io/ | 200 |

### CORS 確認

| Origin | access-control-allow-origin | 結果 |
|--------|---------------------------|------|
| ca-editor | `https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io` | OK |
| ca-nextjs | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` | OK |

### ログ確認

- **ca-api**: 正常起動、エラーなし
- **ca-editor**: nginx worker 正常起動、502 エラー解消
- **ca-nextjs**: `Ready in 135ms` で正常起動、ECONNREFUSED 解消
- **ca-preview**: 正常起動

## 再現手順

### イメージの再ビルド＆プッシュ (ACR 上でビルド)

```bash
# ACR 上でビルドすれば自動的に linux/amd64 になる
az acr build --registry acrnextacamin --image hono-api:latest \
  --platform linux/amd64 apps/hono

az acr build --registry acrnextacamin --image ca-nextjs:latest \
  --platform linux/amd64 apps/next

az acr build --registry acrnextacamin --image editor:latest \
  --platform linux/amd64 apps/editor

az acr build --registry acrnextacamin --image preview-app:latest \
  --platform linux/amd64 packages/web
```

### Container Apps の更新

```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)

az containerapp update --name ca-api --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/hono-api:latest \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"

az containerapp update --name ca-editor --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/editor:latest \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"

az containerapp update --name ca-nextjs --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/ca-nextjs:latest \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"

az containerapp update --name ca-preview --resource-group rg-next-aca-min \
  --image acrnextacamin.azurecr.io/preview-app:latest \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"
```

### 確認コマンド

```bash
# リビジョン状態確認
az containerapp revision list --name ca-api --resource-group rg-next-aca-min -o table

# エンドポイント確認
curl -s https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health

# CORS 確認
curl -s -D - -o /dev/null \
  https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/auth/me \
  -H "Origin: https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io"

# ログ確認
az containerapp logs show --name ca-api --resource-group rg-next-aca-min --tail 10
```

## 教訓・注意事項

### 1. Apple Silicon Mac でのビルドに注意

Apple Silicon (M1/M2/M3/M4) Mac では Docker イメージがデフォルトで `linux/arm64` になる。
Azure Container Apps は `linux/amd64` のみサポートのため、以下のいずれかで対処:

- **推奨**: `az acr build` で ACR 上でビルド（自動的に amd64）
- **代替**: `docker build --platform linux/amd64` を明示指定

### 2. `:latest` タグでも新リビジョンが作成されない場合がある

Container Apps は同一イメージタグの場合、新リビジョンを作成しないことがある。
`DEPLOY_VERSION` 環境変数にタイムスタンプを設定して新リビジョン作成を強制する。

### 3. ACR イメージのプラットフォーム確認方法

```bash
az acr manifest show --registry acrnextacamin --name <image>:latest -o json \
  | jq '.manifests[] | select(.platform.architecture != "unknown") | .platform'
```
