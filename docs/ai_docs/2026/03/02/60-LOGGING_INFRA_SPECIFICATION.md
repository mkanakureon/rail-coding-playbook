# 仕様書：プラットフォーム・ログ標準化とデータ基盤

## 1. 目的
kaedevn プラットフォーム（API/Portal）から生成される行動ログを構造化し、BigQuery 等の分析基盤へ統合することで、ユーザーの離脱予測や作品のヒット予測を可能にするためのデータ基盤を構築する。

## 2. 収集対象イベント（イベントカタログ）

### A. 作者（Creator）イベント
- **project_create**: プロジェクトの新規作成。
- **editor_open**: エディタの起動。
- **block_add**: ブロックの追加（type情報を付与）。
- **preview_run**: プレビューの実行。
- **export_native**: ネイティブビルドの実行（成功/失敗）。

### B. 読者（Reader）イベント
- **work_read_start**: 作品の閲覧開始。
- **page_view**: ページ（話数）の遷移。
- **work_complete**: 読了。
- **engagement**: いいね、コメント、投げ銭。

## 3. 共通ログスキーマ（JSON）
全てのログは、以下の共通フィールドを持つ JSON 形式で出力されなければならない。

```json
{
  "timestamp": "ISO8601",
  "event_type": "string",
  "user_id": "string",
  "project_id": "string?",
  "payload": "object", // イベント固有データ
  "context": {
    "ua": "string",
    "ip_hash": "string",
    "version": "string"
  }
}
```

## 4. 非機能要件
- **低遅延**: ログ出力が API のレスポンスタイムに悪影響を与えないこと。
- **信頼性**: ネットワークエラー時にログが消失しないよう、バッファリングまたはリトライを考慮する。
- **プライバシー**: 個人情報（メールアドレス、パスワード等）は絶対にログに含めない。
