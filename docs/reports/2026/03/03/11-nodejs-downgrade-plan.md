# Node.js 22 LTS ダウングレード計画

**日付**: 2026-03-03
**目的**: ローカル開発環境の Node.js を v25.6.0 → v22 LTS に変更し、Hono の「Malformed JSON」問題を解消する
**関連**: `10-malformed-json-bug-investigation.md`

## 背景

| 環境 | Node.js バージョン |
|---|---|
| ローカル開発 (Mac) | **v25.6.0**（Homebrew、最新不安定版） |
| Docker / CI | v20（Dockerfile, GitHub Actions） |
| Azure Container Apps | v20（Docker イメージ） |

ローカルだけ v25 の不安定版を使っており、`@hono/node-server` の `Request`/`ReadableStream` 実装との互換性問題が発生している可能性が高い。

## 計画

### Phase 1: ローカル Node.js を v22 LTS に変更

```bash
# 1. nvm をインストール（未導入の場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# 2. Node.js 22 LTS をインストール
nvm install 22

# 3. デフォルトに設定
nvm alias default 22

# 4. 確認
node --version  # → v22.x.x
```

### Phase 2: プロジェクトに Node.js バージョンを固定

```bash
# .nvmrc を作成（プロジェクトルート）
echo "22" > .nvmrc
```

### Phase 3: Hono パッケージも最新に更新

```bash
npm install hono@latest @hono/zod-validator@latest @hono/node-server@latest
```

### Phase 4: 動作確認

```bash
# 1. API サーバー起動
./scripts/dev-start.sh api

# 2. register テスト
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"nodetest@example.com","password":"DevPass123!","username":"nodetest"}'

# 3. login テスト
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mynew@test.com","password":"DevPass123!"}'

# 4. guest テスト
curl -X POST http://localhost:8080/api/auth/guest \
  -H "Content-Type: application/json"
```

### Phase 5: Docker / CI のバージョンも 22 に統一（任意）

現在 Docker / CI は v20 だが、v22 LTS に上げることで環境差を最小化できる。

| ファイル | 変更内容 |
|---|---|
| `apps/hono/Dockerfile` | `node:20-slim` → `node:22-slim` |
| `apps/next/Dockerfile` | `node:20-alpine` → `node:22-alpine` |
| `apps/editor/Dockerfile` | `node:20-alpine` → `node:22-alpine` |
| `packages/web/Dockerfile` | `node:20-alpine` → `node:22-alpine` |
| `.github/workflows/ci.yml` | `node-version: '20'` → `'22'` |
| `.github/workflows/deploy-swa.yml` | `node-version: 20` → `22` |
| `.github/workflows/check-hardcoded-urls.yml` | `node-version: '20'` → `'22'` |

**注**: Phase 5 は Phase 4 でローカルが安定した後に実施。Docker/CI は現状 v20 で問題なく動作している。

## リスク

| リスク | 対策 |
|---|---|
| nvm 導入で既存の Homebrew node と競合 | `brew unlink node` で Homebrew 版を無効化 |
| npm パッケージの互換性 | v22 LTS は広くサポートされているため低リスク |
| Hono 最新版の破壊的変更 | changelog を確認してから更新 |

## 成功基準

- [ ] `node --version` → `v22.x.x`
- [ ] `POST /api/auth/register` → 201 (ローカル)
- [ ] `POST /api/auth/login` → 200 (ローカル)
- [ ] Azure テスト 全パス
