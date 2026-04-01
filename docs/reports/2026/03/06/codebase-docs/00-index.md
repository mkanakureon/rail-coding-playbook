# ソースコード説明書 — 目次

作成日: 2026-03-06

## 対象

kaedevn-monorepo の全ソースコード（projects/ 内のコンテンツデータは除く）。

## 文書一覧

| # | ファイル | 対象 | 概要 |
|---|---------|------|------|
| 01 | [01-architecture-overview.md](01-architecture-overview.md) | モノレポ全体 | 全体構造、パッケージ依存関係、技術スタック、サーバー構成、データフロー |
| 02 | [02-app-editor.md](02-app-editor.md) | apps/editor | エディタ SPA。14ブロック型、Zustand ストア、59コンポーネント、自動保存、undo/redo |
| 03 | [03-app-hono-api.md](03-app-hono-api.md) | apps/hono | Hono API。20ルートファイル、22 DB モデル、ミドルウェア、AI 執筆支援、43テスト |
| 04 | [04-app-next.md](04-app-next.md) | apps/next | Next.js。認証フロー、管理画面、マイページ、作品一覧 |
| 05 | [05-app-ksc-editor.md](05-app-ksc-editor.md) | apps/ksc-editor | KSC エディタ。Monaco Editor、構文ハイライト、リアルタイム診断 |
| 06 | [06-pkg-core.md](06-pkg-core.md) | packages/core | 共有型定義。Op 命令型、Timeline 型、IInput/IAudio/IStorage インターフェース |
| 07 | [07-pkg-compiler.md](07-pkg-compiler.md) | packages/compiler | .ks コンパイラ。Tokenizer → Parser → Finalizer、コマンドレジストリ |
| 08 | [08-pkg-ksc-compiler.md](08-pkg-ksc-compiler.md) | packages/ksc-compiler | KSC コンパイラ + VM。型チェック、IR 生成、スタックベース VM |
| 09 | [09-pkg-web-engine.md](09-pkg-web-engine.md) | packages/web | PixiJS エンジン。WebOpHandler、15種フィルター、ゲームシステム |
| 10 | [10-pkg-interpreter.md](10-pkg-interpreter.md) | packages/interpreter | インタプリタ。デバッグモード、Levenshtein エラー候補、107テスト |
| 11 | [11-pkg-ai-gateway.md](11-pkg-ai-gateway.md) | packages/ai-gateway | LLM 抽象化。OpenAI/Anthropic/Google 対応、埋め込みクライアント |
| 12 | [12-pkg-battle-ui-others.md](12-pkg-battle-ui-others.md) | packages/battle, ui, tools, vscode-ks-ksc | バトルシステム、UI ライブラリ、アセットツール、VSCode 拡張 |
| 13 | [13-pkg-native-engine.md](13-pkg-native-engine.md) | packages/native-engine, sdl | C++ ネイティブエンジン。SDL2、Switch/Android 対応 |
| 14 | [14-tests-e2e.md](14-tests-e2e.md) | tests/, e2e/ | E2E テスト。48ファイル、Playwright、ローカル/Azure 両対応 |
| 15 | [15-scripts.md](15-scripts.md) | scripts/ | 全39スクリプト。開発、テスト、デプロイ、バックアップ、AI |
| 16 | [16-config-and-ci.md](16-config-and-ci.md) | 設定・CI/CD | GitHub Actions、Docker、Husky hooks、環境変数 |

## 規模

| カテゴリ | ファイル数 | 総行数 |
|---------|-----------|--------|
| apps/ (4アプリ) | ~340 | ~38,000 |
| packages/ (12パッケージ) | ~290 | ~30,000 |
| tests/ + e2e/ | ~50 | ~14,000 |
| scripts/ | ~40 | ~3,000 |
| **合計** | **~780** | **~80,000** |
