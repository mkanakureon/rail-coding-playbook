# モノレポ全体構造

## 概要

kaedevn-monorepo は、Nintendo Switch（主）と Web（副）を対象としたクロスプラットフォーム・ビジュアルノベルエンジンのモノレポ。エディタ、API、プレビュー、コンパイラ、ネイティブエンジンなど 16 以上のパッケージで構成される。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19, Vite 7, Tailwind CSS, Zustand 5 |
| バックエンド | Hono 4, Prisma 5, PostgreSQL |
| レンダリング | PixiJS (Web), SDL2/OpenGL (Native) |
| スクリプト | .ks (TyranoScript風), .ksc (TypeScript風) |
| AI | OpenAI, Anthropic, Google Vertex AI |
| インフラ | Azure Container Apps, Static Web Apps, Blob Storage |
| CI/CD | GitHub Actions (deploy.yml, deploy-swa.yml, ci.yml) |
| テスト | Vitest (unit), Playwright (E2E) |

## ディレクトリ構成

```
kaedevn-monorepo/
├── apps/
│   ├── editor/          # メインエディタ SPA (Vite + React, :5176)
│   ├── hono/            # バックエンド API (Hono, :8080)
│   ├── next/            # 認証・管理画面 (Next.js, :3000)
│   └── ksc-editor/      # KSC スクリプトエディタ (Vite + React + Monaco, :5177)
├── packages/
│   ├── core/            # 共有型定義・Op 型・Timeline 型
│   ├── compiler/        # .ks → Op[] コンパイラ
│   ├── ksc-compiler/    # .ksc コンパイラ + VM
│   ├── web/             # PixiJS WebGL エンジン・プレビュー (:5175)
│   ├── interpreter/     # スクリプトインタプリタ
│   ├── ai-gateway/      # LLM クライアント抽象化
│   ├── battle/          # コマンドバトルシステム
│   ├── ui/              # 共有 React UI コンポーネント
│   ├── tools/           # アセット処理 CLI ツール
│   ├── native-engine/   # C++ ネイティブエンジン (Switch/Android)
│   ├── sdl/             # SDL2 ライブラリ
│   └── vscode-ks-ksc/   # VSCode 拡張（.ks/.ksc 構文ハイライト）
├── tests/               # Playwright E2E テスト (48 ファイル)
├── e2e/                 # KSC デモ E2E テスト
├── scripts/             # 開発・テスト・デプロイスクリプト (39 ファイル)
├── projects/            # コンテンツデータ（対象外）
├── docs/                # ドキュメント
├── .github/workflows/   # CI/CD (7 ワークフロー)
├── .husky/              # Git hooks (pre-push, pre-commit)
└── package.json         # ワークスペース定義
```

## パッケージ依存関係

```
core ← compiler ← web
core ← ksc-compiler ← web
core ← interpreter
core ← battle ← web
ai-gateway ← hono (API)

apps/editor → core (型のみ)
apps/hono → core, ai-gateway
apps/next → (独立)
apps/ksc-editor → (独立)

packages/web → core, compiler, ksc-compiler, battle
```

### 依存方向の原則

- `core` は他パッケージに依存しない（基盤層）
- `compiler`, `ksc-compiler`, `interpreter`, `battle` は `core` のみに依存
- `web` はすべてのランタイムパッケージに依存（統合層）
- `ai-gateway` は独立（外部 LLM API のみ）
- アプリ層（apps/）はパッケージ層に依存するが、パッケージ層はアプリ層に依存しない

## サーバー構成

| サーバー | ポート | ディレクトリ | 役割 |
|---------|-------|------------|------|
| Hono API | 8080 | apps/hono | REST API、認証、DB |
| Next.js | 3000 | apps/next | 認証画面、管理画面、マイページ |
| Editor | 5176 | apps/editor | ビジュアルノベルエディタ SPA |
| KSC Editor | 5177 | apps/ksc-editor | KSC スクリプトエディタ |
| Preview | 5175 | packages/web | PixiJS プレビューエンジン |

## データフロー

```
[Editor SPA]  →  PUT /api/projects/:id  →  [Hono API]  →  [PostgreSQL]
     ↓                                          ↓
[buildPreviewScript()]              GET /api/preview/:id
     ↓                                          ↓
[Preview Engine]  ←  KSC Script  ←  [generateKSCScript()]
     ↓
[PixiJS / WebGL Rendering]
```

### スクリプト処理パイプライン

```
エディタブロック → .ks スクリプト → Compiler → Op[] → OpRunner → WebOpHandler → PixiJS
                    or
エディタブロック → .ksc スクリプト → KSC Compiler → IR → VM → HostAPI → WebOpHandler → PixiJS
```

## コア抽象化インターフェース

Switch 移植を見据え、以下のインターフェースを通じてプラットフォーム差異を吸収する。

| インターフェース | 役割 | Web 実装 |
|----------------|------|----------|
| `IInput` | 入力アクション dispatch | PixiJS pointer/keyboard |
| `IAudio` | BGM/SE/VOICE 再生 | Web Audio API |
| `IStorage` | セーブ/ロード | IndexedDB |
| `IOpHandler` | Op 命令実行 | WebOpHandler (PixiJS) |

## デプロイ構成

| コンポーネント | Azure サービス | デプロイ方法 |
|--------------|---------------|-------------|
| API (Hono) | Container Apps | GitHub Actions → ACR → Container Apps |
| Next.js | Container Apps | GitHub Actions → ACR → Container Apps |
| Editor | Static Web Apps | GitHub Actions → SWA deploy |
| Preview | Static Web Apps | GitHub Actions → SWA deploy |
| DB | PostgreSQL Flexible Server | マネージド |
| Assets | Blob Storage | API 経由アップロード |

## ファイル規模

| カテゴリ | ファイル数（概算） | 総行数（概算） |
|---------|-------------------|---------------|
| apps/editor | 105 | 13,500 |
| apps/hono | 136 (src: 74, test: 46) | 16,000 |
| apps/next | 78 | 8,000 |
| apps/ksc-editor | 20 | 800 |
| packages/web | 109 | 12,000 |
| packages/core | 37 | 3,000 |
| packages/compiler | 36 | 4,000 |
| packages/ksc-compiler | 24 | 3,000 |
| packages/interpreter | 36 | 3,000 |
| packages/ai-gateway | 18 | 1,000 |
| packages/battle | 16 | 1,500 |
| packages/native-engine | 75 | 2,000 |
| tests/ (E2E) | 48 | 9,500 |
| scripts/ | 39 | 3,000 |
| **合計** | **~780** | **~80,000** |
