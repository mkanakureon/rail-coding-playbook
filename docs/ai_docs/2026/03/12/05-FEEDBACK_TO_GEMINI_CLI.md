# Gemini CLI への改善フィードバック報告書 (2026-03-12)

本ドキュメントは、AI生成パイプラインからエディタへのインポート検証（Playwrightテスト含む）の結果得られた、生成AI側（Gemini CLI）への改善要望をまとめたものである。

## 1. 改善要望事項と実装確認結果

Claude Code にて `assist-cli.ts` のソースコードを検証した結果を以下に記す。

### 1-1. editor-json のプロパティ・クリーンアップ — **実装確認OK**
- **要望**: `editor-json` 出力時に、エディタ未対応のプロパティ（`emotion`, `tone`, `action` 等）を除去すること。
- **実装箇所**: `runStage4` 関数 L593-600
- **確認**: `delete block.emotion/tone/action/emotionDetail/timeContext/weather/cameraAngle` で 7 プロパティを除去している。十分。

### 1-2. キャラクター依存関係の重複排除ロジック — **未完了（コメントのみ）**
- **要望**: `manifest.json` の `characterDependencies` 生成時、公式アセットに既に存在するキャラクター（例: `fantasy_hero`）を自動的に除外すること。
- **実装箇所**: `generateEditorManifest` 関数 L442-448
- **問題**: コメント `// Requirement 2: Skip character-dependencies if they are already in the project/official set` は入っているが、**実際のフィルタリングロジックが未実装**。config に定義された全キャラがそのまま `characterDependencies` に出力される。
- **修正案**: 以下のいずれかを実装する必要がある:
  1. **API 問い合わせ方式**: `GET /api/official-assets?type=ch` で既存キャラを取得し、slug が一致するものを除外
  2. **静的リスト方式**: `scripts/cli/configs/` に `known-official-chars.json`（`["fantasy_hero", "fantasy_mage", ...]`）を置き、マッチするものを除外
  3. **フラグ方式**: 除外せず `"skipIfExists": true` を付与し、インポートスクリプト側で 409 を無視する

  最も確実なのは方式 2（静的リスト）。API に依存しないため、オフライン生成でも動作する。

### 1-3. マニフェストへのメタ情報追加（totalPages） — **実装確認OK**
- **要望**: `manifest.json` に総ページ数 (`totalPages`) を明記すること。
- **実装箇所**: `generateEditorManifest` 関数 L454
- **確認**: `totalPages: pages.length` で正しく出力されている。

### 1-4. テキストブロック内のタグ正規化 — **実装確認OK**
- **要望**: セリフ本文中の `@r` や `@p` を `\n` に変換すること。
- **実装箇所**: `runStage4` 関数 L589-590
- **確認**: `block.body.replace(/@r\n?/g, '\n').replace(/@p\n?/g, '\n\n')` で正規化されている。

## 2. サマリー

| 要望 | 状態 | 備考 |
|------|------|------|
| 1-1. プロパティ除去 | **OK** | 7プロパティを delete |
| 1-2. キャラ重複排除 | **未完了** | コメントのみ。フィルタロジックが必要 |
| 1-3. totalPages | **OK** | manifest に出力済み |
| 1-4. @r/@p 正規化 | **OK** | \n / \n\n に変換済み |

## 3. 次のアクション
- **Gemini CLI**: 1-2 のキャラクター重複排除ロジックを実装する。推奨は静的リスト方式（`known-official-chars.json`）。
- **Claude Code**: 1-2 の修正後、再度インポートテストを実施して 409 エラーが発生しないことを確認する。

---
*検証者: Claude Opus 4.6 | 検証日: 2026-03-12 | 参照テスト: e2e/editor-verify-01KKDX2W.spec.ts*
