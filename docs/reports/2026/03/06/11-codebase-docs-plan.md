# ソースコード説明書 — 作成計画

## 対象

kaedevn-monorepo の全ソースコード（projects/ 内のコンテンツデータは除く）。
apps/, packages/, scripts/, tests/, 設定ファイル群を対象とする。

## ファイル規模

| カテゴリ | ファイル数（概算） |
|---------|-------------------|
| apps/editor | 105 |
| apps/hono (API) | 136 (src: 74, test: 46) |
| apps/next | 78 |
| apps/ksc-editor | 20 |
| packages/web | 109 |
| packages/core | 37 |
| packages/compiler | 36 |
| packages/ksc-compiler | 24 |
| packages/interpreter | 36 |
| packages/ai-gateway | 18 |
| packages/battle | 16 |
| packages/ui | 10 |
| packages/native-engine | 75 |
| packages/tools | 4 |
| packages/vscode-ks-ksc | 7 |
| tests/ (E2E) | 50+ |
| scripts/ | 57 |
| 設定ファイル（ルート） | 20+ |

## 文書構成

`docs/09_reports/2026/03/06/codebase-docs/` に以下の文書を作成する。

### Phase 1: 全体構造（1文書）

| # | ファイル | 内容 |
|---|---------|------|
| 01 | `01-architecture-overview.md` | モノレポ全体構造、パッケージ依存関係、技術スタック、ディレクトリ構成図 |

### Phase 2: アプリケーション（4文書）

| # | ファイル | 対象 | 内容 |
|---|---------|------|------|
| 02 | `02-app-editor.md` | apps/editor | エディタSPA。コンポーネント一覧、Zustand store、ページ構成、hooks、utils |
| 03 | `03-app-hono-api.md` | apps/hono | Hono API。ルート一覧、ミドルウェア、Prisma schema、テスト |
| 04 | `04-app-next.md` | apps/next | Next.js。ページ構成、認証フロー、API連携、ミドルウェア |
| 05 | `05-app-ksc-editor.md` | apps/ksc-editor | KSCエディタ。コンポーネント、機能 |

### Phase 3: パッケージ（7文書）

| # | ファイル | 対象 | 内容 |
|---|---------|------|------|
| 06 | `06-pkg-core.md` | packages/core | 共有型定義、Op型、Timeline型、ユーティリティ |
| 07 | `07-pkg-compiler.md` | packages/compiler | .ks → Op[] コンパイラ。Lexer/Parser/CodeGenerator、コマンドレジストリ |
| 08 | `08-pkg-ksc-compiler.md` | packages/ksc-compiler | .ksc コンパイラ |
| 09 | `09-pkg-web-engine.md` | packages/web | PixiJS WebGL エンジン。OpHandler、LayerManager、デモページ |
| 10 | `10-pkg-interpreter.md` | packages/interpreter | スクリプトインタプリタ。VM、デバッグモード、エラーハンドリング |
| 11 | `11-pkg-ai-gateway.md` | packages/ai-gateway | LLMクライアント抽象化（OpenAI/Anthropic） |
| 12 | `12-pkg-battle-ui-others.md` | packages/battle, packages/ui, packages/tools, packages/vscode-ks-ksc | バトル、UI、ツール、VSCode拡張 |

### Phase 4: ネイティブ・SDL（1文書）

| # | ファイル | 対象 | 内容 |
|---|---------|------|------|
| 13 | `13-pkg-native-engine.md` | packages/native-engine, packages/sdl | Switch/ネイティブエンジン、SDL2ビルド |

### Phase 5: テスト・スクリプト・設定（3文書）

| # | ファイル | 対象 | 内容 |
|---|---------|------|------|
| 14 | `14-tests-e2e.md` | tests/, e2e/, playwright configs | E2Eテスト一覧、パターン分類、fixtures |
| 15 | `15-scripts.md` | scripts/ | 全スクリプト一覧と用途、開発・テスト・デプロイ・バックアップ |
| 16 | `16-config-and-ci.md` | ルート設定、.husky、.github、Dockerfile | CI/CD、pre-push hook、Docker構成、環境変数 |

## 作業順序

Phase 1 → 2 → 3 → 4 → 5 の順に作成。
各Phase内は並列で調査・執筆可能（Agent tool 活用）。

## 各文書の共通フォーマット

```markdown
# {モジュール名}

## 概要
1-2文の説明

## ディレクトリ構成
ツリー表示

## 主要ファイル
| ファイル | 行数 | 役割 |
|---------|------|------|

## 依存関係
- 内部パッケージ
- 外部ライブラリ

## アーキテクチャ / データフロー
図や説明

## 詳細説明
ファイルごと or 機能ごとの説明

## テスト
テストファイルと内容の概要
```

## 見積もり

全16文書。Phase 1-5を順次実行。
