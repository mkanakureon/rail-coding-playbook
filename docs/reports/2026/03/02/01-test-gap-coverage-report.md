# テストギャップ解消レポート

**日付:** 2026-03-02
**コミット:** `e0b04dc`
**対象:** OpRunner / preview.ts / useEditorStore.ts

---

## 背景

テスト評価報告書 (`23-TEST_EVALUATION_REPORT.md`) の指摘を受け、パイプライン全層のテストギャップを調査・解消した。

**調査で判明した問題:**
- OpRunner: 35 Op 中 7 Op が単体テスト未実装
- preview.ts (`generateKSCScript`): effect / screen_filter / overlay ブロックが未テスト
- useEditorStore.ts: `buildPageScript` / `buildSnapshotScript` のカバレッジが極めて低い
- **バグ発見**: `buildPreviewScript` に overlay サポートが欠落（`buildPageScript` にはある）

---

## 実施内容

### Phase D: buildPreviewScript overlay バグ修正

| 項目 | 内容 |
|------|------|
| ファイル | `apps/editor/src/store/useEditorStore.ts` |
| 内容 | `buildPreviewScript` の switch 文に `case 'overlay':` を追加 |
| 影響 | プレビュー全体再生時に overlay が無視されるバグを修正 |

`buildPageScript` (L731-732) には overlay 処理があったが、`buildPreviewScript` (L429-591) には存在しなかった。

### Phase A: OpRunner テスト追加

| 項目 | 内容 |
|------|------|
| ファイル | `packages/core/test/OpRunner.test.ts` |
| 追加テスト数 | 21 件（7 Op × 3 パターン） |

**対象 Op と各テストパターン:**

| Op | 引数あり | デフォルト | handler 未実装 |
|----|---------|-----------|--------------|
| OVERLAY_SET | `overlaySet("rain", 300)` | `overlaySet("fog", undefined)` | pc === 1 |
| OVERLAY_HIDE | `overlayHide("rain", 200)` | `overlayHide(undefined, undefined)` | pc === 1 |
| FLASH | `flash(200)` | `flash(undefined)` | pc === 1 |
| FADE_BLACK | `fadeBlack(1000)` | `fadeBlack(undefined)` | pc === 1 |
| FADE_WHITE | `fadeWhite(800)` | `fadeWhite(undefined)` | pc === 1 |
| BLACK_IN | `blackIn(600)` | `blackIn(undefined)` | pc === 1 |
| WHITE_IN | `whiteIn(700)` | `whiteIn(undefined)` | pc === 1 |

### Phase B: preview.test.ts テスト追加

| 項目 | 内容 |
|------|------|
| ファイル | `apps/hono/test/preview.test.ts` |
| 追加テスト数 | 18 件 |

| グループ | テスト数 | 内容 |
|---------|---------|------|
| B-1: effect ブロック | 9 | shake, flash, fade_black/white, black_in/white_in, vignette, blur, duration デフォルト |
| B-2: screen_filter | 2 | filterType あり → `@filter`, なし → `@filter_clear` |
| B-3: overlay | 3 | visible=true, visible=false, assetId 空ガード |
| B-4: if 内ネスト | 2 | text + @l, overlay / overlay_hide |
| B-5: choice condition | 1 | `"text" if (condition) { ... }` |

### Phase C: store.test.ts テスト追加

| 項目 | 内容 |
|------|------|
| ファイル | `apps/editor/test/store.test.ts` |
| 追加テスト数 | 25 件 |

**C-1: buildPreviewScript（+10 件）**

effect (shake/flash), screen_filter, overlay (visible/hidden), set_var, battle, timeline, ksc

**C-2: buildPageScript（+8 件）**

bg, ch (visible/hidden), text, overlay (visible/hidden), effect, screen_filter

**C-3: buildSnapshotScript（+7 件）**

| テスト | 検証内容 |
|-------|---------|
| character 状態蓄積 | 同キャラの複数 ch → 最終 pose のみ出力 |
| overlay 表示 | visible=true → `@overlay` 出力 |
| overlay 非表示 | visible→hidden → 出力なし |
| filter 蓄積 | `@filter sepia 0.8` 出力 |
| effect 蓄積 | `@wait 0.1` + `@shake` 出力 |
| timeline 蓄積 | 複数 timeline → 全件出力 |
| ch 上書き | 同キャラ pose 変更 → 最新のみ |

---

## テスト結果

| テストファイル | 変更前 | 変更後 | 結果 |
|--------------|--------|--------|------|
| `packages/core/test/OpRunner.test.ts` | 52 | 73 | ALL PASS |
| `apps/hono/test/preview.test.ts` | 22 | 40 | ALL PASS |
| `apps/editor/test/store.test.ts` | 59 | 84 | ALL PASS |
| **合計** | **133** | **197** | **+64 件** |

```
npm test -w @kaedevn/core    → 167 passed (7 files)
vitest run preview.test.ts   → 40 passed
vitest run store.test.ts     → 84 passed
```

---

## 変更ファイル一覧

| ファイル | 操作 | Phase |
|---------|------|-------|
| `apps/editor/src/store/useEditorStore.ts` | バグ修正（+3行） | D |
| `packages/core/test/OpRunner.test.ts` | テスト追加（+198行） | A |
| `apps/hono/test/preview.test.ts` | テスト追加（+186行） | B |
| `apps/editor/test/store.test.ts` | テスト追加（+370行） | C |

---

## スコープ外（未実施）

- **WebOpHandler 単体テスト**: PixiJS モック大量必要、E2E でカバー済み
- **KS compiler への ch_move / wait_voice_end 追加**: テストではなく機能追加に該当
- **Visual Regression Testing**: インフラ整備が必要、別タスク
