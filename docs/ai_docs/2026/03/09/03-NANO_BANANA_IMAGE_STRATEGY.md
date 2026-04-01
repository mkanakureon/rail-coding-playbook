# 戦略ガイド：Nano Banana によるノベルゲーム画像量産

## 1. 概要
Google の次世代画像生成 AI 「Nano Banana」（正式名称：Gemini 3 Image モデル）を活用し、ノベルゲームに必要な大量の背景素材と、一貫性のあるキャラクター立ち絵を効率的に生成するための戦略を定義する。

## 2. モデルの選定と使い分け
用途に応じて、スピード重視の Flash と品質重視の Pro を使い分ける。

| モデル | コードネーム | 特徴 | 推奨用途 |
| :--- | :--- | :--- | :--- |
| **Gemini 3 Flash Image** | **Nano Banana 2** | 爆速、低コスト。実用的な画質。 | 汎用的な背景（教室、街角など）、アイデア出し、大量のモブキャラ。 |
| **Gemini 3 Pro Image** | **Nano Banana Pro** | 高画質。**一貫性維持能力**。正確な文字入れ。 | メインキャラの立ち絵（表情差分）、重要シーンのイベント CG、図解。 |

## 3. アセット管理：マスター JSON 方式
プロンプトを直接管理せず、構造化された JSON データとして保持することで、Gemini CLI（ディレクター）による「あうんの呼吸」での量産を可能にする。

### A. キャラクター定義 JSON
```json
{
  "character_id": "heroine_01",
  "style": "Anime style, high quality, detailed cel shading",
  "base_description": "long blonde hair tied in twin tails, amber eyes, private high school uniform",
  "technical_specs": "full body standing, white background",
  "variations": {
    "smile": "gentle smile, blushing cheeks",
    "angry": "angry pouting, crossed arms",
    "sad": "teary eyes, biting her lip"
  }
}
```

### B. 背景定義 JSON
```json
{
  "location_id": "mansion_lobby",
  "base_description": "grand European mansion lobby, winding staircase, chandelier",
  "time_variants": {
    "day": "bright sunlight streaming through windows",
    "sunset": "golden hour, orange light, long shadows",
    "night": "midnight, moonlight, dim indoor lighting"
  }
}
```

## 4. 運用ワークフロー

### ステップ 1：ディレクション（Gemini CLI）
- Gemini CLI にマスター JSON を読み込ませる。
- 「[キャラID] の [表情ID]」と指示するだけで、CLI が Nano Banana に最適化された詳細な英語プロンプトを自動生成する。

### ステップ 2：一貫性の維持（Nano Banana Pro）
- **Character Reference**: 1 枚目の画像を「参照画像」として固定し、2 枚目以降を生成することで、同じ顔・服装の表情差分を量産する。
- **Content Reference**: 背景の構造（階段の位置、窓の向き）を固定し、時間帯やアングル（俯瞰・煽り）だけを変更する。

### ステップ 3：API による自動化
- TypeScript スクリプトを用いて、JSON から全パターンのプロンプトを生成し、一括で画像ファイルを書き出す（`heroine_01_smile.png` など）。

## 5. 本プロジェクトへの統合計画
1. `scripts/cli/configs/` 内の各ジャンル設定に、Nano Banana 用のアセット定義（JSON）を追加する。
2. `assist-cli.ts` に、シナリオ生成（Stage 3）の文脈から「必要な画像プロンプト」を自動抽出する機能を追加する。
3. 生成された画像プロンプトを、直接エディタ用ブロックの `assetId` 候補として管理する。

---
*本ガイドは docs/01_in_specs/2026/03/0309/gemini.md の分析に基づき作成されました。*
