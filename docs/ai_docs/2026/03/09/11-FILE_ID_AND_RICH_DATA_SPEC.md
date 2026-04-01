# 管理仕様：成果物 ID 命名規則と Rich Data 拡張

## 1. 目的
成果物のトレーサビリティ（どのロジックの、どの段階の成果か）を確保し、かつ AI が生成過程で得た豊富な演出意図を JSON に余すことなく記録する。

## 2. ファイル命名規則 (File ID Spec)

すべての生成ファイル（`output/` 直下）には、以下の命名規則を適用する。

### プレフィックス構造
`{PIPELINE_ID}_S{STAGE_NUM}_`

- **PIPELINE_ID**: 生成ロジックのメジャーバージョン（例: `P01`, `P02`）。
- **STAGE_NUM**: 生成パイプライン内のステップ番号（0〜4）。

### 具体例
- `P01_S0_skeleton.json`
- `P01_S1_chapters.json`
- `P01_S2_ch1_episodes.json`
- `P01_S3_ch1_ep1_text.json`
- `P01_S4_ch1_script_simple.md`

※ `editor-json/` 内のファイルは、エディタ側のインポート仕様を優先し、プレフィックスを付与しない。その代わり、`manifest.json` 内に ID 情報を記録する。

---

## 3. 各ステージの Rich Data 拡張項目

AI が各段階で推論した「演出の種」を JSON に含める。

### S0: 骨格生成 (Skeleton)
- `visualStyleHint`: 推奨される画風（Nano Banana への指示用）。
- `targetAudience`: 想定ターゲット層（語彙選択の基準用）。

### S1: 章プロット (Chapters)
- `chapterColor`: 章を象徴する色（画面全体のフィルター演出用）。
- `tensionCurve`: 盛り上がりの推移（1〜10 の配列、オートモードの速度制御用）。

### S2: 話プロット (Episodes)
- `suggestedBgm`: AI が推奨する BGM の雰囲気。
- `lightingContext`: シーンの照明状態（逆光、薄暗い、スポットライト等）。

### S3: 本文ドラフト (Drafting)
- `lineContext`: 各行の背後にある「感情の強さ」や「意図」のメモ。

### S4: JSON 成形 (Refining)
- `wait`: セリフ後の適切な「間」（ms）。
- `isThought`: モノローグ（心の声）判定フラグ。
- `characterAction`: キャラクターの細かな所作（頷く、視線を逸らす等）。

---

## 4. 運用のメリット
1. **比較可能性**: 異なるパイプライン（P01 vs P02）での出力を同じフォルダで安全に比較できる。
2. **情報の継承**: 前のステージで決めた「照明状態」などを、最終的なエディタ JSON に正確に反映できる。
3. **デバッグ効率**: ファイル名を見るだけで、どの工程で生成されたものか即座に特定できる。

---
*本仕様は docs/10_ai_docs/2026/03/09/ の 01〜10 を統合・拡張するものである。*
