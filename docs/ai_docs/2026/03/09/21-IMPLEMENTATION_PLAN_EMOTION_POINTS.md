# 実行計画：エモーションポイント（EP）実装

## 1. 修正対象ファイルと変更内容

### 階層 A: データモデルとスキーマ
- `apps/hono/src/lib/assist/types.ts`
    - `ChapterPlot` に `targetMaxEp` 追加。
    - `ScenePlot` に `ep`, `vibe` 追加。
    - `Stage3Result` に `appliedEp` 追加。
- `apps/hono/src/lib/assist/schemas.ts`
    - 上記型定義に合わせて `zod` スキーマを更新。
- **新規マスターデータ作成 (DONE/Pending)**:
    - `docs/10_ai_docs/2026/03/09/23-GENRE_EP_CURVE_TEMPLATES.json` (DONE): ジャンル別のEP目標推移の定義。
    - `ep-staging-rules.json` (Pending): EP数値と演出タグの連動定義。
    - `ep-writing-styles.json` (Pending): EP数値別の執筆トーン制御定義。

### 階層 B: プロンプト（LLMへの指示）
- `apps/hono/src/lib/assist/prompts.ts`
    - `buildStage1Prompt`: 各章に `targetMaxEp` と目標感情曲線（EPの推移イメージ）を生成させるよう指示。
    - `buildStage2Prompt`: 章の `targetMaxEp` を基に、各シーンへ具体的な `ep` 数値を割り振るよう指示。
    - `buildStage3Prompt`: 入力された `ep` 数値に応じた執筆ガイド（熱量の強弱、語彙の選択）をシステムプロンプトに注入。

### 階層 C: CLIツールと出力
- `scripts/cli/ai/assist-cli.ts`
    - 実行ログに EP 推移を表示する簡易グラフ表示機能を追加。
    - 生成された JSON に EP フィールドが正しく含まれているか確認。

## 2. 実装のステップ

### Step 1: 型定義とスキーマの拡張 (Infrastructure Phase)
- データの器を作る。この時点では既存の生成は壊さない（フィールドをオプショナルにする）。

### Step 2: 感情設計の導入 (Logic Phase - Stage 1 & 2)
- 章プロット（Stage 1）と話プロット（Stage 2）での EP 割り当てを実装。
- `fantasy` プロジェクト等で EP の推移が意図通り（例: 終盤に高まる）かを確認。

### Step 3: 執筆トーンの連動 (Expression Phase - Stage 3)
- 最も重要な工程。
- EP 20 のシーンと EP 90 のシーンを生成し、文章の「熱量」に明確な差が出るようプロンプトをチューニング。

### Step 4: 演出タグの自動連動 (Staging Phase - Stage 4/Finalize)
- EP 80 以上のシーンで `[flash]` などの演出タグが自然に出現するか確認。

## 3. 検証項目 (Definition of Done)
1. `npm run typecheck` が Hono およびパッケージ全体で通ること。
2. 生成された JSON 内に `ep` (0-100) が含まれ、ストーリー上の重要度と相関があること。
3. 高EPシーンで、比喩表現や演出指示タグの頻度が有意に向上していること。
4. **キャラクター一貫性・伏線配置の検証**:
    - コン（kon）等の特殊キャラクターの口調が、低EP時でも現代語（〜です等）に崩れず、指定された語尾（〜ですな等）を維持していること。
    - 第2話以降で高EPの重要シーン（過去の告白など）を持つガルド（gard）等のキャラクターが、第1話の低EPシーンで正しく「顔出し」されていること。

---
*本計画は設計ドキュメント (20-DESIGN_EMOTION_POINTS.md) に基づき、段階的な移行を目指して作成されました。*
