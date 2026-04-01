# Gemini Vision 画像解析テスト計画書 (30件試行)

## 目的
`official_assets` のメタデータを補完するため、Gemini 1.5 Pro/Flash の Vision 機能を用いて画像内容を解析し、その精度と出力形式を検証する。本番 DB 更新前の安全策として、まずは JSON ファイルへの書き出しのみを行う。

## 実施フェーズ
1. **アセット選定**: `official_assets` から `bg` 15件、`ch-img` 15件の計30件をランダムまたは代表的に選出。
2. **スクリプト作成**: 
   - 画像のローカルパス特定。
   - Gemini API への画像 + プロンプト送信。
   - レスポンスの JSON パースと検証。
3. **実行**: 順次処理し、解析結果をファイルに保存。
4. **評価**: 生成された `description_ja` や `tags` が仕様書（`04-asset-metadata-spec.md`）に準拠しているか確認。

## 期待される出力形式
`docs/09_reports/2026/03/10/vision_results/{id}.json` として保存。

```json
{
  "asset_id": "xxx",
  "filename": "fantasy_forest_night.webp",
  "fromVision": {
    "description_ja": "...",
    "description_en": "...",
    "tags": ["...", "..."],
    "mood": "...",
    "subtype": "outdoor",
    ...
  }
}
```

## プロンプト設計
- **システムプロンプト**: キャラクターまたは背景の属性を抽出する専門家として振る舞う。
- **出力制約**: JSON 形式のみを返却。仕様書の `fromVision` フィールドを網羅する。

## スケジュール
- 計画作成: 2026-03-10 (本日)
- テスト実行: 計画承認後すぐ
- 結果レビュー: 実行完了後
