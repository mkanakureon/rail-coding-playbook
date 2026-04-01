# テスト報告書 — 2026年3月15日

> 実行時刻: セッション中 / トリガー: マイグレーション13本をベースライン統合

## 変更内容

- `apps/hono/prisma/migrations/`: 旧マイグレーション13本を削除し、`20260216000000_init` に統合（Mapモデル含む全テーブル）

## テスト判定

| ワークスペース | 判定理由 | 実行 |
|--------------|---------|------|
| hono | `apps/hono/prisma/migrations/` が変更 | ✅ |
| core | 変更なし | ⏭️ スキップ |
| compiler | 変更なし | ⏭️ スキップ |
| interpreter | 変更なし | ⏭️ スキップ |
| web | 変更なし | ⏭️ スキップ |
| editor | 変更なし | ⏭️ スキップ |
| next | 変更なし | ⏭️ スキップ |

## テスト結果

| ワークスペース | passed | failed | skipped | 結果 |
|--------------|--------|--------|---------|------|
| hono | 284 | 36 | 38 | ⚠️ |

## 失敗詳細

### test/assist-context.test.ts (11 failed)

- **テスト名**: buildSceneSummaryPrompt / buildCharacterStatePrompt / buildChapterSummaryPrompt / ChapterSummaryResultSchema 系
- **エラー**: プロンプト構成関数の出力がテストの期待文字列と不一致。`ChapterSummaryResultSchema` が undefined
- **今回の変更との関連**: なし（既存の問題 — AI執筆支援のプロンプト変更後にテスト未更新）

### test/assist-prompts.test.ts (9 failed)

- **テスト名**: buildSkeletonPrompt / buildChapterPrompt / buildScenePrompt / buildEpisodeSummaryPrompt 系
- **エラー**: プロンプト構成関数の出力がテストの期待文字列と不一致
- **今回の変更との関連**: なし（既存の問題）

### test/assist-ks-generator.test.ts (7 failed)

- **テスト名**: dialogue / choice / flagSet / jumpTo 変換系
- **エラー**: KS生成関数の出力形式がテストの期待と不一致
- **今回の変更との関連**: なし（既存の問題）

### test/assist-md-parser.test.ts (6 failed)

- **テスト名**: デモ設定ファイル読み込み / キャラクター読み込み / overview / オプション / アセットマッピング / 存在しないディレクトリ
- **エラー**: ファイルパス解決エラー（テスト用のデモ設定ファイルが移動/削除された可能性）
- **今回の変更との関連**: なし（既存の問題）

### test/assist-schemas.test.ts (1 failed)

- **テスト名**: 不正な line type を拒否する
- **エラー**: スキーマバリデーションの期待動作と実装の不一致
- **今回の変更との関連**: なし（既存の問題）

### test/assist-pipeline.test.ts (2 failed)

- **テスト名**: パイプライン統合テスト系
- **エラー**: 依存するプロンプト/スキーマの変更に伴う不一致
- **今回の変更との関連**: なし（既存の問題）

## 総合判定

⚠️ 既存の失敗のみ — 今回のマイグレーション統合による新規失敗はゼロ。schema-sync テスト (6/6) を含む主要テストは全通過。失敗36件は全て `assist-*` 系（AI執筆支援）の既存テスト不整合。
