# Azure サブスクリプション移行作業ログ

**日付**: 2026-03-03
**移行元**: ディーバAzure サブスクリプション
**移行先**: VSPサブスクリプション (`e665361e-cf3a-4bf5-8c42-d64223f54e39`)

## 背景

- 旧サブスクリプション（ディーバAzure）に誤ってリソースを作成していた
- リソースグループの移動を試みたが一部失敗
- 新サブスクリプション（VSP）でリソースを再作成する方針に変更
- コスト分析に基づき Front Door を廃止（月 ¥1,552 削減）

## 作成したリソース一覧

| リソース | 名前 | SKU / スペック | 状態 |
|---------|------|---------------|------|
| Resource Group | `rg-next-aca-min` | Japan East | 新規作成 |
| Container Registry | `acrnextacamin` | Basic | 新規作成 |
| PostgreSQL Flexible | `pgkaedevn` | Standard_B1ms, v16, 32GB | 新規作成 |
| PostgreSQL Flexible | `pgnextacamin` | Standard_B1ms, v16, 32GB | 旧サブスクから移動成功 |
| Storage Account | `kaedevnworks` | Standard_LRS, StorageV2, Hot | 旧サブスクから移動成功 |
| Log Analytics | `law-next-aca-min` | — | 新規作成 |
| Container Apps Env | `acae-next-aca-min` | — | 新規作成 |
| Container App | `ca-api` | 0.5CPU/1Gi, min=0, max=3 | 新規作成（仮イメージ） |
| Container App | `ca-nextjs` | 0.5CPU/1Gi, min=0, max=3 | 新規作成（仮イメージ） |
| Container App | `ca-editor` | 0.5CPU/1Gi, min=0, max=3 | 新規作成（仮イメージ） |
| Container App | `ca-preview` | 0.5CPU/1Gi, min=0, max=3 | 新規作成（仮イメージ） |

## 変更点（旧構成との差分）

| 項目 | 旧構成 | 新構成 | 効果 |
|-----|--------|--------|------|
| サブスクリプション | ディーバAzure | VSPサブスクリプション | 権限問題の解消 |
| Front Door | あり（fd-kaedevn） | **なし（削除）** | **-¥1,552/月** |
| Container Apps min replicas | 1 | **0** | アイドル時課金ゼロ |
| PostgreSQL 名前 | pgnextacamin | pgkaedevn（新規） | — |

## Container Apps URL

| アプリ | URL |
|-------|-----|
| ca-api | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| ca-nextjs | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| ca-editor | `https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| ca-preview | `https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |

## 環境変数（設定済み）

### ca-api

| 変数 | 値 |
|-----|-----|
| DATABASE_URL | `postgresql://adminkaedevn:KaedevnDB2026!@pgkaedevn.postgres.database.azure.com:5432/kaedevn?sslmode=require` |
| JWT_SECRET | `kaedevn-jwt-secret-2026-production` |
| AZURE_STORAGE_CONNECTION_STRING | （kaedevnworks の接続文字列） |
| AZURE_STORAGE_CONTAINER_NAME | `assets` |
| NODE_ENV | `production` |
| PORT | `8080` |
| ALLOWED_ORIGINS | ca-nextjs, ca-editor, ca-preview の FQDN |

### ca-nextjs

| 変数 | 値 |
|-----|-----|
| NEXT_PUBLIC_API_URL | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| NEXT_PUBLIC_EDITOR_URL | `https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| NODE_ENV | `production` |

### ca-editor / ca-preview

| 変数 | 値 |
|-----|-----|
| VITE_API_URL | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| NODE_ENV | `production` |

## 不要リソースの整理

| リソース | アクション | 理由 |
|---------|----------|------|
| `fd-kaedevn` (Front Door) | **削除** | 月 ¥1,552 の節約。Container Apps のマネージド証明書で代替 |
| `pgnextacamin` (旧 PostgreSQL) | 使用 or 削除を選択 | データが残っていれば使用推奨。空なら `pgkaedevn` を使用して削除 |
| `pgkaedevn` (新 PostgreSQL) | `pgnextacamin` を使うなら削除 | 重複回避 |

## 残作業

1. [ ] Front Door 削除完了を確認
2. [ ] PostgreSQL をどちらか1つに統一（`pgnextacamin` 推奨）
3. [ ] ca-api の DATABASE_URL を統一した PG に向ける
4. [ ] Prisma マイグレーション（新 DB の場合）: `npx prisma migrate deploy`
5. [ ] `./scripts/deploy-azure.sh` で全アプリをビルド＆デプロイ
6. [ ] 動作確認（ゲストログイン、プロジェクト作成、エディタ表示）
7. [ ] `.env` ファイル更新（`apps/hono/.env`, `apps/next/.env.local`）

## コスト見込み（月額）

| サービス | 見込み |
|---------|------:|
| Container Apps × 4 (min=0) | ¥2,000〜3,000 |
| PostgreSQL Flexible (B1ms) | ¥1,435 |
| Container Registry (Basic) | ¥312 |
| Storage | ¥1〜 |
| Front Door | ¥0（廃止） |
| **合計** | **¥3,748〜4,748** |

旧構成（¥6,218）比で **25〜40% 削減**。
