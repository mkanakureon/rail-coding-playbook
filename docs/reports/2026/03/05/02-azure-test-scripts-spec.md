# Azure テスト・デプロイ検証スクリプト設計書

## 背景

Azure E2E テスト (`tests/azure-*.spec.ts`) の実行に以下の問題があった:

1. `playwright.config.ts` の `testDir: './e2e'` のせいで `tests/` のファイルが検出されず、毎回 config 指定が必要だった → `playwright.azure.config.ts` + `npm run test:azure` で解消済み
2. サービスが落ちているときに Playwright のタイムアウト（2分超）を待ってから失敗する
3. API のコールドスタートで `beforeAll` のログインがタイムアウトする
4. curl での手動確認と Playwright テストが分離しており、再現性のある手順が統一されていない

## ゴール

- サービス死活確認 → API 疎通 → ブラウザ E2E の3段階で段階的にテスト
- 前段が失敗したら後段をスキップし、無駄な待ち時間を削減
- 個別実行・統合実行どちらも可能
- `--repeat N` で安定性確認ができる

## スクリプト構成

```
scripts/
  azure-env.sh               # 共有定数（URL・認証情報）
  test-azure.sh              # 統合スクリプト（1→2→3 順に実行）
  test-azure-health.sh       # Phase 1: curl ヘルスチェック
  test-azure-api.sh          # Phase 2: API 疎通テスト（curl）
  test-azure-e2e.sh          # Phase 3: Playwright E2E
  deploy-verify.sh           # デプロイ → Actions 完了待ち → 全Phase検証
```

## Phase 1: ヘルスチェック (`test-azure-health.sh`)

4つのサービスに curl でアクセスし、HTTP 200 を確認する。

| サービス | URL | タイムアウト |
|---------|-----|------------|
| API | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health` | 15秒 |
| Next.js | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` | 15秒 |
| Editor | `https://agreeable-river-0bfb78000.4.azurestaticapps.net` | 10秒 |
| Preview | `https://happy-tree-012282700.1.azurestaticapps.net` | 10秒 |

- 各サービスの応答時間も表示する
- 1つでも失敗 → exit 1（後続テスト不要）
- 全成功 → サマリー表示

## Phase 2: API 疎通テスト (`test-azure-api.sh`)

curl でログイン・主要エンドポイントを検証する。

| テスト | 内容 | 期待 |
|-------|------|------|
| ログイン | `POST /api/auth/login` (test1@example.com) | 200 + token |
| 認証確認 | `GET /api/auth/me` (Bearer token) | 200 + user |
| プロジェクト一覧 | `GET /api/projects` (Bearer token) | 200 + projects[] |
| 公式アセット | `GET /api/official-assets?kind=bg` | 200 |
| CORS (Editor) | `OPTIONS /api/health` (Origin: Editor URL) | Access-Control-Allow-Origin ヘッダ |
| CORS (Next.js) | `OPTIONS /api/health` (Origin: Next.js URL) | Access-Control-Allow-Origin ヘッダ |
| CORS (Preview) | `OPTIONS /api/health` (Origin: Preview URL) | Access-Control-Allow-Origin ヘッダ |
| 未認証拒否 | `GET /api/projects` (トークンなし) | 401 |

- 各リクエストの応答時間を表示
- 失敗したテストがあっても全テスト実行する（結果を集計）
- 最後にサマリー（passed/failed 数）を表示

## Phase 3: Playwright E2E (`test-azure-e2e.sh`)

既存の `playwright.azure.config.ts` を使って Playwright テストを実行する。

```bash
npx playwright test -c playwright.azure.config.ts "$@"
```

- 引数でファイル名フィルタ可能（例: `./scripts/test-azure-e2e.sh full-flow`）
- `--reporter=list` をデフォルトに

## 統合スクリプト (`test-azure.sh`)

```bash
./scripts/test-azure.sh              # 全Phase実行
./scripts/test-azure.sh --repeat 3   # 3回連続実行（安定性確認）
./scripts/test-azure.sh --phase 1    # Phase 1 のみ
./scripts/test-azure.sh --phase 2    # Phase 1 + 2
./scripts/test-azure.sh --skip-health # Phase 1 スキップ（2→3）
```

動作:
1. Phase 1 実行 → 失敗なら「サービスダウン」表示して終了
2. Phase 2 実行 → 失敗があっても Phase 3 に進む（API の一部障害でも E2E は試す価値あり）
3. Phase 3 実行
4. 全体サマリー表示（各 Phase の passed/failed）

`--repeat N` の場合:
- Phase 1 は初回のみ（毎回やる意味がない）
- Phase 2 + Phase 3 を N 回繰り返す
- 各回の結果を記録し、最後にまとめて表示

## URL の管理

4つの Azure URL はスクリプト間で共有する。`scripts/azure-env.sh` に定数を定義し、各スクリプトで source する。

```bash
# scripts/azure-env.sh
export AZURE_API_URL="https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
export AZURE_NEXT_URL="https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
export AZURE_EDITOR_URL="https://agreeable-river-0bfb78000.4.azurestaticapps.net"
export AZURE_PREVIEW_URL="https://happy-tree-012282700.1.azurestaticapps.net"
export AZURE_TEST_EMAIL="test1@example.com"
export AZURE_TEST_PASSWORD="DevPass123!"
```

## デプロイ検証 (`deploy-verify.sh`)

`git push` → GitHub Actions 完了待ち → テスト自動実行を一気通貫で行う。

```bash
./scripts/deploy-verify.sh              # push → Actions待ち → 全テスト
./scripts/deploy-verify.sh --no-push    # push 済みの場合（Actions待ち → テストのみ）
./scripts/deploy-verify.sh --skip-test  # push → Actions待ちのみ（テストなし）
```

動作:
1. `git status` で未コミットの変更がないか確認（あれば警告して終了）
2. `git push` 実行
3. `gh run list` で最新のワークフロー実行を取得
4. `gh run watch` で完了を待つ（deploy.yml + deploy-swa.yml 両方）
5. Actions 失敗 → エラー表示して終了
6. Actions 成功 → `./scripts/test-azure.sh` を実行（全Phase）
7. 結果サマリー表示

対応ワークフロー:
- `deploy.yml` — Container Apps (API + Next.js)
- `deploy-swa.yml` — Static Web Apps (Editor + Preview)

両方トリガーされた場合は両方の完了を待つ。片方のみの場合（変更ファイルのパスによる）はその1つだけ待つ。

## 出力フォーマット

```
========================================
  Azure Test Suite
  2026-03-05 14:30:00
========================================

── Phase 1: Health Check ──
  ✓ API          200  (320ms)
  ✓ Next.js      200  (485ms)
  ✓ Editor       200  (929ms)
  ✓ Preview      200  (501ms)
  → 4/4 passed

── Phase 2: API Tests ──
  ✓ Login                200  (450ms)
  ✓ Auth me              200  (120ms)
  ✓ Projects list        200  (230ms)
  ✓ Official assets      200  (180ms)
  ✓ CORS Editor          OK   (90ms)
  ✓ CORS Next.js         OK   (85ms)
  ✓ CORS Preview         OK   (92ms)
  ✓ Unauthorized         401  (50ms)
  → 8/8 passed

── Phase 3: Playwright E2E ──
  55 passed (1.9m)

========================================
  RESULT: ALL PASSED
========================================
```
