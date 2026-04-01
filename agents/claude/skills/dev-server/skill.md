---
description: Use when the user asks to start local dev servers. Triggers on "サーバー起動", "dev-server", "開発サーバー", "起動して".
---

# ローカル開発サーバー起動

ローカル開発環境のサーバーを起動する。

## ルール

- **必ず `./scripts/dev-start.sh` を使う**
- 手動で `npm run dev -w ...` を個別実行しない
- スクリプトが既存プロセス停止 → PostgreSQL確認 → npm install → 起動を自動で行う

## コマンド

```bash
# デフォルト（API + Next.js）
./scripts/dev-start.sh

# 全サーバー
./scripts/dev-start.sh all

# 特定のみ（スペース区切り）
./scripts/dev-start.sh api next editor preview
```

## ターゲット名マッピング

| ユーザーの表現 | ターゲット |
|---|---|
| `api` / `API` / `バックエンド` / `hono` / `サーバー` | `api` |
| `next` / `nextjs` / `フロント` / `認証` / `管理画面` | `next` |
| `editor` / `エディタ` / `エディター` | `editor` |
| `preview` / `プレビュー` / `web` / `ゲーム` / `ksc-demo` | `preview` |
| `全部` / `all` / `全て` | `all` |
| 指定なし / `サーバー起動して` / `開発サーバー` | 引数なし（api + next） |

### 組み合わせ例

| 指示 | コマンド |
|---|---|
| "サーバー起動して" | `./scripts/dev-start.sh` |
| "全部起動して" | `./scripts/dev-start.sh all` |
| "エディタだけ起動" | `./scripts/dev-start.sh editor` |
| "APIとエディタ起動" | `./scripts/dev-start.sh api editor` |
| "プレビューも含めて全部" | `./scripts/dev-start.sh all` |

## サーバー一覧

| ターゲット | ポート | ディレクトリ | URL |
|---|---|---|---|
| `api` | 8080 | `apps/hono` | `http://localhost:8080` |
| `next` | 3000 | `apps/next` | `http://localhost:3000` |
| `editor` | 5176 | `apps/editor` | `http://localhost:5176` |
| `preview` | 5175 | `packages/web` | `http://localhost:5175` |

## 注意

- スクリプトはフォアグラウンドで動作する（`wait` で全プロセスを待つ）
- `Ctrl+C` で全サーバー停止
- PostgreSQL が起動していなければ自動で `brew services start postgresql@16` する
- 使用中のポートは自動で停止してから起動する
