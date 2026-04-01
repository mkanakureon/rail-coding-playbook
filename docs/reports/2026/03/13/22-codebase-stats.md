# kaedevn-monorepo コードベース統計

**集計日**: 2026-03-13
**対象**: git 管理下のファイルのみ（node_modules・.d.ts 除外、ライブラリ含まず）

## サマリー

| 種別 | 行数 | ファイル数 |
|------|-----:|----------:|
| TS/JS | 129,287 | 726 |
| Markdown | 255,048 | 1,464 |
| **合計** | **384,335** | **2,190** |

その他: JSON 268 files, Shell 50 files, 全追跡ファイル 4,629 files

---

## TS/JS 内訳

### apps（46,500 行）

| ディレクトリ | 行数 | 役割 |
|-------------|-----:|------|
| apps/hono | 19,117 | Backend API (Hono) |
| apps/editor | 15,088 | ビジュアルノベルエディタ (Vite + React) |
| apps/next | 11,048 | 認証・プロジェクト管理 (Next.js) |
| apps/ksc-editor | 1,247 | KSC スクリプトエディタ |

### packages（42,001 行）

| パッケージ | 行数 | 役割 |
|-----------|-----:|------|
| packages/web | 13,060 | ビジュアルノベルエンジン (PixiJS) |
| packages/interpreter | 8,142 | KSC インタプリタ |
| packages/ksc-compiler | 7,467 | KSC コンパイラ |
| packages/core | 5,605 | 共通型定義・抽象インターフェース |
| packages/compiler | 3,781 | KS コンパイラ |
| packages/ai-gateway | 1,404 | LLM クライアント抽象化 |
| packages/battle | 836 | バトルシステム |
| packages/map | 623 | マップシステム |
| packages/ui | 583 | UI コンポーネント |
| packages/tools | 500 | ツールライブラリ |

### scripts（19,393 行）

CLI ツール、デバッグスクリプト、デプロイ・テスト自動化。

今回追加分（2026-03-13）:

| CLI | 行数 | 用途 |
|-----|-----:|------|
| test-blocks.mjs | 656 | ブロック構造検証 |
| character-cli.mjs | 385 | キャラクタークラス CRUD |
| import-story.mjs | 364 | テキスト台本→ブロック変換 |
| init-project.mjs | 307 | 設定JSONからプロジェクト生成 |
| test-project.mjs | 245 | 全プロジェクト一括検証 |
| **小計** | **1,957** | |

### tests（19,307 行）

Playwright E2E テスト、Azure 検証テスト。

---

## Markdown 内訳

| ディレクトリ | 行数 | 内容 |
|-------------|-----:|------|
| docs/ | 201,195 | 仕様書・設計書・レポート |
| packages/ | 29,153 | パッケージドキュメント |
| .agents/ | 14,395 | Gemini CLI スキル定義 |
| .claude/ | 2,627 | Claude Code スキル定義 |
| apps/ | 752 | アプリ固有ドキュメント |
| (root) | 495 | CLAUDE.md, README 等 |
| scripts/ | 379 | スクリプト説明 |
| .gemini/ | 298 | Gemini 設定 |
| tests/ | 156 | テスト説明 |
