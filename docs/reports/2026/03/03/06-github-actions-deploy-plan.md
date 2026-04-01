# GitHub Actions デプロイ導入計画書

**作成日**: 2026-03-03
**前提**: Azure リソースを VSP サブスクリプションに再作成済み（`04-azure-subscription-migration.md` 参照）
**方針**: 実装は段階的に。まず手動トリガーで動くものを作り、安定したら自動化を広げる

---

## 全体像

```
現在:  Mac → docker build (QEMU) × 4 → docker push (自宅回線) × 4 → ACR → Container Apps × 4
今後:  git push → GitHub Actions → docker build (native amd64) × 2 → ACR → Container Apps × 2
                                    └── DC間通信（高速）────────┘
       + Static Web Apps × 2（editor, preview）は GitHub 連携で自動デプロイ（Docker 不要）
```

### コンテナを 4 → 2 に削減

editor（Vite SPA + Nginx）と preview（Vite SPA + Nginx）は静的ファイルを配信しているだけであり、
Container Apps + Docker で動かす必然性がない。
**Azure Static Web Apps (Free)** に移行することで、コンテナビルド対象を半減できる。

| アプリ | 変更前 | 変更後 |
|--------|--------|--------|
| ca-api (Hono) | Container Apps | Container Apps（維持） |
| ca-nextjs (Next.js) | Container Apps | Container Apps（維持） |
| ca-editor (Vite SPA) | Container Apps + Nginx コンテナ | **Static Web Apps (Free)** |
| ca-preview (Vite SPA) | Container Apps + Nginx コンテナ | **Static Web Apps (Free)** |

**効果**:
- Docker build: 4 → **2**（ビルド時間半減）
- ACR push: 4 → **2**（転送量半減）
- GitHub Actions 消費: 10〜15 分 → **5〜8 分**
- 管理する Dockerfile: 4 → **2**
- Static Web Apps は GitHub 連携が組み込みで YAML 自動生成、HTTPS 自動

詳細は `07-app-service-vs-container-apps.md` のセクション 8 を参照。

---

## Phase 1: 前提準備（Azure 側）

### 1-1. Service Principal 作成

```bash
# サブスクリプション ID
SUB_ID="e665361e-cf3a-4bf5-8c42-d64223f54e39"
RG="rg-next-aca-min"
ACR="acrnextacamin"

# Service Principal 作成（ACR push + Container Apps 管理）
az ad sp create-for-rbac \
  --name "github-actions-deploy" \
  --role contributor \
  --scopes /subscriptions/$SUB_ID/resourceGroups/$RG \
  --sdk-auth
```

出力される JSON を控えておく（次のステップで GitHub Secrets に登録）。

> **注意**: `--sdk-auth` は deprecated 警告が出るが `azure/login@v2` との互換性のため使用。
> OIDC 連携（Phase 3）で置き換え予定。

### 1-2. ACR への push 権限確認

Service Principal には `contributor` ロールで ACR push 権限が含まれる。
もし最小権限にしたい場合は別途 `AcrPush` ロールを付与:

```bash
SP_ID=$(az ad sp list --display-name "github-actions-deploy" --query "[0].id" -o tsv)
ACR_ID=$(az acr show --name $ACR --query id -o tsv)
az role assignment create --assignee $SP_ID --role AcrPush --scope $ACR_ID
```

---

## Phase 2: GitHub Secrets 登録

### 2-1. 登録する Secrets 一覧

GitHub → Settings → Secrets and variables → Actions に以下を登録:

| Secret 名 | 値 | 用途 |
|-----------|-----|------|
| `AZURE_CREDENTIALS` | Phase 1-1 の JSON 出力全体 | `azure/login@v2` で使用 |
| `ACR_LOGIN_SERVER` | `acrnextacamin.azurecr.io` | Docker push 先 |
| `ACR_USERNAME` | SP の `clientId` | ACR 認証 |
| `ACR_PASSWORD` | SP の `clientSecret` | ACR 認証 |
| `AZURE_RG` | `rg-next-aca-min` | Container Apps 更新 |

### 2-2. ビルド時 ARG（Secret ではなく Variables でも可）

| Variable 名 | 値 |
|-------------|-----|
| `API_URL` | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| `NEXTJS_URL` | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| `EDITOR_URL` | `https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| `PREVIEW_URL` | `https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |

> Container Apps の URL が変わったら Variables を更新するだけでよい。

---

## Phase 3: ルート `.dockerignore` 追加

GitHub Actions と独立して効果がある改善。ローカルビルドも高速化する。

```dockerignore
# .dockerignore (リポジトリルート)
.git
node_modules
packages/native-engine/external
CMakeFiles
PNG
demo-results
projects
docs
tests
test-results
playwright-report
screenshots
*.spec.ts
*.test.ts
.github
.claude
.vscode
```

---

## Phase 4: ワークフロー作成

### 4-1. ファイル配置

```
.github/workflows/
  ci.yml          ← 既存（typecheck + unit tests）
  deploy.yml      ← 新規（本計画で作成）
```

### 4-2. deploy.yml 設計

```yaml
name: Deploy to Azure Container Apps

on:
  workflow_dispatch:
    inputs:
      targets:
        description: 'デプロイ対象（カンマ区切り）'
        required: false
        default: 'api,nextjs'
        type: string

# main push 時の自動デプロイは Phase 6 で有効化
# on:
#   push:
#     branches: [main]
#     paths:
#       - 'apps/**'
#       - 'packages/**'
#       - 'package-lock.json'

env:
  REGISTRY: acrnextacamin.azurecr.io
  RG: rg-next-aca-min

jobs:
  # ---- ビルド＆プッシュ（並列） ----
  build-push:
    name: Build & Push (${{ matrix.target }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - target: api
            image: hono-api
            dockerfile: apps/hono/Dockerfile
            app: ca-api
          - target: nextjs
            image: ca-nextjs
            dockerfile: apps/next/Dockerfile
            context: apps/next
            app: ca-nextjs
          # editor, preview は Static Web Apps に移行済み（Docker ビルド不要）
      fail-fast: false
    # workflow_dispatch で targets 指定時はフィルタ
    if: >-
      github.event_name != 'workflow_dispatch' ||
      contains(github.event.inputs.targets, matrix.target)
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - uses: azure/docker-login@v2
        with:
          login-server: ${{ env.REGISTRY }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - uses: docker/setup-buildx-action@v3

      - name: Build & Push
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context || '.' }}
          file: ${{ matrix.dockerfile }}
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ matrix.image }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ matrix.image }}:latest
          build-args: |
            VITE_API_URL=${{ vars.API_URL }}
            VITE_NEXT_APP_URL=${{ vars.NEXTJS_URL }}
            VITE_PREVIEW_URL=${{ vars.PREVIEW_URL }}
            API_URL=${{ vars.API_URL }}
            NEXT_PUBLIC_API_URL=${{ vars.API_URL }}
            NEXT_PUBLIC_EDITOR_URL=${{ vars.EDITOR_URL }}
            NEXT_PUBLIC_PREVIEW_URL=${{ vars.PREVIEW_URL }}
          cache-from: type=gha,scope=${{ matrix.target }}
          cache-to: type=gha,scope=${{ matrix.target }},mode=max

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name ${{ matrix.app }} \
            --resource-group ${{ env.RG }} \
            --image ${{ env.REGISTRY }}/${{ matrix.image }}:${{ github.sha }}

  # ---- デプロイ後確認 ----
  verify:
    name: Verify Deployment
    runs-on: ubuntu-latest
    needs: build-push
    steps:
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: List Container Apps
        run: |
          az containerapp list \
            --resource-group ${{ env.RG }} \
            --query "[].{name:name, image:properties.template.containers[0].image}" \
            -o table

      - name: Health Check
        run: |
          sleep 30
          for url in \
            "https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health" \
            "https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
          do
            status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
            echo "$url → $status"
            if [ "$status" -lt 200 ] || [ "$status" -ge 400 ]; then
              echo "::warning::$url returned $status"
            fi
          done
```

### 4-3. nextjs の context について

`apps/next/Dockerfile` は `COPY . .` で `apps/next` 内のファイルだけをコピーする設計。
matrix で `context: apps/next` を指定し、他の 3 つはモノレポルート（`.`）を context にする。

---

## Phase 5: テスト実行手順

### 初回テスト

1. `deploy.yml` を main に push
2. GitHub → Actions → "Deploy to Azure Container Apps" → "Run workflow"
3. targets: `api` だけ指定して 1 つだけテスト
4. 成功したら `api,nextjs` で両アプリ

### 確認ポイント

| チェック | 方法 |
|---------|------|
| ビルド成功 | GitHub Actions のログ |
| ACR にイメージ push 済み | `az acr repository list -n acrnextacamin` |
| Container Apps 更新済み | `az containerapp list --resource-group rg-next-aca-min` |
| ヘルスチェック | verify ジョブの出力 |
| 画面表示 | ブラウザで各 URL にアクセス |

---

## Phase 6: 自動デプロイ有効化（安定後）

Phase 5 で 3 回以上手動デプロイが問題なく動いた後に実施。

### 6-1. push トリガー追加

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/core/**'
      - 'packages/compiler/**'
      - 'packages/ksc-compiler/**'
      - 'packages/interpreter/**'
      - 'packages/battle/**'
      - 'packages/web/**'
      - 'packages/ai-gateway/**'
      - 'package-lock.json'
  workflow_dispatch:
    # ... 手動トリガーも残す
```

### 6-2. CI → Deploy の依存関係（オプション）

CI テストが通った後にデプロイする場合:

```yaml
jobs:
  ci:
    uses: ./.github/workflows/ci.yml  # 既存 CI を再利用

  build-push:
    needs: ci
    # ...
```

---

## Phase 7: OIDC 連携（長期シークレット廃止）

Service Principal のクライアントシークレットを廃止し、GitHub OIDC で認証する。

### 7-1. Federated Credential 追加

```bash
APP_ID=$(az ad sp list --display-name "github-actions-deploy" --query "[0].appId" -o tsv)
OBJ_ID=$(az ad app list --display-name "github-actions-deploy" --query "[0].id" -o tsv)

az ad app federated-credential create --id $OBJ_ID --parameters '{
  "name": "github-main-deploy",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:mkanakureon/kaedevn-monorepo:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

### 7-2. ワークフロー変更

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

`AZURE_CREDENTIALS`, `ACR_USERNAME`, `ACR_PASSWORD` は削除可能。

---

## スケジュール

| Phase | 内容 | 所要時間 | 前提 |
|-------|------|---------|------|
| 1 | Service Principal 作成 | 5 分 | Azure リソース作成済み |
| 2 | GitHub Secrets 登録 | 5 分 | Phase 1 完了 |
| 3 | ルート .dockerignore 追加 | 5 分 | なし（独立して実施可） |
| 4 | deploy.yml 作成 | 15 分 | Phase 2 完了 |
| 5 | テスト実行・修正 | 30 分 | Phase 4 完了 |
| 6 | 自動デプロイ有効化 | 10 分 | Phase 5 安定後 |
| 7 | OIDC 連携 | 15 分 | Phase 6 安定後 |

**Phase 1〜5 合計: 約 1 時間**（Phase 6, 7 は後日でよい）

---

## ローカルデプロイとの共存

`scripts/deploy-azure.sh` は**削除しない**。緊急時のフォールバックとして残す。

```
通常:    GitHub Actions（推奨）
緊急:    ./scripts/deploy-azure.sh（ローカルから直接）
```

GitHub Actions が使えない場合（GitHub 障害、Secrets 問題等）にローカルからデプロイできる安全策。

---

## コスト

| 項目 | 費用 |
|------|------|
| GitHub Actions (Private repo) | 無料枠 2,000 分/月 |
| 1 回のデプロイ（Container Apps 2 つ） | 約 5〜8 分 × 2 並列 = 5〜8 分消費 |
| Static Web Apps（editor, preview） | GitHub 連携で自動、Actions 枠消費なし |
| 月 20 回デプロイ | 100〜160 分（無料枠内で余裕） |
| ACR ストレージ | 変更なし |
| 追加 Azure リソース | なし |

---

## まとめ

- **コンテナビルドは 2 つだけ**（api, nextjs）。editor / preview は Static Web Apps (Free) で Docker 不要
- **Phase 1〜5 を 1 セッションで実施可能**（約 1 時間）
- まず `workflow_dispatch`（手動）で始めて安定を確認
- ローカルデプロイは緊急用に残す
- OIDC 連携は後回しでよい（セキュリティ強化）
