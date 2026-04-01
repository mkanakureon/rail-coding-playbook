# Azure サーバー構成

作成日: 2026-03-21

---

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────┐
│                Azure Front Door (CDN)                │
│            fd-kaedevn / ep-kaedevn                   │
│  /assets/* → Blob Storage    /api/* → Container Apps │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼─────────────┐
    │ Blob Storage │          │   Container Apps      │
    │ kaedevnworks │          │  (Japan East)         │
    │              │          │                       │
    │ assets/      │          │ ┌───────────────────┐ │
    │  bg/         │          │ │ ca-api (Hono)     │ │
    │  ch/         │          │ │ Port 8080         │ │
    │  thumbnail/  │          │ └───────────────────┘ │
    │  frame/      │          │ ┌───────────────────┐ │
    │  ovl/        │          │ │ ca-nextjs         │ │
    │  bgm/        │          │ │ Port 3000         │ │
    │              │          │ └───────────────────┘ │
    └──────────────┘          └───────────────────────┘

    ┌─────────────────────────────────────────────────┐
    │          Static Web Apps (SWA)                    │
    │                                                  │
    │ Editor:  agreeable-river-0bfb78000               │
    │ Preview: happy-tree-012282700                     │
    └─────────────────────────────────────────────────┘

    ┌──────────────┐     ┌──────────────────┐
    │  PostgreSQL   │     │ ACR (Container   │
    │  (Azure DB)   │     │ Registry)        │
    │               │     │ acrnextacamin    │
    └──────────────┘     └──────────────────┘
```

---

## リソース一覧

| サービス | リソース名 | 用途 |
|---------|-----------|------|
| **Container Apps** | `ca-api` | Hono API サーバー (Port 8080) |
| | `ca-nextjs` | Next.js フロントエンド (Port 3000) |
| **Static Web Apps** | `agreeable-river-0bfb78000` | エディタ (Vite ビルド) |
| | `happy-tree-012282700` | プレビューエンジン (ksc-demo.html) |
| **Blob Storage** | `kaedevnworks` | アセット・サムネイル・動画保存 |
| **Front Door (CDN)** | `fd-kaedevn` / `ep-kaedevn` | CDN・ルーティング |
| **Container Registry** | `acrnextacamin.azurecr.io` | Docker イメージ |
| **PostgreSQL** | Azure Database for PostgreSQL | DB (pgvector 対応) |
| **Communication Services** | — | メール送信 |
| **リソースグループ** | `rg-next-aca-min` | 全リソース |
| **リージョン** | Japan East | 全リソース |

---

## URL 一覧

| サービス | URL |
|---------|-----|
| API | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Next.js | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Editor | `https://agreeable-river-0bfb78000.4.azurestaticapps.net` |
| Preview | `https://happy-tree-012282700.1.azurestaticapps.net` |
| Blob Storage | `https://kaedevnworks.blob.core.windows.net` |

---

## デプロイ

### 自動デプロイ（推奨）

`main` ブランチへの push で GitHub Actions が自動実行。

| ワークフロー | 対象 | トリガー |
|-------------|------|---------|
| `deploy.yml` | Container Apps (API + Next.js) | push to main + 手動 |
| `deploy-swa.yml` | Static Web Apps (Editor + Preview) | push to main + 手動 |

```bash
# デプロイ = git push（自動）
git push

# 手動トリガー（必要時のみ）
gh workflow run deploy.yml                  # api + nextjs
gh workflow run deploy.yml -f targets=api   # api のみ
gh workflow run deploy-swa.yml              # editor + preview

# デプロイ状況確認
gh run list --workflow=deploy.yml --limit=3
gh run watch                                # 実行中のラン監視
```

### デプロイフロー

```
git push main
  ↓
GitHub Actions
  ↓
┌─────────────────────────────────────────────┐
│ deploy.yml                                   │
│  1. Azure Login (Service Principal)          │
│  2. ACR Login                                │
│  3. Docker build & push (SHA + latest タグ)  │
│  4. az containerapp update                   │
│  5. Health check (CORS, SPA, Asset URL)      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ deploy-swa.yml                               │
│  1. npm install & build                      │
│  2. Azure/static-web-apps-deploy@v1          │
│  3. Health check                             │
└─────────────────────────────────────────────┘
```

### 禁止事項

- `./scripts/deploy-azure.sh` は使わない（ローカルデプロイ禁止）
- 手動で `docker build` / `docker push` / `az containerapp update` を個別実行しない
- `az acr build` は使わない

---

## Docker 構成

| アプリ | Dockerfile | ベースイメージ | ポート |
|--------|-----------|--------------|--------|
| API (Hono) | `apps/hono/Dockerfile` | `node:20-slim` | 8080 |
| Next.js | `apps/next/Dockerfile` | `node:20-alpine` | 3000 |
| Editor | `apps/editor/Dockerfile` | `nginx:alpine` | 3000 |
| Preview | `packages/web/Dockerfile` | `nginx:alpine` | 3000 |

---

## ストレージ

### Blob Storage（kaedevnworks）

| パス | 内容 |
|------|------|
| `assets/bg/` | 背景画像 |
| `assets/ch/` | キャラクター画像 |
| `assets/frame/` | スプライトフレーム |
| `assets/ovl/` | オーバーレイ画像 |
| `assets/bgm/` | BGM |
| `assets/thumbnail/` | サムネイル画像 |

### キャッシュ設定

| コンテンツ | Cache-Control |
|-----------|--------------|
| 画像・音声・フォント | `public, max-age=31536000, immutable` |
| JSON | `public, max-age=60` |
| その他 | `public, max-age=3600` |

### Front Door ルーティング

| パス | 転送先 | キャッシュ |
|------|--------|----------|
| `/assets/*` | Blob Storage | 長期 (31536000s) |
| `/api/*` | Container Apps (API) | クエリベース |

---

## 環境変数

### API (Hono)

| 変数 | 内容 |
|------|------|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage 接続 |
| `STORAGE_MODE` | `azure` or `local` |
| `AZURE_STORAGE_ACCOUNT` | `kaedevnworks` |
| `ASSET_BASE_URL` | `https://kaedevnworks.blob.core.windows.net` |
| `JWT_SECRET` | JWT 署名キー |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | メール送信用 |

### GitHub Actions Secrets

| シークレット | 用途 |
|-------------|------|
| `AZURE_CREDENTIALS` | Azure Service Principal |
| `SWA_EDITOR_TOKEN` | Editor SWA デプロイトークン |
| `SWA_PREVIEW_TOKEN` | Preview SWA デプロイトークン |

---

## CI/CD パイプライン

### CI (`ci.yml`)

Pull Request 時に自動実行:
1. TypeScript 型チェック (editor, next)
2. ESLint (editor, next)
3. ユニットテスト (packages + apps)

### Pre-deploy チェック (`pre-deploy-check.sh`)

1. TypeScript 型チェック
2. ESLint
3. Prisma マイグレーション状態確認
4. DB スキーマ同期テスト

---

## テスト（Azure 環境向け）

```bash
# Azure 環境のヘルスチェック・E2E テスト
npx playwright test --config=tests/configs/playwright.azure.config.ts
```

テスト設定: `tests/configs/playwright.azure.config.ts`
テストファイル: `tests/azure/`
