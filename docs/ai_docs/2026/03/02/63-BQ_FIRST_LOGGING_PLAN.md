# BigQuery先行導入・Azureモック型ロギング実装計画書 (DI設計版)

## 1. コンセプト
本番の Azure インフラ構築を待たず、まずはローカル環境から BigQuery へデータを直接送信する。この際、**DI（依存性注入）**を採用し、ログの出力先（Sink）を抽象化することで、将来的なインフラ変更への耐性とテストの容易性を確保する。

## 2. 構成案：LogSinkインターフェースの導入
- **抽象層**: `ILogSink` インターフェースを定義。
- **モック実装**: `MockLogSink` (標準出力のみ。Azure本番環境や開発初期で使用)。
- **BigQuery実装**: `BigQueryLogSink` (Google Cloud SDK を使用。ローカル分析フェーズで使用)。

## 3. 具体的な実装タスク

### Step 1: ILogSink インターフェースの定義
`apps/hono/src/lib/logging/types.ts` 等に定義。

```typescript
export interface ILogSink {
  send(event: LogEvent): Promise<void>;
}
```

### Step 2: 各 Sink の実装
- `MockLogSink`: `console.log` で構造化JSONを出力。
- `BigQueryLogSink`: `@google-cloud/bigquery` を使ってストリーミング挿入。

### Step 3: プロバイダーによる DI
環境変数（`LOG_SINK_TYPE`）に基づき、実行時に使用する Sink を決定するファクトリを作成。

```typescript
// factory.ts のイメージ
export function getLogSink(): ILogSink {
  if (process.env.LOG_SINK_TYPE === 'bigquery') {
    return new BigQueryLogSink();
  }
  return new MockLogSink();
}
```

### Step 4: Hono ミドルウェアへの適用
ミドルウェアは `ILogSink` のみを意識し、実際の実装（BQなのかMockなのか）は知らない状態で動作させる。

## 4. Gemini CLI / Claude Code への具体的な指示
「ロギングシステムを DI（依存性注入）ベースで設計してください。具体的には `ILogSink` インターフェースを作成し、`MockLogSink` と `BigQueryLogSink` を差し替え可能にしてください。環境変数によって実行時にこれらを切り替えるファクトリも実装してください。」

## 5. このアプローチのメリット
- **結合部の安全性**: インターフェースが固定されるため、Sink を追加・変更してもミドルウェア側のコードを修正する必要がない。
- **テスト容易性**: 単体テスト時には `MockLogSink` を使うことで、外部通信なしでロジックを検証できる。
- **シームレスな移行**: Azure 側の準備が整い次第、`AzureLoggingSink` を作って差し替えるだけで済む。
