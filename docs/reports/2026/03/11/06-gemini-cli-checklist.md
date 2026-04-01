# Gemini CLI 確認事項

**日付**: 2026-03-11
**背景**: AI 生成パイプライン（Stage 0-4）で生成した editor-json を `scripts/import-editor-json.ts` でブロックエディタにインポートした。案A（最小変換）は動作確認済み。以下を確認・改善したい。

---

## 1. 生成パイプラインの品質問題

### 1-1. キャラ名の表記揺れ（致命的）

Stage 3-4 でキャラ名がブレている。同一人物が page ごとに別名になる。

```
garud / gard / gald → 全て同一人物「ガルド」
mira / meera → 全て同一人物「ミーラ」
```

**確認事項**:
- `scripts/cli/ai/assist-cli.ts` の Stage 3-4 の prompt を確認して、characters.json のスラグ一覧をプロンプトに注入する方法を検討してほしい
- 「出力する characterId は必ず以下のいずれかにしてください: luca, garud, kon, mira, elder」のような制約を追加できるか

### 1-2. 背景スラグの `$bg:` プレフィックス

生成された editor-json の bg ブロックが `$bg:dried_spring` のようなプレースホルダーを使っている。

**確認事項**:
- Stage 4（editor-json 変換）で `$bg:` プレフィックスを除去して、manifest.json の `bgDependencies` の slug と一致させる方が良いか
- それとも変換スクリプト側でのマッピング（現状の方式）を維持すべきか

### 1-3. characters.json に全キャラ未定義

manifest.json の characters は 3 体だが、実際のストーリーには 11 体登場する。elder, bandit_a, bandit_b, bandit_leader, kon, mira 等が characters.json に未定義。

**確認事項**:
- Stage 4 の変換ロジックで、ストーリー中に登場する全キャラクターを自動的に characters.json に追加する仕組みは作れるか
- 公式アセットの中から elder（老人系）、bandit（悪役系）に適したキャラクター画像はあるか → `GET /api/official-assets` で確認

---

## 2. インポートスクリプトの確認

### 2-1. スクリプトの再実行テスト

`scripts/import-editor-json.ts` を更新した（ch-class メタデータ永続化ステップを追加）。

**確認事項**:
- 新しいプロジェクトに対してスクリプトを実行し、bg / ch / text の全ブロックが正しく表示されるか end-to-end で確認してほしい
- 特に ch ブロックの画像表示（ch-class メタデータの `PUT /api/assets/:projectId/character-class/:slug` が正しく呼ばれるか）

### 2-2. dry-run モードの動作確認

```bash
npx tsx scripts/import-editor-json.ts projects/fantasy_generated/output/20260311_161005/editor-json --dry-run
```

**確認事項**:
- dry-run で JSON ファイルが正しく出力されるか
- 変換後の JSON のブロック数、assetId、characterId が妥当か

---

## 3. エディタ表示の確認

### 3-1. 15 ページ全ての表示確認

**確認事項**:
- `http://localhost:5176/projects/editor/01KKDX2WBHCAXN2VXNT3K8TWE6` を開いて、全 15 ページを切り替えて表示確認
- 以下を各ページで確認:
  - bg ブロック: サムネイル画像が表示されている（「画像未選択」ではない）
  - ch ブロック: キャラクターサムネイルが表示されている（「?」ではない）
  - text ブロック: セリフテキストと speaker 名が表示されている

### 3-2. プレビュー再生

**確認事項**:
- `http://localhost:8080/api/preview/01KKDX2WBHCAXN2VXNT3K8TWE6` でプレビュー再生できるか
- 背景・キャラクターの表示切り替え、セリフ送りが正常か
- JS エラーが出ていないか

---

## 4. 公式アセット調査（案B 準備）

案B（アセット拡充 + 変換）に向けて、利用可能な公式アセットを調査したい。

**確認事項**:
- `GET http://localhost:8080/api/official-assets` で取得できる背景アセットの一覧（名前 + subcategory）を出力してほしい
- 現在の 3 背景（bg_field, bg_forest, bg_indoor）以外に使える背景があるか
- キャラクターアセットに表情バリエーション（happy, sad, angry 等）があるか
- 案B のマッピングテーブル案を提案してほしい（39 背景 → 10〜15 公式背景）

---

## 5. Playwright テストの拡張

### 5-1. 既存テストの確認

`tests/local/editor-import-verify.spec.ts` が 5 テスト通過済み。

**確認事項**:
- テストを実行して全パスするか: `npx playwright test tests/local/editor-import-verify.spec.ts --config playwright.local.config.ts`
- テスト失敗時は screenshots を確認して原因を特定

### 5-2. プレビュー再生テストの追加

**確認事項**:
- プレビュー URL にアクセスして再生テストを追加すべきか
- bg 切り替え・ch 表示・text 送りが動作するかを E2E で検証するテストの設計

---

## 参考ファイル

| ファイル | 内容 |
|---------|------|
| `scripts/import-editor-json.ts` | インポートスクリプト本体 |
| `docs/09_reports/2026/03/11/04-editor-json-import-study.md` | ギャップ分析・方針検討 |
| `docs/09_reports/2026/03/11/05-editor-json-import-result.md` | 実施結果・改善案 |
| `tests/local/editor-import-verify.spec.ts` | E2E テスト |
| `scripts/cli/ai/assist-cli.ts` | AI 生成パイプライン CLI |
| `projects/fantasy_generated/output/20260311_161005/editor-json/` | 生成データ |
