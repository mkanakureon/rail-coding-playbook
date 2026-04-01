# Azure テストスイート構築結果レポート (2026-03-05)

## 概要

Azure 環境の再現性ある検証パイプラインを構築した。4段階テスト（curl → API → E2E → 認証 E2E）で合計 101 テストが安定動作している。

## テスト結果

| Phase | 内容 | テスト数 | 時間 | 結果 |
|-------|------|---------|------|------|
| Phase 1: Health Check | 4サービス死活確認 (curl) | 4 | ~25s | ALL PASSED |
| Phase 2: API Tests | API疎通 8項目 (curl) | 8 | ~3s | ALL PASSED |
| Phase 3: Playwright E2E | azure-full-flow + azure-asset-selection | 55 | ~1.9m | ALL PASSED |
| Phase 4: Auth E2E | 認証・リダイレクト・エディタ連携 | 34 | ~1.1m | ALL PASSED |
| **合計** | | **101** | **~3.5m** | **ALL PASSED** |

## 成果物

### スクリプト

| ファイル | 役割 |
|---------|------|
| `scripts/azure-env.sh` | 共有定数（URL・認証情報） |
| `scripts/test-azure-health.sh` | Phase 1: curl ヘルスチェック |
| `scripts/test-azure-api.sh` | Phase 2: curl API 疎通テスト |
| `scripts/test-azure-e2e.sh` | Phase 3: Playwright E2E |
| `scripts/test-azure-auth.sh` | Phase 4: 認証 E2E |
| `scripts/test-azure.sh` | 統合スクリプト（全Phase実行） |
| `scripts/deploy-verify.sh` | デプロイ → Actions待ち → テスト一気通貫 |

### Playwright Config

| ファイル | 対象 |
|---------|------|
| `playwright.azure.config.ts` | `tests/azure-*.spec.ts` |
| `playwright.azure-auth.config.ts` | `tests/auth-*.spec.ts`, `tests/local-auth.spec.ts` |

### ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/09_reports/2026/03/05/02-azure-test-scripts-spec.md` | テスト・デプロイ検証スクリプト設計書 |
| `docs/09_reports/2026/03/05/03-shell-script-guidelines.md` | シェルスクリプト運用ガイドライン |
| `.claude/skills/test-azure/skill.md` | /test-azure スキル定義 |

### npm scripts

| コマンド | 動作 |
|---------|------|
| `npm run test:azure` | `playwright.azure.config.ts` で E2E 実行 |

## 使い方

```bash
# 全Phase（推奨）
./scripts/test-azure.sh

# 安定性確認（N回連続）
./scripts/test-azure.sh --repeat 3

# Phase 1+2 のみ（curl テスト、E2Eスキップ）
./scripts/test-azure.sh --phase 2

# Phase 1+2+3（認証テストスキップ）
./scripts/test-azure.sh --phase 3

# デプロイ → Actions待ち → 全テスト
./scripts/deploy-verify.sh

# push 済み → テストのみ
./scripts/deploy-verify.sh --no-push
```

## 修正した問題

| 問題 | 原因 | 修正 |
|------|------|------|
| `npx playwright test tests/azure-*` で No tests found | `playwright.config.ts` の `testDir: './e2e'` | `playwright.azure.config.ts` 新規作成 |
| azure-asset-selection の beforeAll タイムアウト | Container Apps コールドスタート > 15秒 | `request.post` に `timeout: 30000` 明示 |
| curl ヘルスチェック API タイムアウト | コールドスタート > 15秒 | タイムアウトを 30秒に延長 |
| `head -n -1` エラー | macOS (BSD) 非対応 | `sed '$d'` に置換 |
| 認証テストが Azure テストに未統合 | `URLS` が localhost 固定 | `process.env.TEST_*_URL` で Azure URL を注入する config 作成 |
| `deploy-verify.sh` の `read` が非インタラクティブで停止 | 未コミット変更時の確認プロンプト | 今後の改善候補（`--force` オプション追加等） |

## Phase 詳細

### Phase 1: Health Check

curl で 4 サービスの HTTP ステータスを確認。1つでも失敗なら即終了（後続テスト不要）。
副次効果として Container Apps のコールドスタートをここで消化し、後続 Phase の実行速度を安定させる。

### Phase 2: API Tests

curl で 8 項目を検証:
- ログイン (POST /api/auth/login) → 200 + token
- 認証確認 (GET /api/auth/me) → 200
- プロジェクト一覧 (GET /api/projects) → 200
- 公式アセット (GET /api/official-assets) → 200
- CORS (Editor / Next.js / Preview) → Access-Control-Allow-Origin ヘッダ
- 未認証拒否 (GET /api/projects, no token) → 401

### Phase 3: Playwright E2E

Azure 専用テスト:
- `azure-full-flow.spec.ts` (50テスト): トップ → 登録 → ログイン → マイページ → プロジェクト → エディタ → プレビュー → 公開 → CORS
- `azure-asset-selection.spec.ts` (5テスト): 背景選択・キャラ選択・管理画面

### Phase 4: Auth E2E

ローカル向け認証テストを `process.env.TEST_*_URL` で Azure 向けに転用:
- `auth-flow.spec.ts` (3テスト): ログイン→マイページ→プロジェクト作成
- `auth-redirect.spec.ts` (25テスト): リダイレクト・バリデーション・ログアウト・セッション・管理者制御・複数タブ
- `local-auth.spec.ts` (6テスト): ログイン・エディタ連携・編集と保存
