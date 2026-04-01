# バックアップ運用ガイド

作成日: 2026-02-19

## 概要

kaedevn の PostgreSQL データベースバックアップは **2層構成** で運用する。

| 層 | 方式 | 頻度 | 保持 | 復元方法 |
|----|------|------|------|----------|
| 1. Azure 自動バックアップ | Azure PostgreSQL Flexible Server 組み込み | 毎日自動 | 7日間 | Azure Portal / az CLI |
| 2. 手動ダンプ (pg_dump) | `backup-dump.sh` → Azure Blob Storage | 週1回推奨 | 7日間(自動削除) | `backup-restore-test.sh` |

## スクリプト一覧

| スクリプト | 用途 | 実行頻度 |
|-----------|------|----------|
| `scripts/backup-setup.sh` | 初期設定（保持期間確認、Blobコンテナ作成） | 初回1回 |
| `scripts/backup-dump.sh` | pg_dump → gzip → Blob Storage アップロード | 週1回 |
| `scripts/backup-restore-test.sh` | 一時DBに復元して検証 | 月1回推奨 |
| `scripts/backup-status.sh` | 現在の状態を一覧表示 (CLI) | 随時 |
| `scripts/backup-daily-check.sh` | 日次チェック + メール通知 | 毎日 (cron) |

## 日次チェック + メール通知

### 仕組み

```
cron (毎朝9時)
  → backup-daily-check.sh
    → POST /api/auth/login (JWT取得)
    → POST /api/admin/backups/notify
      → db-backups コンテナの blob 一覧取得
      → ステータス判定 (OK / WARNING)
      → HTML レポートをメール送信
```

### ステータス判定

| ステータス | 条件 |
|-----------|------|
| **OK** | blob 取得成功 かつ 最終ダンプが48時間以内 |
| **WARNING** | blob 取得失敗、ダンプなし、または48時間超過 |

### 環境変数

| 変数 | 設定場所 | 説明 |
|------|----------|------|
| `ADMIN_EMAIL` | `apps/hono/.env` | 通知メール送信先 |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | `apps/hono/.env` | Azure メール送信用 (未設定時はコンソール出力) |
| `AZURE_STORAGE_CONNECTION_STRING` | `apps/hono/.env` | Blob Storage 接続 |

### cron 設定

```bash
# 本番環境 (Azure Container Apps のAPIエンドポイント)
0 9 * * * API_URL=https://<api-hostname> LOGIN_EMAIL=mynew@test.com LOGIN_PASSWORD=<password> /path/to/scripts/backup-daily-check.sh

# ローカル開発
0 9 * * * /path/to/scripts/backup-daily-check.sh
```

ログ出力先: `/tmp/backup-daily-check.log`

## 管理画面

**URL:** `/admin/backups`（サイドバー「バックアップ」）

### 表示内容

- **サマリーカード**: ダンプ数、最終バックアップ日時、最古のダンプ日時
- **Azure 自動バックアップ設定**: 保持期間、geo冗長
- **ダンプ一覧テーブル**: ファイル名、サイズ、日時
- **ヘルスチェックリスト** (4項目):
  1. pg_dump ダンプファイルが存在する
  2. 最終バックアップが48時間以内
  3. Azure 自動バックアップ保持期間が設定済み
  4. ダンプファイルのサイズが0でない
- **メール通知テストボタン**: 管理画面からワンクリックで通知テスト可能

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/admin/backups` | ダンプ一覧 + サマリー + 自動バックアップ設定 |
| POST | `/api/admin/backups/notify` | バックアップレポートをメール送信 |

認証: `authMiddleware` + `adminMiddleware` (JWT + admin ロール)

### GET /api/admin/backups レスポンス

```json
{
  "dumps": [
    { "name": "appdb_20260219_090000.sql.gz", "size": 524288, "lastModified": "2026-02-19T09:00:00.000Z" }
  ],
  "autoBackup": { "retentionDays": 7, "geoRedundant": false },
  "summary": { "totalDumps": 1, "lastDumpDate": "2026-02-19T09:00:00.000Z", "oldestDumpDate": "2026-02-19T09:00:00.000Z" }
}
```

### POST /api/admin/backups/notify レスポンス

```json
{
  "message": "バックアップレポートを送信しました",
  "status": "OK",
  "sentTo": "admin@example.com"
}
```

## Azure リソース

| リソース | 名前 | 用途 |
|---------|------|------|
| PostgreSQL Flexible Server | `pgnextacamin` | 本番DB (自動バックアップ元) |
| Storage Account | `kaedevnworks` | ダンプ保存先 |
| Blob Container | `db-backups` | pg_dump ファイル格納 |
| Communication Services | `kaedevn-comm` | メール送信 |
| Resource Group | `rg-next-aca-min` | 全リソースの所属 |

## 障害発生時の復旧手順

### ケース1: 直近のデータ復旧 (Azure 自動バックアップ)

```bash
# 復元可能な日時を確認
az postgres flexible-server show \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --query "backup.earliestRestoreDate"

# ポイントインタイムリストア（新サーバーに復元）
az postgres flexible-server restore \
  --resource-group rg-next-aca-min \
  --name pgnextacamin-restored \
  --source-server pgnextacamin \
  --restore-time "2026-02-19T08:00:00Z"
```

復元目安: 5〜30分（データ量による）

### ケース2: 手動ダンプからの復旧

```bash
# 1. 最新ダンプの確認
./scripts/backup-status.sh

# 2. 復元テスト（一時DBに復元して確認）
./scripts/backup-restore-test.sh

# 3. 本番DBへの復元（要確認！）
# 最新ダンプをダウンロードし、本番DBにリストア
```

## 定期チェック表

| 頻度 | 作業 | 方法 |
|------|------|------|
| 毎日 | バックアップ状態確認 | 日次メール通知 (自動) |
| 毎日 | 管理画面でヘルスチェック確認 | `/admin/backups` |
| 週1回 | 手動ダンプ実行 | `./scripts/backup-dump.sh` |
| 月1回 | 復元テスト実施 | `./scripts/backup-restore-test.sh` |
| 月1回 | バックアップサイズの推移確認 | 管理画面ダンプ一覧 |
