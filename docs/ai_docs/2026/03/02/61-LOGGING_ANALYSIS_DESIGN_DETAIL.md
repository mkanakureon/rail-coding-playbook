# 設計書：構造化ロギングと分析パイプライン（DI/詳細設計版）

## 1. システムアーキテクチャ（DI構造）
Sink（出力先）を抽象化し、実行環境に応じた差し替えを可能にします。

```text
[apps/hono] ──→ [LoggingService] 
                       │
             ┌─────────┴─────────┐ (DI)
             ▼                   ▼
      [BigQueryLogSink]    [MockLogSink]
             │                   │
      (Google Cloud)       (stdout / Azure)
```

## 2. クラス設計 (`apps/hono/src/lib/logging`)

### A. ILogSink (Interface)
全ての出力先が実装すべき共通の契約。
- `send(payload: LogEvent): Promise<void>`

### B. BigQueryLogSink (Implementation)
- 役割: ローカル開発環境からの直接分析用。
- 技術: `@google-cloud/bigquery`
- 認証: サービスアカウント JSON ファイルを環境変数で指定。

### C. MockLogSink (Implementation)
- 役割: テスト環境および Azure 本番環境（標準出力経由）用。
- 技術: `console.log` (JSON.stringify)

## 3. 分析データモデル
(変更なし。61-LOGGING_ANALYSIS_DESIGN_DETAIL.md の定義を維持)

## 4. 環境変数による制御
`LOG_SINK_TYPE` プロパティによって切り替えます。
- `bigquery`: 直接 BigQuery へ送信（ローカル用）。
- `mock`: 標準出力へ出す（テスト・Azure用）。

## 5. メリット
DI による設計により、ロギングロジック（いつログを出すか）と Sink 実装（どこにログを出すか）が疎結合になり、将来の `AzureAppInsightsSink` 等への拡張が最小限の工数で可能になります。
