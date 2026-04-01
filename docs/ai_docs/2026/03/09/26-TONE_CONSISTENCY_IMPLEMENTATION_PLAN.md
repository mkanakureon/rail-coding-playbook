# 実行計画：トーン固定化による世界観の安定実装

## 1. 修正対象ファイルと変更内容

### 階層 A: データモデルとスキーマ
- `apps/hono/src/lib/assist/types.ts`
    - `Stage0Result` に `toneDefinition` (作品全体のトーン規約) を追加。
    - `ChapterPlot` に `chapterTone` (章固有のトーン指針) を追加。
- `apps/hono/src/lib/assist/schemas.ts`
    - 上記の型追加に合わせて Zod スキーマを更新。

### 階層 B: プロンプト（LLMへの指示）
- `apps/hono/src/lib/assist/prompts.ts`
    - `buildStage0Prompt`: 作品固有のトーンキーワード 3 つと、文体的な禁止事項を生成させるよう指示。
    - `buildStage1Prompt`: 作品全体のトーン定義を受け取り、それを章単位にブレイクダウンした `chapterTone` を生成させるよう指示。
    - `buildStage3Prompt`: `chapterTone` を「執筆の絶対的制約」として注入。

## 2. 実装のステップ

### Step 1: スキーマ・型の拡張 (Infrastructure)
- トーン情報を運ぶための「器」を作成する。

### Step 2: 骨格レベルでのトーン固定 (Foundation - Stage 0)
- 最初の骨格生成時に、作品の空気感を言語化させる。
- これにより、再実行しても「設定さえ同じなら同じトーン規約」が選ばれる確率を高める。

### Step 3: プロット・本文への伝播 (Execution - Stage 1 & 3)
- 決定したトーン規約を各ステージの LLM に「記憶」として渡し続ける。

## 3. 検証項目 (Definition of Done)
1. 生成された `skeleton.json` に、具体的で重複しないトーンキーワードが 3 つ含まれていること。
2. `page-XXX.json` の本文が、第1話から最終話まで同一の文体（例：素朴系ならずっと素朴）を維持していること。
3. 実行ごとに「ダークになったり王道になったり」する揺らぎが抑制されていること。

---
*本計画は原因分析報告書 (25-CAUSE_ANALYSIS_TONE_INCONSISTENCY.md) に基づき作成されました。*
