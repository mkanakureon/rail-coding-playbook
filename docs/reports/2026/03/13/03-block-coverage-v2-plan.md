# block-coverage v2 計画書

**作成日**: 2026-03-13
**前提**: `02-block-coverage-test-postmortem.md` の反省を踏まえた再設計

---

## 構成: 2本柱

| 柱 | 方式 | 目的 |
|----|------|------|
| **A. API + JSON テスト** | API で保存・読戻し + コンパイラ変換 | データ構造の整合性・変換の正確性 |
| **B. プレスリリース方式テスト** | エディタ UI でブロック追加 → プレビュー再生 | 実際のユーザー操作で動くか |

A は既存の Phase 1 + Phase 2 を改善。
B は新規作成。**分類ごとに独立した録画テスト**にする。

---

## A. API + JSON テスト（既存改善）

### 改善点（ポストモーテムの対策）

| 問題 | 対策 |
|------|------|
| `toBeDefined()` で逃げてた | 具体的な値を検証する |
| `ksc` ブロックが未検出 | 全ブロック型の出力存在を明示的に検証 |
| 入力と出力の対応なし | ブロック数 vs コマンド数を検証 |

### ファイル構成（変更なし）

```
tests/block-coverage/
├── phase1-api/api-save-load.spec.ts      ← expect 強化
├── phase2-compiler/blocks-to-ksc.test.ts ← ksc ブロック・出力網羅性追加
```

### Phase 2 追加テスト

- `ksc` ブロック: `generateKSCScript` で `default` に落ちて空文字になる問題を検出するテスト
- 全ブロック出力網羅: 14ブロック入力 → 出力に全型のコマンドが含まれるか検証
- Page 遷移フロー: Page 1 末尾に遷移なし → 検出するテスト

---

## B. プレスリリース方式テスト（新規）

### 原則

- **エディタ UI を使ってブロックを追加する**（API PUT ではない）
- **プレビューでシナリオが完走するまで確認する**（`completed=true` を expect）
- **分類ごとに独立したテストファイル**（1ファイル = 1カテゴリ = 1動画）
- **録画対応**（`playwright.recording.config.ts` で動画自動生成）

### ブロック分類

| # | カテゴリ | ブロック型 | テストファイル |
|---|---------|-----------|--------------|
| 1 | 基本表示 | `bg`, `ch`, `text`, `overlay` | `rec-basic-display.spec.ts` |
| 2 | 演出 | `effect`, `screen_filter`, `camera` | `rec-effects.spec.ts` |
| 3 | ロジック | `choice`, `if`, `set_var`, `jump` | `rec-logic.spec.ts` |
| 4 | 特殊 | `timeline`, `battle`, `ksc` | `rec-special.spec.ts` |

### ディレクトリ構成

```
tests/block-coverage/
├── (既存)
├── phase1-api/
├── phase2-compiler/
├── phase3-browser/          ← 削除 or 残す（プレスリリース方式に置き換え）
│
├── press/                   ← 新規: プレスリリース方式テスト
│   ├── helpers/
│   │   └── editor-actions.ts  ← エディタ UI 操作の共通関数
│   ├── rec-basic-display.spec.ts
│   ├── rec-effects.spec.ts
│   ├── rec-logic.spec.ts
│   └── rec-special.spec.ts
```

### 共通ヘルパー: `editor-actions.ts`

プレスリリース方式の録画テスト（`bg-showcase.spec.ts` 等）から抽出した、エディタ UI 操作の共通関数。

```typescript
// ログイン → エディタを開く
async function openEditor(page, request, projectId): Promise<string>

// ブロック追加（+ ボタン → bottom-sheet → 型選択）
async function addBlock(page, blockType: string): Promise<void>

// 背景選択（「変更」→ 公式 → ファンタジー → 画像選択 → 確定）
async function selectBgAsset(page, index: number): Promise<void>

// テキスト入力
async function fillText(page, body: string, speaker?: string): Promise<void>

// ページタブ切替
async function switchPage(page, pageName: string): Promise<void>

// 全ブロック順番クリック
async function clickAllBlocks(page, pause: number): Promise<number>

// プレビュー遷移 → 「はじめから」→ シナリオ完走
async function runPreview(page, projectId: string): Promise<{ completed: boolean; clicks: number }>
```

### 各テストの詳細

---

#### 1. `rec-basic-display.spec.ts` — 基本表示

**追加するブロック:**
1. `bg` — 公式ファンタジー背景を選択
2. `ch` — キャラクター表示（公式キャラ選択）
3. `text` — speaker 付きテキスト
4. `text` — 地の文（speaker なし）
5. `overlay` — オーバーレイ画像表示
6. `overlay` — オーバーレイ非表示

**プレビュー検証:**
- 背景が表示される
- キャラが表示される
- テキストが表示される（2回クリックで2つのテキスト）
- シナリオ完走 (`completed=true`)

**想定テスト時間:** 約2分

---

#### 2. `rec-effects.spec.ts` — 演出

**追加するブロック:**
1. `bg` — 背景（演出のベース）
2. `text` — 「エフェクトテスト開始」
3. `effect` (shake) — 画面揺れ
4. `text` — 「シェイク完了」
5. `effect` (flash) — 画面フラッシュ
6. `text` — 「フラッシュ完了」
7. `screen_filter` (sepia) — セピアフィルタ
8. `text` — 「セピア適用中」
9. `screen_filter` (クリア) — フィルタ解除
10. `camera` (ズーム) — カメラズーム
11. `text` — 「カメラズーム完了」
12. `camera` (リセット) — カメラリセット

**プレビュー検証:**
- 各エフェクト後にテキストが表示される（停止しないことを確認）
- シナリオ完走 (`completed=true`)

**想定テスト時間:** 約3分

---

#### 3. `rec-logic.spec.ts` — ロジック

**追加するブロック:**
1. `bg` — 背景
2. `set_var` — `score = 0`
3. `choice` — 2択（「A: score += 10」「B: score += 5」）
4. `text` — 「選択完了」
5. `set_var` — `score += 100`
6. `if` — `score >= 100` → then: text「高スコア！」/ else: text「低スコア」
7. `text` — 「ロジックテスト完了」

**ページ2 追加:**（jump の検証用）
8. Page 2 を追加
9. Page 1 末尾に `jump` → Page 2
10. Page 2 に `text` — 「Page 2 に到着！」

**プレビュー検証:**
- 選択肢が表示される
- 選択後にテキストが進む
- if 分岐でどちらかのテキストが表示される
- jump で Page 2 に遷移する
- シナリオ完走 (`completed=true`)

**想定テスト時間:** 約3分

---

#### 4. `rec-special.spec.ts` — 特殊

**追加するブロック:**
1. `bg` — 背景
2. `text` — 「特殊ブロックテスト」
3. `ksc` — 生スクリプト（`テスト文章\n@l`）
4. `text` — 「KSC ブロック通過」
5. `timeline` — タイムライン（空 or 最小構成）
6. `text` — 「タイムライン通過」
7. `battle` — バトル（※エラーで停止する可能性あり → 検証）
8. `text` — 「全テスト完了！」

**プレビュー検証:**
- ksc ブロックのテキストが表示される
- timeline を通過できる（空なら即通過するはず）
- battle の挙動を記録（停止するならそれを文書化）
- 到達可能な最後のテキストまで進む

**想定テスト時間:** 約2分

**注意:** battle と timeline は未実装・不完全の可能性がある。このテストの目的は「動くか動かないかを正確に記録する」こと。

---

## 実行方法

```bash
# A. API + コンパイラテスト（サーバー必要 / 不要）
npx playwright test tests/block-coverage/phase1-api/ \
  --config=tests/block-coverage/playwright.block-coverage.config.ts
npx vitest run tests/block-coverage/phase2-compiler/

# B. プレスリリース方式（ヘッドレス — 検証用）
npx playwright test tests/block-coverage/press/ \
  --config=tests/block-coverage/playwright.block-coverage.config.ts

# B. プレスリリース方式（録画付き — 動画生成）
npx playwright test tests/block-coverage/press/ \
  --config=tests/configs/playwright.recording.config.ts

# 個別カテゴリだけ実行
npx playwright test tests/block-coverage/press/rec-basic-display.spec.ts \
  --config=tests/configs/playwright.recording.config.ts
```

---

## 成功基準

### A. API + JSON テスト

- [ ] Phase 1: 全ブロック型の保存・復元が正しい（既存19テスト + expect 強化）
- [ ] Phase 2: 全ブロック型が KSC 出力に反映される（`ksc` ブロック含む）
- [ ] Phase 2: Page 間の遷移フローが正しい

### B. プレスリリース方式テスト

- [ ] `rec-basic-display`: bg + ch + text + overlay → プレビュー完走
- [ ] `rec-effects`: effect + screen_filter + camera → プレビュー完走
- [ ] `rec-logic`: choice + if + set_var + jump → プレビュー完走（Page 遷移含む）
- [ ] `rec-special`: ksc + timeline + battle → 動作記録（完走 or 停止箇所を文書化）
- [ ] 各テストで `completed=true` を `expect` する（rec-special は例外あり）
- [ ] 各テストで録画動画が生成される

---

## 実装順

| 順番 | 作業 | 理由 |
|------|------|------|
| 1 | `press/helpers/editor-actions.ts` | 全テストの共通基盤 |
| 2 | `rec-basic-display.spec.ts` | 最もシンプル。ヘルパーの動作確認を兼ねる |
| 3 | `rec-effects.spec.ts` | 演出系。基本表示の上に積む |
| 4 | `rec-logic.spec.ts` | ロジック系。ページ追加・jump を含む |
| 5 | `rec-special.spec.ts` | 特殊系。未実装の発見を含む |
| 6 | Phase 1 + Phase 2 の expect 強化 | B の結果を踏まえて修正 |

---

## 既存 Phase 3 の扱い

`phase3-browser/preview-playback.spec.ts` は **削除**する。
理由: プレスリリース方式テストがブラウザ検証を完全に上位互換する。
API PUT でデータを入れて「Canvas が表示される」だけ見るテストは、ポストモーテムで指摘した「存在確認だけ」の典型。
