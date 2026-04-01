# ローカル開発 起動手順書

## 前提条件

- Node.js v25+ / npm 11+
- Homebrew (`postgresql@16` インストール済み)
- Git

## サーバー構成

| サーバー | ポート | ディレクトリ | 役割 |
|---------|--------|-------------|------|
| PostgreSQL | 5432 | Homebrew サービス | データベース |
| Hono API | 8080 | `apps/hono` | バックエンド API |
| Next.js | 3000 | `apps/next` | フロントエンド (認証・管理・公開ページ) |
| Editor (Vite) | 5176 | `apps/editor` | エディタ |
| Preview (Vite) | 5175 | `packages/web` | ビジュアルノベルエンジン |

## 起動手順

### 1. PostgreSQL 起動確認

```bash
# 状態確認
brew services list | grep post

# 起動していない場合
brew services start postgresql@16

# 接続確認
psql -h localhost -U kaedevn -d kaedevn_dev -c "SELECT 1;"
```

> Docker は不要。Homebrew の `postgresql@16` を使用。

### 2. 依存関係インストール

```bash
cd ~/Documents/git/mono/kaedevn-monorepo
npm install
```

### 3. API サーバー起動 (port 8080)

```bash
npm run dev -w apps/hono
```

起動確認:
```bash
curl http://localhost:8080/
# → {"name":"@kaedevn/hono","version":"0.1.0","message":"kaedevn API Server"}
```

### 4. Next.js 起動 (port 3000)

```bash
npm run dev -w apps/next
```

起動確認: ブラウザで http://localhost:3000/ を開く

### 5. Editor 起動 (port 5176) ※必要な場合

```bash
npm run dev -w apps/editor
```

### 6. Preview エンジン起動 (port 5175) ※必要な場合

```bash
npm run dev -w @kaedevn/web
```

## ログインアカウント

### Admin
| 項目 | 値 |
|-----|-----|
| Email | `mynew@test.com` |
| Password | `DevPass123!` |
| Role | admin |

### 一般ユーザー
| 項目 | 値 |
|-----|-----|
| Email | `test1@example.com` |
| Password | `DevPass123!` |
| Role | user |

## データベース接続情報

| 項目 | 値 |
|-----|-----|
| Host | localhost |
| Port | 5432 |
| DB | kaedevn_dev |
| User | kaedevn |
| Password | <YOUR_DB_PASSWORD> |

```bash
# psql で直接接続
psql "postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev"

# Prisma Studio (GUI)
cd apps/hono && npx prisma studio
```

## 環境変数ファイル

| ファイル | 内容 |
|---------|------|
| `apps/hono/.env` | DATABASE_URL, PORT, Azure 接続情報 |
| `apps/next/.env.local` | NEXT_PUBLIC_API_URL=http://localhost:8080 |

## トラブルシューティング

### Next.js で Internal Server Error / Cannot find module

`.next` キャッシュの破損。削除して再起動:

```bash
rm -rf apps/next/.next
npm run dev -w apps/next
```

### ポートが既に使用中

```bash
# 使用中のプロセス確認
lsof -i :3000 -P | grep LISTEN
lsof -i :8080 -P | grep LISTEN

# プロセス停止
kill <PID>
```

### PostgreSQL に接続できない

```bash
# サービス状態確認
brew services list | grep post

# 再起動
brew services restart postgresql@16
```

### ログインできない

1. API サーバー (8080) が起動しているか確認
2. DB に接続できるか確認
3. パスワードリセット:
```bash
node -e "const b=require('$PWD/node_modules/bcrypt');console.log(b.hashSync('DevPass123!',10))"
# 出力されたハッシュで更新
psql "postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev" \
  -c "UPDATE users SET password_hash='<hash>' WHERE email='mynew@test.com';"
```

## テスト実行

```bash
# Next.js ユニットテスト (Vitest)
cd apps/next && npx vitest run

# API テスト
cd apps/hono && npx vitest run

# ビルド確認
npm run build -w apps/next
```
