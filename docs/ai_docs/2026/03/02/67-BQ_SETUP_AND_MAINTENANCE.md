# BigQuery 分析基盤：セットアップ・運用ガイド

## 1. 概要
本プロジェクトでは、API (Hono) から発生する全ての行動ログを Google Cloud BigQuery へ送信し、構造化データとして蓄積する基盤を構築しました。

## 2. 認証・環境設定
プログラムが BigQuery を操作するために、以下の設定が必要です。

### A. gcloud CLI による認証
ローカル開発環境では、以下のコマンドであなたの Google アカウント権限をプログラムに貸与します。
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project kaedevn-analytics
```

### B. .env の設定 (`apps/hono/.env`)
```env
LOG_SINK_TYPE=bigquery
BQ_DATASET_ID=kaedevn_analytics
BQ_TABLE_ID=events_raw
```

## 3. 初期セットアップコマンド
以下のコマンドを実行することで、BigQuery 上に必要な「箱（データセット）」と「表（テーブル）」を自動生成します。

```bash
# テーブルとスキーマを作成
npm run setup:bq -w @kaedevn/hono

# 分析を便利にするための View を作成
npm run setup:views -w @kaedevn/hono
```

## 4. データの流れ
1. **API実行**: ユーザーがログインや保存を行う。
2. **自動記録**: `analyticsMiddleware` がリクエスト情報をキャッチ。
3. **送信**: `BigQueryLogSink` が Google Cloud へデータを飛ばす。
4. **蓄積**: `events_raw` テーブルに 1 行のログとして保存される。

## 5. メンテナンス
- **コスト管理**: 無料枠（Sandbox）ではストリーミング挿入に制限があるため、本番運用時は課金設定を有効にするか、バッチ読み込みを検討してください。
- **スキーマ変更**: ログに新しい項目を足したい場合は、`setup-bq.ts` のスキーマ定義を更新して再実行してください。
