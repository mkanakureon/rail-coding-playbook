---
description: Use when the user asks to sync official assets from local DB to Azure DB. Triggers on "公式アセット同期", "アセット同期", "official assets sync", "ローカルをAzureに反映".
---

# 公式アセット同期（ローカル → Azure）

ローカル DB の `official_assets` テーブルを Azure DB に完全同期する。

## 概要

- **方向**: ローカル → Azure（ローカルが正）
- **方式**: 完全同期（Azure にしかないレコードは削除）
- **比較キー**: `blob_path`（同じ画像 = 同じ blob_path）
- **画像ファイル**: 両環境とも Azure Blob Storage（`kaedevnworks.blob.core.windows.net`）を参照。DB レコードの同期のみ

## 手順

### 1. ファイアウォール開放

Azure DB に接続するため、現在の IP をファイアウォールに追加する。

```bash
MY_IP=$(curl -s4 ifconfig.me)
az postgres flexible-server firewall-rule create \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name temp-sync-$(date +%Y%m%d) \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### 2. 差分確認（dry-run）

```bash
node scripts/db/sync-official-assets.mjs --dry-run
```

INSERT / UPDATE / DELETE の件数と対象を確認する。

### 3. 実行

ユーザーが差分を確認して承認したら実行する。

```bash
node scripts/db/sync-official-assets.mjs --execute
```

### 4. ファイアウォール削除（任意）

```bash
az postgres flexible-server firewall-rule delete \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name temp-sync-$(date +%Y%m%d) --yes
```

## 接続情報

| 環境 | DB |
|---|---|
| ローカル | `postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev` |
| Azure | `postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb` |

## 注意事項

- **必ず dry-run で差分を確認してから実行する**
- 実行はトランザクション内で行われる（失敗時は自動ロールバック）
- 頻度は月 1 回程度を想定
- ローカル DB が起動していること（`brew services start postgresql@16`）
- blob_path が同じでも ID が異なる場合はローカルの ID に統一される

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "公式アセット同期して" | dry-run → 確認 → 実行 |
| "アセットをAzureに反映" | 同上 |
| "official assets sync" | 同上 |
| "ローカルのアセットをAzureに" | 同上 |
