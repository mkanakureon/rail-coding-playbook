# 設定ファイル・CI/CD

## 概要

モノレポのルート設定ファイル、Git hooks、GitHub Actions ワークフロー、Docker 構成、環境変数の一覧と説明。

## ルート設定ファイル

### package.json

- **ワークスペース**: `packages/*`, `apps/*`
- **主要スクリプト**:

| スクリプト | コマンド |
|-----------|---------|
| build | 全パッケージ + アプリをビルド |
| typecheck | packages/core, packages/web, apps/editor, apps/ksc-editor, apps/next, apps/hono |
| lint | apps/next |
| test | 全パッケージのユニットテスト |
| test:e2e | Playwright E2E テスト |
| test:azure | Azure E2E テスト |

### Playwright 設定 (6 ファイル)

| ファイル | testDir | baseURL | 用途 |
|---------|---------|---------|------|
| playwright.config.ts | ./e2e | localhost:5175 | KSC デモテスト |
| playwright.local.config.ts | ./tests | localhost:3000 | ローカル E2E |
| playwright.azure.config.ts | ./tests | Azure Next.js | Azure E2E |
| playwright.azure-auth.config.ts | ./tests | Azure Next.js | Azure 認証テスト |
| playwright.demo.config.ts | — | — | デモモード |
| playwright.check.config.ts | — | — | UI 検証 |

## Git Hooks (.husky/)

### pre-push (23 行)

`git push` 時に自動実行。失敗すると push がブロックされる。

1. **typecheck**: packages/core, packages/web, apps/editor, apps/ksc-editor, apps/next, apps/hono
2. **lint**: apps/next のみ（Editor lint は既存エラーあり）

### pre-commit (26 行)

`git commit` 時に自動実行。

1. **ハードコード URL チェック**: `apps/editor/src/` 内の `localhost:8080` を検出（`api.ts` は除外）
2. **E2E セレクタ同期チェック**: `check-e2e-sync.sh` を実行

## GitHub Actions ワークフロー (.github/workflows/)

### deploy.yml (217 行) — Container Apps デプロイ

| 項目 | 内容 |
|------|------|
| トリガー | push to main (全コミット) + workflow_dispatch |
| ジョブ | build-and-push (並列 matrix: api, nextjs) → deploy → post-deploy-checks |
| ビルド | Docker build → ACR レジストリ push |
| デプロイ | `az containerapp update` で新イメージ適用 |
| 後処理 | ヘルスチェック (4サービス)、アセット URL、CORS、SPA fallback |
| 環境変数 | VITE_API_URL, VITE_NEXT_APP_URL, VITE_PREVIEW_URL, API_URL, NEXT_PUBLIC_* |

### deploy-swa.yml (137 行) — Static Web Apps デプロイ

| 項目 | 内容 |
|------|------|
| トリガー | push to main + workflow_dispatch |
| ジョブ | Editor SWA, Preview SWA (並列) |
| 依存ビルド | Core, Compiler, KSC-Compiler, Battle, Web |
| デプロイ | Azure/static-web-apps-deploy@v1 |
| 後処理 | ヘルスチェック (Editor 200, Preview 200) |

### ci.yml (103 行) — CI パイプライン

| 項目 | 内容 |
|------|------|
| トリガー | push/PR to main |
| ジョブ (並列) | typecheck, lint, unit-tests, unit-tests-apps, unit-tests-hono |
| typecheck | packages/core, packages/web, apps/editor, apps/ksc-editor, apps/next, apps/hono |
| lint | apps/next のみ |
| ユニットテスト | core, compiler, interpreter (packages); editor, next (apps) |
| Hono テスト | PostgreSQL サービスコンテナ付き |
| DB チェック | Prisma マイグレーション未適用を検出、失敗なら CI 失敗 |

### check-hardcoded-urls.yml (94 行)

| 項目 | 内容 |
|------|------|
| トリガー | push/PR to apps/editor/** |
| チェック | localhost:8080 のハードコード検出、dist/ 内のURL確認 |
| 検証 | 環境変数設定確認、ビルド成功確認 |

### Azure SWA レガシー (3 ファイル, 各 46 行)

- `azure-static-web-apps-agreeable-river-*.yml` — Editor SWA
- `azure-static-web-apps-happy-tree-*.yml` — Preview SWA
- `azure-static-web-apps-witty-grass-*.yml` — (旧)
- **現在は deploy-swa.yml に統合**

## Docker 構成

### apps/hono/Dockerfile (マルチステージ)

```dockerfile
# Stage 1: deps — 依存インストール
FROM node:20-slim AS deps
# root + workspace packages の package.json をコピー
# npm ci --workspace で依存インストール

# Stage 2: builder — ビルド
FROM deps AS builder
# ai-gateway ビルド
# Prisma クライアント生成
# Hono ビルド (tsc)

# Stage 3: runner — 実行
FROM node:20-slim AS runner
# OpenSSL インストール (Prisma 用)
# 非 root ユーザー (hono:nodejs)
# dist/, package.json, prisma/, node_modules コピー
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

### apps/next/Dockerfile (マルチステージ)

```dockerfile
# Stage 1: deps
# Stage 2: builder — next build
# Stage 3: runner — next start
EXPOSE 3000
```

## 環境変数

### apps/hono/.env

| 変数 | 説明 |
|------|------|
| DATABASE_URL | PostgreSQL 接続文字列 |
| JWT_SECRET | JWT 署名キー |
| ALLOWED_ORIGINS | CORS 許可オリジン (カンマ区切り) |
| AZURE_STORAGE_CONNECTION_STRING | Blob Storage 接続 |
| AZURE_COMMUNICATION_CONNECTION_STRING | Email 接続 |
| API_RATE_LIMIT | API レートリミット (デフォルト 200/min) |
| LOGIN_RATE_LIMIT | ログインレートリミット (デフォルト 5/min) |
| REGISTER_RATE_LIMIT | 登録レートリミット (デフォルト 3/hour) |
| PORT | サーバーポート (デフォルト 8080) |

### apps/next/.env.local

| 変数 | 説明 |
|------|------|
| NEXT_PUBLIC_API_URL | API サーバー URL |
| NEXT_PUBLIC_EDITOR_URL | Editor SPA URL |
| NEXT_PUBLIC_PREVIEW_URL | Preview エンジン URL |

### apps/editor/.env.development / .env.production

| 変数 | 説明 |
|------|------|
| VITE_API_URL | API サーバー URL |
| VITE_NEXT_APP_URL | Next.js アプリ URL |
| VITE_PREVIEW_URL | Preview エンジン URL |

## Azure リソース構成

| リソース | サービス | ホスト名 |
|---------|---------|---------|
| API | Container Apps | ca-api.*.azurecontainerapps.io |
| Next.js | Container Apps | ca-nextjs.*.azurecontainerapps.io |
| Editor | Static Web Apps | agreeable-river-*.azurestaticapps.net |
| Preview | Static Web Apps | happy-tree-*.azurestaticapps.net |
| DB | PostgreSQL Flexible Server | — |
| Assets | Blob Storage | — |
| ACR | Container Registry | — |

## デプロイフロー

```
開発者
  ↓ git push main
GitHub Actions
  ├── ci.yml: typecheck + lint + unit test
  ├── deploy.yml: Docker build → ACR → Container Apps (API + Next.js)
  └── deploy-swa.yml: npm build → SWA deploy (Editor + Preview)
  ↓
Azure
  ├── Container Apps: API (:8080), Next.js (:3000)
  ├── Static Web Apps: Editor, Preview
  ├── PostgreSQL: DB
  └── Blob Storage: Assets
```
