---
title: "6 パッケージ・4 サーバーを 1 リポジトリで管理する Monorepo 運用"
emoji: "📦"
type: "tech"
topics: ["claudecode", "monorepo", "typescript", "開発環境"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」は、1 つのリポジトリ（monorepo）内に 6 つのパッケージと 4 つのサーバーを持っています。この記事では、この monorepo の構成、ローカル開発サーバーの同時起動、パッケージ間の依存関係、そして CLAUDE.md による開発ルールの管理について解説します。

## リポジトリ構成

```
kaedevn-monorepo/
  ├── apps/
  │   ├── editor/        # Vite + React (port 5176)
  │   ├── hono/          # Hono API (port 8080)
  │   └── next/          # Next.js (port 3000)
  ├── packages/
  │   ├── core/          # 共有ロジック (@kaedevn/core)
  │   ├── compiler/      # .ksc コンパイラ (@kaedevn/compiler)
  │   ├── interpreter/   # .ksc インタプリタ (@kaedevn/interpreter)
  │   └── web/           # PixiJS エンジン + Preview (port 5175)
  ├── scripts/
  │   ├── dev-start.sh   # ローカル開発サーバー起動
  │   └── deploy-azure.sh # Azure デプロイ
  ├── CLAUDE.md          # AI 協働ルール
  └── package.json       # npm workspaces
```

### サーバーとポートの割り当て

| サーバー | ポート | ディレクトリ | 役割 |
|---|---|---|---|
| Editor (Vite) | 5176 | `apps/editor` | ノベルエディタ（メイン） |
| Next.js | 3000 | `apps/next` | 認証・プロジェクト管理 |
| Hono API | 8080 | `apps/hono` | バックエンド API |
| Preview (Vite) | 5175 | `packages/web` | ビジュアルノベル再生 |

4 つのサーバーはそれぞれ異なるポートで動きます。エディタ (5176) がメインの開発対象で、API (8080) にリクエストを送り、Next.js (3000) で認証を行い、Preview (5175) でゲームを再生します。

## dev-start.sh -- ローカル開発の起動スクリプト

### 前提条件チェック

スクリプトの冒頭で、必要なツール（node, npm, psql, brew）と環境変数ファイルの存在をチェックしています。前提条件が欠けている場合は、具体的なエラーメッセージで教えてくれます。

### 既存プロセスの停止

4 つのポートを順にチェックし、既にプロセスが動いていれば停止します。「前回の開発サーバーが残っていて起動できない」というよくある問題を自動解決します。

### PostgreSQL 確認

PostgreSQL が停止していれば自動起動し、DB への接続も確認します。

### 選択的起動

```bash
./scripts/dev-start.sh            # API + Next.js（デフォルト）
./scripts/dev-start.sh all        # 全サーバー
./scripts/dev-start.sh api editor # API + エディタのみ
```

`wait` コマンドで全バックグラウンドプロセスの終了を待ちます。Ctrl+C で全サーバーが同時に停止します。

## npm workspaces によるパッケージ管理

### 依存関係

```
apps/editor → @kaedevn/core
apps/hono   → (standalone)
apps/next   → (standalone)
packages/web → @kaedevn/core, @kaedevn/interpreter
packages/compiler → (standalone)
packages/interpreter → (standalone)
```

`@kaedevn/core` は共有ロジックパッケージで、editor と web が依存しています。npm workspaces がローカルパッケージを自動的にリンクするため、`npm install` 一発で依存関係が解決されます。

## CLAUDE.md -- AI 協働のルールブック

Server Configuration、State の配置ルール、デプロイルール、テストルール。これらを CLAUDE.md に集約することで、Claude Code が一貫性のある実装を行えます。

## ワークスペース間の通信

```
[ブラウザ]
  ├─→ Next.js (3000)  ← 認証、プロジェクト一覧
  │     └─→ Hono API (8080)
  ├─→ Editor (5176)   ← エディタ UI
  │     └─→ Hono API (8080)
  └─→ Preview (5175)  ← ゲーム再生
        └─→ Hono API (8080)
```

全てのデータアクセスは Hono API を経由します。Next.js、Editor、Preview はフロントエンドのみで、DB には直接アクセスしません。

## まとめ

| ポイント | 実現方法 |
|---|---|
| ワンコマンドで起動 | `dev-start.sh all` |
| 前提条件の自動解決 | PostgreSQL 自動起動、既存プロセス停止 |
| 選択的起動 | 引数で対象サーバーを指定 |
| パッケージ間依存 | npm workspaces でローカルリンク |
| AI 協働ルール | CLAUDE.md に全ルールを集約 |
| デプロイ自動化 | `deploy-azure.sh` で一括デプロイ |

monorepo は「全てが 1 箇所にある」という圧倒的な利便性がある一方、適切なスクリプトとルールがないと混乱します。dev-start.sh と CLAUDE.md の 2 つがこの monorepo の「背骨」です。

---

6 パッケージ・4 サーバーと聞くと複雑に感じますが、実際の日常は `./scripts/dev-start.sh all` の一発起動で済みます。「複雑さは内部に押し込み、インターフェースはシンプルに」という設計原則は、monorepo の運用スクリプトにも当てはまります。

　　　　　　　　　　Claude Opus 4.6
