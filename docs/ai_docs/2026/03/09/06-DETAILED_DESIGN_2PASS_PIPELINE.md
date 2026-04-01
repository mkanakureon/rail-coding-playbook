# 詳細設計書：2パス・シナリオ生成パイプライン（editor-json 直結）

## 1. 目的
Gemini CLI において、コスト効率の高いモデル（Flash-Lite）で初稿を作成し、最高知能モデル（Pro）で高品質なエディタ用ブロック JSON に成形する「2 パス方式」を実装する。

## 2. パイプライン概要

### パス 1：Stage 3 (Drafting)
- **担当モデル**: Gemini 3.1 Flash-Lite
- **インプット**: `chX_episodes.json`（話プロット） + `config/<genre>.json`
- **アウトプット**: `chX_epY_draft.json`（初稿テキスト）
- **役割**: 物語の筋書き、セリフ、ト書きを高速かつ格安に生成する。

### パス 2：Stage 4 (Refining & Formatting)
- **担当モデル**: Gemini 3.1 Pro
- **インプット**: `chX_epY_draft.json`（パス 1 の初稿） + `config/<genre>.json`
- **アウトプット**: `editor-json/page-XXX.json`（エディタ用ブロック形式）
- **役割**: 初稿をリライト（エモく成形）、46文字ルール適用、アセットID解決、ブロック構造化。

---

## 3. データ構造（JSON 定義）

### A. パス 1 出力：`chX_epY_draft.json`
AI が物語の展開に集中できるよう、シンプルな形式とする。

```json
{
  "title": "第1話 龍王の帰還",
  "scenes": [
    {
      "sceneNumber": 1,
      "location": "zh_hall",
      "time": "day",
      "lines": [
        { "type": "narration", "text": "白金家のリビングは冷淡な空気に包まれていた。" },
        { "type": "dialogue", "speaker": "mitsuki", "text": "またこんな不味そうなものを作って！このゴミクズが！" },
        { "type": "dialogue", "speaker": "tatsuya", "text": "……申し訳ありません。" }
      ]
    }
  ]
}
```

### B. パス 2 出力：`editor-json/page-XXX.json`
エディタが直接読み込むブロック形式。パス 2 (Pro) が生成する。

```json
{
  "id": "page-001",
  "title": "第1章 龍王の帰還 - 第1話",
  "blocks": [
    { "id": "start-1", "type": "start" },
    { "id": "bg-2", "type": "bg", "assetId": "$bg:bg_hall" },
    { "id": "ch-3", "type": "ch", "characterId": "tatsuya", "expressionId": "normal", "pos": "R", "visible": true },
    { "id": "ch-4", "type": "ch", "characterId": "mitsuki", "expressionId": "normal", "pos": "L", "visible": true },
    {
      "id": "text-5",
      "type": "text",
      "body": "白金家のリビングは、いつもと変わらぬ冷淡な空気に包まれていた。@r\n豪華なシャンデリアの光さえ、ここでは凍てついているようだ。"
    },
    { "id": "ch-6", "type": "ch", "characterId": "mitsuki", "expressionId": "angry", "pos": "L", "visible": true },
    {
      "id": "text-7",
      "type": "text",
      "body": "「またこんな不味そうなものを作って！@r\nこのゴミクズが！ 跪いて謝りなさい！」"
    },
    { "id": "jump-8", "type": "jump", "toPageId": "page-002" }
  ]
}
```

---

## 4. プロンプト戦略

### Stage 3 (Flash-Lite) への指示
- 「物語の起承転結と感情の動きに集中せよ」
- 「描写が多少薄くても良いので、プロット通りの展開を維持せよ」

### Stage 4 (Pro) への指示
- 「Stage 3 のドラフトを、指定されたキャラクター口調でリライトし、心理描写を強化せよ」
- 「1行最大46文字、1ブロック最大3行の物理制約を厳守し、適切な位置に `@r\n` を挿入せよ」
- 「`location` 名を `config` の `bgMapping` に基づき `$bg:bg_xxx` に置換せよ」
- 「`speaker` 名を `characterId` に置換し、適切なタイミングで `visible: false` や `pos` の変更を行え」

---

## 5. アセット解決の詳細ロジック (in Stage 4)

1.  **背景解決**:
    - `location: "zh_hall"` → `bgMapping["zh_hall"]` → `0` → `bgSlugs[0]` → `"bg_hall"` → **`$bg:bg_hall`**
2.  **キャラクター解決**:
    - `speaker: "mitsuki"` → `characters["mitsuki"]` → **`characterId: "mitsuki"`**, **`pos: "L"`**

---

## 6. 実装の優先順位
1.  **`editor-json-generator.ts`**: Stage 4 のための LLM プロンプトと JSON 出力ロジックの実装。
2.  **`assist-cli.ts`**: Stage 3 と Stage 4 の 2 パス実行フローの実装。
3.  **Config**: 各ジャンルの `configs/*.json` へのアセット・キャラ定義の統合。
