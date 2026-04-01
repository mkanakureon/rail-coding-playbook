---
description: Use when the user asks to run tests against Azure (production). Triggers on "azureテスト", "本番テスト", "ヘルスチェック", "安定性確認".
---

# Azure テスト

Azure 環境の3段階テスト（Health → API → E2E）を実行する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| `azureテストして` / `azure テスト` / `本番テスト` | 全Phase実行 (`./scripts/test/azure/run-all.sh`) |
| `azureテスト 3回` / `安定性確認` / `繰り返しテスト` | `./scripts/test/azure/run-all.sh --repeat N` |
| `ヘルスチェックだけ` / `サービス生きてる？` | `./scripts/test/azure/health.sh` |
| `APIテストだけ` / `curl テスト` | `./scripts/test/azure/run-all.sh --phase 2` |
| `E2Eだけ` / `ブラウザテストだけ` | `./scripts/test/azure/e2e.sh` |

## スクリプト構成

| スクリプト | 用途 |
|---|---|
| `scripts/test/azure/env.sh` | 共有定数（URL・認証情報） |
| `scripts/test/azure/health.sh` | Phase 1: 4サービス死活確認 (curl) |
| `scripts/test/azure/api.sh` | Phase 2: API 疎通 8項目 (curl) |
| `scripts/test/azure/e2e.sh` | Phase 3: Playwright E2E 55テスト |
| `scripts/test/azure/run-all.sh` | 統合スクリプト |

## 実行手順

### 1. コマンド選択

```bash
# 全Phase（推奨）
./scripts/test/azure/run-all.sh

# 安定性確認（N回連続）
./scripts/test/azure/run-all.sh --repeat 3

# Phase 1+2 のみ（curl だけ、E2E スキップ）
./scripts/test/azure/run-all.sh --phase 2

# Phase 1 スキップ（ヘルスチェック済みの場合）
./scripts/test/azure/run-all.sh --skip-health

# 個別実行
./scripts/test/azure/health.sh       # Phase 1 のみ
./scripts/test/azure/api.sh          # Phase 2 のみ
./scripts/test/azure/e2e.sh          # Phase 3 のみ
./scripts/test/azure/e2e.sh full-flow  # 特定ファイルのみ
```

### 2. 実行

スクリプトを `bash` で実行する。出力をそのままユーザーに見せる。

### 3. 失敗時の対応

- **Phase 1 失敗**: サービスダウン。Azure Portal or `az containerapp logs show` でログ確認
- **Phase 2 失敗**: API の特定機能が壊れている。失敗したテスト名からエンドポイントを特定して調査
- **Phase 3 失敗**: ブラウザテスト失敗。Playwright のエラーメッセージとスクリーンショットで原因特定

## 3段階テストの内容

### Phase 1: Health Check (curl)

4つのサービスの死活確認。1つでも落ちていれば即終了。

| サービス | URL |
|---------|-----|
| API | `ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health` |
| Next.js | `ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Editor | `agreeable-river-0bfb78000.4.azurestaticapps.net` |
| Preview | `happy-tree-012282700.1.azurestaticapps.net` |

### Phase 2: API Tests (curl)

8項目の API 疎通テスト。

| テスト | 期待 |
|-------|------|
| Login (POST /api/auth/login) | 200 + token |
| Auth me (GET /api/auth/me) | 200 |
| Projects list (GET /api/projects) | 200 |
| Official assets (GET /api/official-assets) | 200 |
| CORS Editor / Next.js / Preview | Access-Control-Allow-Origin ヘッダ |
| Unauthorized (GET /api/projects, no token) | 401 |

### Phase 3: Playwright E2E

`tests/configs/playwright.azure.config.ts` で Playwright テストを実行。

- `tests/azure/azure-full-flow.spec.ts` — 50テスト（トップ→登録→ログイン→マイページ→エディタ→プレビュー→公開→CORS）
- `tests/azure/azure-asset-selection.spec.ts` — 5テスト（背景選択・キャラ選択・管理画面）

## 設定ファイル

- **Playwright config**: `tests/configs/playwright.azure.config.ts` — azure/ + shared/ を対象、timeout=120s, workers=1
- **環境定数**: `scripts/test/azure/env.sh` — URL・テストアカウント
- **npm script**: `npm run test:azure`

## 既知の注意点

- Container Apps はコールドスタートで初回応答に最大30秒かかる
- `azure-asset-selection` の `beforeAll` は `timeout: 30000` に設定済み
- macOS では `head -n -1` が使えないため `sed '$d'` を使用
