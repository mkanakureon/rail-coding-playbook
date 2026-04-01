# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**kaedevn-monorepo** is a cross-platform visual novel engine targeting **Nintendo Switch** (primary) and **Web** (secondary, via PixiJS/WebGL). コンパイラ・エンジン・エディタ・API が実装済みで、Azure にデプロイされ稼働中。

## Architecture

### Core Abstractions (mandatory)

| Interface | Purpose | Web Implementation |
|-----------|---------|-------------------|
| `IInput` | Unified action dispatch for all input sources | PixiJS pointer/keyboard events |
| `IAudio` | BGM/SE/VOICE playback with per-category volume | Web Audio API |
| `IStorage` | Save/Load abstraction | IndexedDB |

Input, audio, storage は**必ず抽象化経由**（Switch 移植時の全書き換え回避）。Rendering (PixiJS) は直接利用可。

### Input System

All input is routed through `dispatch(Action)`. No direct event-to-game-logic wiring.

**Fixed action set:** OK, Back, Menu, SkipToggle, AutoToggle, Log, QuickSave, QuickLoad

### Resolution & Layout

- Logical: **1280×720** / Safe area: **5% margins** (64px H, 36px V)
- UI positioning: anchor-based relative coordinates (no hardcoded pixels)
- Scaling: `app.renderer.resize(w, h)` + `stage.scale.set(scale)`, aspect ratio maintained

### Save Schema (frozen)

```json
{ "save_schema_version": 1, "engine_version": "", "work_id": "", "scenario_id": "", "node_id": "", "vars": {}, "read": {}, "timestamp": 0 }
```

Reference IDs only (no embedded images/audio). Backward compat via `save_schema_version`.

### Script Command Set (frozen)

**Core (Switch-guaranteed):** text, choice, jump, set, if, show, hide, move, fade, playBgm, playSe, playVoice, wait (click/timeout/voiceend), overlay, overlay_hide

**Web-only (isolated):** openUrl, share, analytics, webOnlyUI

Main scenario は Core のみ。Web-only はメニュー・ナビゲーション限定。

### Asset Constraints

- Max dimension: **2048px** / Animations: sprite sheets only, 12–15fps
- Audio: BGM / SE / VOICE

## Server Configuration

| Server | Port | Directory | Role |
|--------|------|-----------|------|
| **Editor (Vite)** | 5176 | `apps/editor` | Full-featured editor (main) |
| **KSC Editor (Vite)** | 5177 | `apps/ksc-editor` | KSC script editor |
| Next.js | 3000 | `apps/next` | Auth, project management |
| Hono API | 8080 | `apps/hono` | Backend API |
| Vite (web) | 5175 | `packages/web` | Visual novel engine / preview |

- Editor: `http://localhost:5176/projects/editor/{projectId}`
- KSC Editor: `http://localhost:5177/projects/ksc-editor/{workId}`
- Preview: `http://localhost:5175/ksc-demo.html`
- API: `http://localhost:8080/api/preview/:id`

## Development Commands

```bash
./scripts/dev-start.sh            # API + Next.js
./scripts/dev-start.sh all        # 全サーバー
./scripts/dev-start.sh api next editor  # 指定のみ

npm install      # Install dependencies
npm run typecheck # Type-check all
npm run lint      # Lint (editor + next)
npm run build     # Build all
```

### Pre-push Hook

`git push` 時に typecheck + lint が自動実行（`.husky/pre-push`）。失敗時は push ブロック。

### Local DB / Credentials

| Item | Value |
|------|-------|
| PostgreSQL | `postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev` |
| Admin login | `mynew@test.com` / `DevPass123!` |
| User login | `test1@example.com` / `DevPass123!` |
| Env files | `apps/hono/.env`, `apps/next/.env.local` |

## Deploy

**すべて GitHub Actions 経由**。`main` への push で自動デプロイ。

| ワークフロー | 対象 |
|-------------|------|
| `deploy.yml` | Container Apps (API + Next.js) |
| `deploy-swa.yml` | Static Web Apps (Editor + Preview) |

```bash
git push                                    # 自動デプロイ
gh workflow run deploy.yml                  # 手動: api + nextjs
gh workflow run deploy.yml -f targets=api   # 手動: api のみ
gh workflow run deploy-swa.yml              # 手動: editor + preview
gh run list --workflow=deploy.yml --limit=3 # 状況確認
```

- `./scripts/deploy-azure.sh`・手動 `docker build`/`az acr build` は使わない

## Rules

### 並列実行

- 独立したディレクトリに閉じるタスクは並列で実行する
- 文書確認（docs/ 読み取り）は実装と常に並列で走らせる
- `packages/core` など複数パッケージが依存するファイルは並列で同時編集しない

### コミットは必ず commit スキル経由（必須）

`git commit` を直接実行しない。必ず `/commit` スキルを使う。
スキル経由でないと **Claude の一言** と **Co-Authored-By** が付かない。pre-commit フックでもチェック。

### 作業前の RAG 検索（習慣）

まとまった作業の前に `docs/` を RAG 検索する（設計→仕様書、バグ修正→インシデント、文書→前例、デプロイ→障害経緯）。

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","id":1,"params":{"name":"search_docs","arguments":{"query":"検索キーワード","topK":5}}}' | jq .
```

API 未起動時は `Grep` で `docs/` を検索。

### バグ修正の手順（最重要）

**原因が特定できていない問題に対して、推測でソースコードを変更してはいけない。**

1. **再現条件を切り分ける** — 何があると起きて、何がないと起きないか
2. **原因を特定する** — ログ・実際の値で確認。推測しない
3. **修正方針を説明する** — 原因不明なら「不明」と伝える
4. **修正後に動作確認する** — 確認前に「修正完了」と報告しない

**禁止:** 推測でコード変更 / 未確認で「正常です」報告 / 推測変更の複数回繰り返し

#### 外部ライブラリ問題

自分のコードを変更する前に `node_modules/ライブラリ名/dist/` のソースを読む。特に PixiJS・Live2D SDK など内部パイプラインを持つライブラリは実行順序をソースで確認。

#### サーバーコード変更後

1. 起動時刻確認: `ps -p $(lsof -ti:8080) -o lstart=`（古ければ再起動）
2. curl で API レスポンス確認 → UI テスト

### Before Creating New Files

- Glob/Grep で既存の類似ファイルを検索してから作成
- エディタ機能は `apps/editor` に実装（Next.js に作らない）

### State の配置（React）

共有 state は**参照・更新するコンポーネントの共通最小祖先**に置く。`EditorPage.tsx` の render 構造を確認。兄弟間共有なら親に引き上げる。

### React / Next.js コード変更時のスキル参照（必須）

以下のファイルを変更・新規作成する際は、対応するスキルを **実装前に** 読み込むこと。

| 変更対象 | 参照スキル | 内容 |
|---------|-----------|------|
| `apps/next/` のコンポーネント・ページ | `vercel-react-best-practices` | パフォーマンス最適化（RSC, データフェッチ, バンドル） |
| `apps/editor/` のコンポーネント設計 | `vercel-composition-patterns` | Compound Components, boolean prop 排除 |
| UI 実装全般 | `web-design-guidelines` | アクセシビリティ, コントラスト比, レスポンシブ |

スキルは `.agents/skills/` に格納（Gemini CLI と共有）。テスト追加のみ・docs のみの変更では不要。

### Adding New Script Commands

`@xxx` 追加時は以下を全て実施（`commandRegistry.ts` が単一定義源、登録漏れは同期テストで検出）:

1. `packages/compiler/src/registry/commandRegistry.ts` — パーサー追加
2. `packages/core/src/types/Op.ts` — Op 型追加
3. `packages/web/src/engine/IOpHandler.ts` — ハンドラ追加
4. `packages/web/src/engine/OpRunner.ts` — dispatch case
5. `packages/web/src/engine/WebOpHandler.ts` — 実装
6. `apps/editor/src/store/useEditorStore.ts` — `getBlockScript` / `buildSnapshotScript`
7. `apps/hono/src/routes/preview.ts` — `generateKSCScript`
8. `npm test -w @kaedevn/compiler` — 同期テスト通過確認

### Testing

テストの目的は「エラーの発見」と「正常動作の確認」。

- `expect` は期待する状態を **1 つだけ** 明示（`expect([200, 500]).toContain()` 禁止）
- `if` で `expect` スキップしない / フォールバック・エラー握りつぶし禁止
- `waitForTimeout` でごまかさず正しい条件を待つ
- 失敗→原因調査→コード修正。Azure 向けは適切なタイムアウト明示

### Architecture Check（設計ルール違反の検出）

`scripts/lint/architecture-check.sh` で設計ルール違反を検出する。新規コードにのみ適用（既存コードは Warning）。

```bash
bash scripts/lint/architecture-check.sh              # 新規違反のみ（CI 用）
bash scripts/lint/architecture-check.sh --warn-existing  # 既存負債も表示
bash scripts/lint/architecture-report.sh              # 全メトリクスのレポート
```

### Forbidden Patterns（禁止パターンと代替）

```typescript
// ── localStorage ──
// NG: 直接アクセス（Switch 移植時に全書き換えが必要になる）
localStorage.setItem("token", value)
// OK: IStorage 抽象経由
await storage.set("token", value)

// ── ピクセル座標 ──
// NG: ハードコードリテラル（解像度変更時に全箇所修正が必要）
sprite.position.set(320, 240)
// OK: レイアウト定数 or 相対座標
sprite.position.set(layout.center.x, layout.center.y)

// ── fetch（UI 層）──
// NG: UI コンポーネントから直接 fetch
const res = await fetch("/api/projects")
// OK: API クライアント経由
const res = await apiClient.projects.list()

// ── waitForTimeout（テスト）──
// NG: 固定時間待機（flaky テストの原因）
await page.waitForTimeout(2000)
// OK: 条件待機
await page.waitForSelector('button:enabled')
await expect(page.locator('.loaded')).toBeVisible()
```

### Change Zones（変更境界の定義）

| ゾーン | AI の権限 | 対象 |
|--------|----------|------|
| **A. 自由変更** | 制限なし | UI の見た目、文言、小コンポーネント、テスト追加、docs |
| **B. 条件付き変更** | 型チェック + テスト必須 | store, api client, shared utilities, route handler, command parser |
| **C. 設計境界** | Design Change Note 必須 | 下記参照 |

**C ゾーン（設計境界）対象ファイル:**
- `packages/core/src/interfaces/` — IStorage, IInput, IAudio
- `packages/core/src/types/Op.ts` — 全コマンドの型定義
- `packages/core/src/types/SaveData.ts` — frozen schema
- `packages/interpreter/src/core/` — スクリプト実行エンジン
- `packages/web/src/renderer/` のインターフェース
- `apps/hono/src/routes/auth.ts` のスキーマ部分
- `prisma/schema.prisma`

C ゾーン変更時は、コミット前に以下を記述:

```
## Design Change Note
- 何を変えるか:
- なぜ必要か:
- 依存方向は変わるか: Yes / No
- 既存抽象を再利用できない理由:
- 破壊的変更か: Yes / No
```

### New Abstraction Rules（新規抽象の追加条件）

新規 abstraction / helper / service / hook / util は以下の**全て**を満たす場合のみ許可:

1. 同じ処理が **3箇所以上** にある
2. ドメイン概念として **名前がある**
3. 今後も **再利用が見込める**
4. 依存方向を **改善する**
5. テストしやすく **なる**

満たさなければ既存に寄せる。

### DB Schema Changes

Prisma schema 変更後: `npx prisma migrate dev` → 本番 `npx prisma migrate deploy` → `apps/hono/test/schema-sync.test.ts` で検証

## AI Metadata (for AI agents editing projects)

- **Static Schema:** `GET /api/editor-schema` — 認証不要。全14ブロック型の定義・制約・enum。24時間キャッシュ
- **Dynamic Context:** `GET /api/projects/:id` の `_ai_context` に `availableAssets`, `availableCharacters`, `availablePages`, `knownVariables` 等
- **Block Rules:** ID は `{type}-{Date.now()}`、`start` は各ページ1つ（削除・移動不可）、`assetId` 等は `_ai_context` の実在 ID を使用、`_ai_context` は読み取り専用

## Language

Specifications are written in Japanese. Code and identifiers should use English.
