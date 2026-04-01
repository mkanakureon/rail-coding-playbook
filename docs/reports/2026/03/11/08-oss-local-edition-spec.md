# kaedevn OSS ローカルエディション — 仕様書

> 2026-03-11 作成。開発者と Claude Code の対話で確定した OSS 公開方針。

---

## 1. コンセプト

**「自分の PC で動くビジュアルノベル制作ツール」** を OSS として公開する。

- 認証なし — ローカルで動かすので、ログイン/登録/ゲスト機能は不要
- Azure なし — クラウドサービスへの依存ゼロ
- プラットフォーム機能なし — 作品一覧・LP・ランディングページは含めない

ユーザー体験: `npm install` → DB セットアップ → サーバー起動 → ブラウザでエディタを開く → 作る → プレビュー → 遊ぶ

---

## 2. 公開範囲

### 含めるもの（OSS）

| コンポーネント | ディレクトリ | 役割 |
|---|---|---|
| エディタ | `apps/editor` | ブロック編集・テキスト編集 |
| プレビュー | `packages/web` | 作った作品を再生 |
| プレイ画面 | `packages/web` | 完成した作品を遊ぶ |
| ローカル API | `apps/hono-local`（新規） | プロジェクト保存・アセット管理（SQLite + ファイルシステム） |
| コア型定義 | `packages/core` | 共通型・インターフェース |
| KS コンパイラ | `packages/compiler` | Kaede Script (.ks) コンパイラ |
| KSC コンパイラ | `packages/ksc-compiler` | Kaede Script Code (.ksc) コンパイラ |
| インタープリタ | `packages/interpreter` | KNF インタープリタ（既に OSS 公開済み） |
| バトルエンジン | `packages/battle` | ターン制コマンドバトル |

### 含めないもの（Private のまま）

| コンポーネント | 理由 |
|---|---|
| `apps/next` | プラットフォーム LP・作品一覧・About・ドキュメント・開発日誌 |
| `apps/hono`（クラウド版） | Azure Blob・PostgreSQL 直結・認証ミドルウェア・レート制限 |
| `packages/native-engine` | Switch/iOS/Android ネイティブエンジン |
| `packages/ai-gateway` | LLM API キー・プロンプト |
| `docs/landing/` | ランディングページ用マークダウン |
| `.github/workflows/` | Azure デプロイ用 GitHub Actions |

---

## 3. 認証の扱い

**認証を完全に除去する。** ローカル版は「常にログイン済みの単一ユーザー」として動作する。

### 現行（クラウド版）

```
リクエスト → 認証ミドルウェア → トークン検証 → ユーザー特定 → API 処理
```

### OSS 版

```
リクエスト → API 処理（固定ユーザー）
```

### 実装方針

- `hono-local` では認証ミドルウェアを使わない
- すべてのリクエストを固定のローカルユーザー（`local-user`）として処理
- エディタ側の `localStorage` トークン注入も不要

---

## 4. `hono-local` — ローカル専用 API

クラウド版 `apps/hono` の代替。Azure・PostgreSQL・認証への依存をすべて排除する。

### ストレージ

| クラウド版 | OSS 版 |
|---|---|
| PostgreSQL (Prisma) | SQLite（ファイルベース） |
| Azure Blob Storage | ローカルファイルシステム |
| 環境変数に Azure 接続文字列 | DB ファイルパスのみ |

### 必要な API エンドポイント

| メソッド | パス | 機能 |
|---|---|---|
| GET | `/api/projects` | プロジェクト一覧 |
| POST | `/api/projects` | プロジェクト作成 |
| GET | `/api/projects/:id` | プロジェクト取得 |
| PUT | `/api/projects/:id` | プロジェクト保存 |
| DELETE | `/api/projects/:id` | プロジェクト削除 |
| POST | `/api/assets/upload` | アセットアップロード |
| GET | `/api/assets/:id` | アセット取得 |
| DELETE | `/api/assets/:id` | アセット削除 |
| GET | `/api/official-assets` | 公式アセット一覧 |
| POST | `/api/official-assets/use` | 公式アセットインポート |
| GET | `/api/preview/:id` | プレビュー用コンパイル |
| GET | `/api/editor-schema` | ブロック型スキーマ |

### 不要な API エンドポイント

- `/api/auth/*` — 認証系すべて
- `/api/admin/*` — 管理画面系すべて
- `/api/works/*` — 作品公開・いいね・閲覧数
- `/api/users/*` — ユーザープロフィール

---

## 5. 環境変数

OSS 版で必要な環境変数は最小限。

```env
# .env.example
PORT=8080
DATABASE_PATH=./data/kaedevn.db
ASSETS_DIR=./data/assets
```

クラウド版の環境変数（Azure 接続文字列、JWT シークレット、LLM API キーなど）は一切不要。

---

## 6. セットアップ手順（想定）

```bash
# 1. クローン
git clone https://github.com/mkanakureon/kaedevn-studio.git
cd kaedevn-studio

# 2. 依存インストール
npm install

# 3. DB 初期化（SQLite）
npm run db:init

# 4. 起動
npm run dev

# 5. ブラウザで開く
# エディタ: http://localhost:5176
# プレビュー: http://localhost:5175
```

---

## 7. ビルド依存グラフ

```
packages/core          ← 依存なし
packages/interpreter   ← 依存なし
packages/ksc-compiler  ← 依存なし
packages/battle        ← 依存なし
packages/compiler      ← core
packages/web           ← core, compiler, ksc-compiler, battle, interpreter
apps/editor            ← web, core, compiler, ksc-compiler, battle, interpreter
apps/hono-local        ← core, compiler, ksc-compiler
```

ビルド順序: `core` → `compiler`, `ksc-compiler`, `interpreter`, `battle`（並列可） → `web` → `editor`

---

## 8. クラウド版との差分管理

### 方針: 別リポジトリ + 手動同期

- 開発は `kaedevn-monorepo`（Private）で一元的に行う
- OSS 対象パッケージを `kaedevn-studio`（Public）に同期
- `hono-local` は OSS リポジトリにのみ存在（クラウド版 monorepo には含めない）

### 同期対象

```
kaedevn-monorepo (Private)         kaedevn-studio (Public)
├── packages/core/            →    ├── packages/core/
├── packages/compiler/        →    ├── packages/compiler/
├── packages/ksc-compiler/    →    ├── packages/ksc-compiler/
├── packages/interpreter/     →    ├── packages/interpreter/
├── packages/battle/          →    ├── packages/battle/
├── packages/web/             →    ├── packages/web/
├── apps/editor/              →    ├── apps/editor/
│                                  ├── apps/hono-local/  ← OSS専用
├── apps/hono/                ✗    （同期しない）
├── apps/next/                ✗    （同期しない）
├── packages/native-engine/   ✗    （同期しない）
├── packages/ai-gateway/      ✗    （同期しない）
```

---

## 9. 前提条件（未着手タスク）

| 優先度 | タスク | 概要 |
|---|---|---|
| **高** | `hono-local` 作成 | SQLite + ファイルシステムベースの API サーバー |
| **高** | エディタの認証依存除去 | `localStorage` トークン参照を条件分岐またはアダプター化 |
| **中** | `db:init` スクリプト | SQLite 初期化 + 公式アセットの初期データ投入 |
| **中** | README / CONTRIBUTING.md | セットアップ手順・コントリビューションガイド |
| **低** | 同期スクリプト更新 | `sync-oss.sh` を新しい公開範囲に対応 |
| **低** | CI（GitHub Actions） | OSS リポジトリ用の typecheck + test ワークフロー |

---

## 10. 関連文書

| 文書 | 内容 |
|---|---|
| `docs/09_reports/2026/03/11/02-oss-review-summary.md` | 過去の OSS 議論と現状まとめ |
| `docs/09_reports/2026/02/24/01-oss-release-plan.md` | 初期の OSS リリース計画 |
| `docs/10_ai_docs/2026/03/02/12-OSS_FOLDER_STRUCTURE_DEFINITION.md` | ディレクトリ構造定義 |
| `docs/10_ai_docs/2026/03/02/34-OSS_STRUCTURAL_ISSUES_REPORT.md` | 構造的課題レポート |
