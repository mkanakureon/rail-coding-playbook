# BigQuery 分析基盤：認証・セットアップ詳細ガイド

## 1. Google Cloud 側の設定手順
1. **Google Cloud Console** でプロジェクトを作成。
2. **BigQuery API** を有効化。
3. **サービスアカウント** を作成し、以下の権限を付与：
   - `BigQuery Data Editor`
   - `BigQuery Job User`
4. サービスアカウントの **JSON キー** を生成・ダウンロード。

## 2. ローカル環境の設定 (.env)
`apps/hono/.env` に以下の項目を設定します。

```env
LOG_SINK_TYPE=bigquery
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-key.json"
BQ_DATASET_ID=kaedevn_analytics
BQ_TABLE_ID=events_raw
```

## 3. 自動セットアップの実行
以下のコマンドにより、スキーマ定義・パーティション設定済みのテーブルを自動生成します。

```bash
npm run setup:bq -w @kaedevn/hono
```

## 4. ログの確認方法
セットアップ完了後、API を稼働させると自動的にログが BigQuery へ送信されます。
BigQuery コンソール上で以下の SQL を実行することで、蓄積されたログを確認できます。

```sql
SELECT * FROM `kaedevn_analytics.events_raw` ORDER BY timestamp DESC LIMIT 100
```

## 5. 注意事項
- **コスト**: ストリーミング挿入は無料枠を超えると課金対象となります。開発時は `LOG_SINK_TYPE=mock` に戻すことで課金を回避できます。
- **セキュリティ**: JSON キーは絶対に Git にコミットしないでください。`.gitignore` で保護するか、リポジトリ外に配置してください。
