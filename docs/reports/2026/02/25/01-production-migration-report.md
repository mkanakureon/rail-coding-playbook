# 本番 DB マイグレーション対応レポート (2026-02-25)

## 症状

マイページ → プロジェクトタップで 500 エラー。

```
The column `assets.slug` does not exist in the current database.
```

`GET /api/projects/:id` 内の `prisma.asset.findMany()` が、Prisma schema に定義されているが本番 DB に存在しないカラム（`slug` 等）を SELECT しようとして失敗。

## 原因

Prisma schema にカラム・テーブルを追加した際、`prisma migrate dev` でマイグレーションファイルを作成せず、ローカルでは `prisma db push` で直接同期していた。本番 DB にはマイグレーションが一切適用されておらず、`_prisma_migrations` テーブルも存在しない状態だった。

## 本番 DB との差分（適用前）

### assets テーブル
- `slug`, `category`, `metadata`, `source_type`, `subcategory` カラム不足
- `kind` の型変更（VARCHAR(30) に拡張）
- インデックス 3 件不足

### official_assets テーブル
- `description`, `display_name`, `download_count`, `is_free`, `sort_order`, `subcategory`, `thumbnail_path` カラム不足
- インデックス 1 件不足

### 新規テーブル
- `user_assets`, `user_characters`, `user_expressions` — テーブル自体が未作成

## 対応手順

### 1. ファイアウォール一時開放

ローカルから Azure PostgreSQL に接続するため、一時的に IP を許可。

```bash
MY_IP=$(curl -s4 ifconfig.me)
az postgres flexible-server firewall-rule create \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name allow-claude-migrate \
  --start-ip-address $MY_IP --end-ip-address $MY_IP
```

### 2. マイグレーション状態の確認

```bash
DATABASE_URL="<本番DB接続文字列>" npx prisma migrate status
```

結果: 9 件全てが「未適用」。ただし DB にはテーブルが存在する（`prisma db push` で作られていた）。

### 3. 既存マイグレーションを「適用済み」にマーク

テーブルは既に存在するので、SQL を実行せずにマーク。

```bash
for m in 20260216145622_init 20260217051211_add_asset_model ...; do
  DATABASE_URL="<本番DB接続文字列>" npx prisma migrate resolve --applied "$m"
done
```

9 件全てマーク完了。

### 4. schema と DB の差分を SQL で生成

```bash
DATABASE_URL="<本番DB接続文字列>" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

ALTER TABLE + CREATE TABLE + CREATE INDEX + ADD FOREIGN KEY の SQL が出力された。

### 5. マイグレーションファイル作成・適用

SQL を `prisma/migrations/20260225_add_missing_columns/migration.sql` に保存。

```bash
DATABASE_URL="<本番DB接続文字列>" npx prisma migrate deploy
```

結果: `20260225_add_missing_columns` が正常に適用された。

### 6. 動作確認

```bash
# プロジェクト詳細 API テスト
node -e "fetch('https://ca-api..../api/projects/<id>', {headers:{...}}).then(...);"
# → 正常にレスポンスが返る
```

### 7. ファイアウォール削除

```bash
az postgres flexible-server firewall-rule delete \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name allow-claude-migrate --yes
```

## 失敗した場合の対処

### prisma migrate deploy が失敗する場合

SQL が一部適用された中途半端な状態になる可能性がある。

```bash
# 状態確認
DATABASE_URL="..." npx prisma migrate status

# 失敗したマイグレーションをロールバック（手動 SQL）
DATABASE_URL="..." psql -c "ALTER TABLE assets DROP COLUMN IF EXISTS slug;"

# マイグレーションを未適用に戻す
DATABASE_URL="..." npx prisma migrate resolve --rolled-back 20260225_add_missing_columns
```

### カラムが既に存在するエラー

`prisma db push` で一部カラムが追加済みの場合:

```sql
-- エラー例: column "slug" of relation "assets" already exists
-- → SQL から該当行を削除して再適用
-- または手動で resolve --applied にマーク
```

### テーブルが既に存在するエラー

```sql
-- CREATE TABLE の前に DROP IF EXISTS を追加（データが空の場合のみ）
-- またはマイグレーション SQL から CREATE TABLE を削除
```

## 再発防止

### やるべきこと

1. schema 変更後は必ず `npx prisma migrate dev --name <名前>` でマイグレーションファイルを作成
2. `prisma db push` はプロトタイピング時のみ使う。本番運用開始後は `migrate` に切り替え
3. deploy 前に `apps/hono/test/schema-sync.test.ts` を実行して schema 整合性を確認

### テスト

```bash
cd apps/hono
npx vitest run test/schema-sync.test.ts
```

このテストは DB に接続して全テーブルの `findFirst()` を実行する。カラム不足があれば即エラーになる。

### deploy 前チェックリスト

- [ ] `npx prisma migrate status` でマイグレーション状態確認
- [ ] `npx vitest run test/schema-sync.test.ts` で schema 整合性テスト
- [ ] `npm run build` で全パッケージのビルド確認
- [ ] `./scripts/deploy-azure.sh` でデプロイ

## ファイル一覧

| ファイル | 役割 |
|---|---|
| `prisma/migrations/20260225_add_missing_columns/migration.sql` | 今回のマイグレーション SQL |
| `test/schema-sync.test.ts` | DB カラム存在チェックテスト |
| `prisma/schema.prisma` | Prisma schema（正のソース） |
