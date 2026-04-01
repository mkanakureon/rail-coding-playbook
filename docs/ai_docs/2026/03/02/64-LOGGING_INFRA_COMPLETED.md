# ロギング・分析基盤 導入完了報告

## 1. 実装済みコンポーネント
`apps/hono/src/lib/logging` において、以下のコンポーネントを実装し、API全体に適用しました。

- **ILogSink (Interface)**: ログ送信の抽象化。
- **MockLogSink**: 標準出力へ構造化JSONを出すデフォルト実装（Azure/テスト用）。
- **BigQueryLogSink**: Google Cloud BigQuery へ直接データを送信する分析用実装。
- **analyticsMiddleware**: 全てのリクエストを自動的に追跡・分類する Hono ミドルウェア。

## 2. 必要な設定（分析を有効にする場合）
ローカル環境で BigQuery への直接送信を試すには、`apps/hono/.env` に以下の設定を追加してください。

```env
# ログ出力先の切り替え (bigquery | mock)
LOG_SINK_TYPE=bigquery

# BigQuery 設定
BQ_DATASET_ID=kaedevn_analytics
BQ_TABLE_ID=events_raw

# Google Cloud 認証
# サービスアカウントキー (JSON) の絶対パスを指定
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
```

## 3. 次のステップ：BigQuery 側のテーブル作成
BigQuery 上で以下のスキーマ（または互換性のあるスキーマ）で `events_raw` テーブルを作成してください。

- `timestamp`: TIMESTAMP (Partitioning column)
- `event_type`: STRING
- `user_id`: STRING
- `project_id`: STRING
- `payload`: JSON
- `context`: RECORD (REPEATED or NULLABLE)
  - `ua`: STRING
  - `version`: STRING
  - `path`: STRING
  - `method`: STRING
  - `status`: INTEGER
  - `duration_ms`: INTEGER

## 4. 運用のメリット
この基盤により、エンジニアリング工数を最小限に抑えつつ、ユーザーの離脱傾向や作品のヒット率を SQL でいつでも分析できる状態が整いました。
