# Qiita 記事4本 作成計画書

作成日: 2026-03-02
対象: 本日の作業（15コミット）から Qiita 記事4本を作成する

## 前提

- Qiita skill (`/.claude/skills/qiita/skill.md`) に従う
- 保存先: `docs/09_reports/` + `docs/qiita/drafts/`（両方必須）
- `ignorePublish: true`（ドラフト状態で保存、投稿判断はユーザーに委ねる）
- コミットまで実施、push はしない

## 作成する記事（4本）

### 記事A: テストギャップ分析でバグ発見

| 項目 | 内容 |
|------|------|
| タイトル案 | テストを書いたら本番バグが3件出てきた：VNエンジン214テストの裏側 |
| パターン | C: トラブルシューティング型 |
| タグ | claudecode, typescript, テスト, PixiJS, ゲーム開発 |
| ソース | 01〜03 レポート、コミット e0b04dc〜718b460 |

**構成:**
1. はじめに — 133→214テストに増やす過程でバグ3件発見した結論
2. 前提・環境 — Vitest / PixiJS v8 / TypeScript / monorepo 構成
3. バグ1: overlay が buildPreviewScript に未実装（重複switch文のドリフト）
4. バグ2: bg_new が characterLayer に配置（z-order バグ）
5. バグ3: ch_new クロスフェード未実装（テスト設計から逆算で機能追加）
6. PixiJS モック戦略（vi.hoisted + vi.mock）
7. まとめ — テストギャップ分析は「カバレッジ」ではなく「バグ発見」のためにやる

### 記事B: 分散switch文の同期問題

| 項目 | 内容 |
|------|------|
| タイトル案 | 8ファイルのswitch文を同期させる：コマンドレジストリで断絶を防ぐ |
| パターン | A: ハウツー型 |
| タグ | claudecode, typescript, 設計, リファクタリング, ゲーム開発 |
| ソース | 04 レポート、コミット f3436d6〜8bcef27 |

**構成:**
1. はじめに — 新コマンド追加で8箇所を手動同期する問題
2. 前提・環境 — compiler / core / web / editor / hono の5層
3. 問題: 10コマンドが OpRunner にあるが Interpreter に未登録
4. 手順①: COMMAND_DEFINITIONS レジストリの設計（型定義・lookup map）
5. 手順②: 同期テストの実装（Object.keys 比較で漏れ検出）
6. Before/After — 手動チェックリスト vs 自動検出
7. まとめ — 「登録漏れはテストで落とす」

### 記事C: AI親和性API設計パターン

| 項目 | 内容 |
|------|------|
| タイトル案 | REST APIをAIエージェント対応にする：_ai_contextパターンの実装手順 |
| パターン | A: ハウツー型 |
| タグ | claudecode, API設計, REST, AI, typescript |
| ソース | 05 レポート、コミット 70e3b20〜a62b1b6 |

**構成:**
1. はじめに — AIエージェントがAPIを叩くとき何が足りないか
2. 前提・環境 — Hono / Prisma / TypeScript
3. 手順①: 静的スキーマ API（`/api/editor-schema`）の設計・実装
4. 手順②: 動的コンテキスト（`_ai_context`）の付与ロジック
5. 手順③: 書き込み時の自動除去（strip on write）
6. テスト — 7テストの設計（round-trip 検証含む）
7. まとめ — 読み取り時付与・書き込み時除去のパターン

### 記事D: OBS WebSocket でE2Eテスト配信

| 項目 | 内容 |
|------|------|
| タイトル案 | OBS WebSocketでE2Eテストをライブ配信する：CLIツールの作り方 |
| パターン | A: ハウツー型 |
| タグ | claudecode, OBS, WebSocket, Playwright, E2E |
| ソース | コミット 71343a8〜4c5f417 |

**構成:**
1. はじめに — E2Eテスト実行を録画・配信したい動機
2. 前提・環境 — OBS / obs-websocket-js / Playwright
3. 手順①: obs-stream.mjs の実装（接続・配信開始・停止）
4. 手順②: rec / rec-stop コマンドの追加
5. 手順③: テスト名を動画映えさせる（日本語表示名 + 絵文字）
6. ハマったポイント — WebSocket 接続タイミング・認証
7. まとめ

## 実行手順

1. 記事A を作成 → `docs/09_reports/` + `docs/qiita/drafts/` に保存
2. 記事B を作成 → 同上
3. 記事C を作成 → 同上
4. 記事D を作成 → 同上
5. 4記事をまとめて git commit（push しない）

## ファイル命名

| 記事 | reports パス | drafts パス |
|------|-------------|-------------|
| A | `docs/09_reports/2026/03/02/08-qiita-test-gap-bug-discovery.md` | `docs/qiita/drafts/01kjptmm22-test-gap-bug-discovery.md` |
| B | `docs/09_reports/2026/03/02/09-qiita-command-registry-sync.md` | `docs/qiita/drafts/01kjptmm27-command-registry-sync.md` |
| C | `docs/09_reports/2026/03/02/10-qiita-ai-context-api-pattern.md` | `docs/qiita/drafts/01kjptmm29-ai-context-api-pattern.md` |
| D | `docs/09_reports/2026/03/02/11-qiita-obs-websocket-e2e-stream.md` | `docs/qiita/drafts/01kjptmm2a-obs-websocket-e2e-stream.md` |

## 録画ワークフロー

1. `node scripts/obs-stream.mjs rec` — 録画開始
2. オープニングバナー表示（stream skill に従う）
3. ULID 生成（4件分）
4. 記事A → 記事B → 記事C → 記事D を順に作成（drafts + reports 両方保存）
5. `git add` + `git commit`（push しない）
6. コミット完了を確認
7. エンディングバナー表示
8. `node scripts/obs-stream.mjs rec-stop` — 録画停止
