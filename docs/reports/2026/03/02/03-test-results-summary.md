# テスト結果報告書（2026-03-02 総括）

**日付:** 2026-03-02
**最終コミット:** `718b460`
**ステータス:** 全テスト通過

---

## 1. 概要

本日実施した全テスト拡充・バグ修正・新機能テストの総括報告書。
テスト評価報告書 (`23-TEST_EVALUATION_REPORT.md`) の指摘を起点に、パイプライン全層のテストギャップを解消し、さらに新機能（bg_new / ch_new）の単体テストも追加した。

---

## 2. 実施フェーズと結果

### Phase D: buildPreviewScript overlay バグ修正

| 項目 | 内容 |
|------|------|
| コミット | `e0b04dc` |
| ファイル | `apps/editor/src/store/useEditorStore.ts` |
| 内容 | `buildPreviewScript` の switch 文に `case 'overlay':` を追加 |
| 影響 | プレビュー全体再生時に overlay が無視されるバグを修正 |
| 修正量 | +3行 |

### Phase A: OpRunner テスト追加（+21件）

| 項目 | 内容 |
|------|------|
| コミット | `e0b04dc` |
| ファイル | `packages/core/test/OpRunner.test.ts` |

| Op | 引数あり | デフォルト | handler 未実装 |
|----|---------|-----------|--------------|
| OVERLAY_SET | `overlaySet("rain", 300)` | `overlaySet("fog", undefined)` | pc === 1 |
| OVERLAY_HIDE | `overlayHide("rain", 200)` | `overlayHide(undefined, undefined)` | pc === 1 |
| FLASH | `flash(200)` | `flash(undefined)` | pc === 1 |
| FADE_BLACK | `fadeBlack(1000)` | `fadeBlack(undefined)` | pc === 1 |
| FADE_WHITE | `fadeWhite(800)` | `fadeWhite(undefined)` | pc === 1 |
| BLACK_IN | `blackIn(600)` | `blackIn(undefined)` | pc === 1 |
| WHITE_IN | `whiteIn(700)` | `whiteIn(undefined)` | pc === 1 |

### Phase B: preview.test.ts テスト追加（+18件）

| 項目 | 内容 |
|------|------|
| コミット | `e0b04dc` |
| ファイル | `apps/hono/test/preview.test.ts` |

| グループ | テスト数 | 内容 |
|---------|---------|------|
| B-1: effect ブロック | 9 | shake, flash, fade_black/white, black_in/white_in, vignette, blur, duration デフォルト |
| B-2: screen_filter | 2 | filterType あり → `@filter`, なし → `@filter_clear` |
| B-3: overlay | 3 | visible=true, visible=false, assetId 空ガード |
| B-4: if 内ネスト | 2 | text + @l, overlay / overlay_hide |
| B-5: choice condition | 1 | `"text" if (condition) { ... }` |

### Phase C: store.test.ts テスト追加（+25件）

| 項目 | 内容 |
|------|------|
| コミット | `e0b04dc` |
| ファイル | `apps/editor/test/store.test.ts` |

| グループ | テスト数 | 内容 |
|---------|---------|------|
| C-1: buildPreviewScript | 10 | effect, screen_filter, overlay, set_var, battle, timeline, ksc |
| C-2: buildPageScript | 8 | bg, ch (visible/hidden), text, overlay, effect, screen_filter |
| C-3: buildSnapshotScript | 7 | character 蓄積, overlay 表示/非表示, filter, effect, timeline, ch 上書き |

### Phase E: WebOpHandler bg_new / ch_new テスト（+17件）

| 項目 | 内容 |
|------|------|
| コミット | `718b460` |
| ファイル | `packages/web/test/WebOpHandler.bgch.test.ts`（新規作成） |
| 前提 | bg_new 修正 (`f304e3d`) + ch_new 実装 (`e6d3a67`) |

**E-1: bg_new テスト（7件）**

| テスト | 検証内容 |
|-------|---------|
| bgSet (fadeMs=0) | bg が backgroundLayer に配置される |
| bgSet (cross-fade) | bg_new が backgroundLayer に配置（characterLayer ではない） |
| bgSet (cross-fade) 昇格 | sprites から bg_new が消え bg に昇格 |
| bgSet (cross-fade) fadeTo | 旧背景(→0) と新背景(→1) 両方で呼ばれる |
| bgSet 連続呼び出し | 残存 bg_new が強制削除される |
| bgClear | bg_new も安全に消去される |
| bgSet (slide_left) | bg_new が backgroundLayer に配置される |

**E-2: ch_new テスト（10件）**

| テスト | 検証内容 |
|-------|---------|
| chSet (新規) | characterLayer に配置される |
| chSet (同ポジション別キャラ) | クロスフェードで入れ替え（fadeTo 2回） |
| chSet (同ポジション別キャラ) 昇格 | ch_new が消えキャラ名に昇格、旧キャラ削除 |
| chSet (同ポジション別キャラ) 状態 | currentCharacters が正しく更新 |
| chSet (異なるポジション) | クロスフェードなし（両方共存） |
| chSet (同キャラ表情変更) | クロスフェードではなく通常の show |
| chSet 連続呼び出し | 残存 ch_new が強制削除される |
| chHide | ch_new も安全に消去される |
| chClear | ch_new も安全に消去される |
| 3ポジション同時 | 中央だけ入れ替え、左右は影響なし |

**モック方針:**
- PixiJS は `vi.hoisted()` + `vi.mock` でモジュール全体を差し替え
- `loadPremultiplied` はインスタンスメソッドをモック（Node 環境に `fetch` がないため）
- `fadeTo` / `lerpPosition` は即座に完了する同期モックで遷移後の状態を検証

---

## 3. テスト結果サマリ

### テスト数の推移

| テストファイル | 変更前 | 変更後 | 増加 |
|--------------|--------|--------|------|
| `packages/core/test/OpRunner.test.ts` | 52 | 73 | +21 |
| `apps/hono/test/preview.test.ts` | 22 | 40 | +18 |
| `apps/editor/test/store.test.ts` | 59 | 84 | +25 |
| `packages/web/test/WebOpHandler.bgch.test.ts` | 0 (新規) | 17 | +17 |
| **合計** | **133** | **214** | **+81** |

### 実行結果

```
npm test -w @kaedevn/core                              → 167 passed (7 files)
npx vitest run apps/hono/test/preview.test.ts          →  40 passed
npx vitest run apps/editor/test/store.test.ts          →  84 passed
npx vitest run packages/web/test/WebOpHandler.bgch.test.ts →  17 passed
```

全テスト **ALL PASS**。失敗・スキップなし。

---

## 4. バグ修正・機能実装

| コミット | 種別 | 内容 |
|---------|------|------|
| `e0b04dc` | fix | `buildPreviewScript` に overlay case 追加 |
| `f304e3d` | fix | `bg_new` を backgroundLayer に配置（characterLayer に混入していた） |
| `e6d3a67` | feat | キャラクター入れ替えクロスフェード（ch_new 方式）の実装 |

---

## 5. コミット一覧

| コミット | メッセージ |
|---------|----------|
| `e0b04dc` | test: OpRunner・preview・storeのテストギャップを埋め、buildPreviewScriptのoverlayバグを修正 |
| `6d79e8c` | docs: テストギャップ解消レポート追加 |
| `f304e3d` | fix: bg_new を backgroundLayer に配置し、背景遷移中のキャラ隠れ・スプライト蓄積を修正 |
| `d522450` | docs: テストギャップ解消 実装計画書を追加 |
| `e6d3a67` | feat: キャラクター入れ替え時のクロスフェード（ch_new 方式）を実装 |
| `718b460` | test: WebOpHandler bg_new/ch_new の単体テスト追加（17件） |

---

## 6. 変更ファイル一覧

| ファイル | 操作 | Phase |
|---------|------|-------|
| `apps/editor/src/store/useEditorStore.ts` | バグ修正（+3行） | D |
| `packages/core/test/OpRunner.test.ts` | テスト追加（+198行） | A |
| `apps/hono/test/preview.test.ts` | テスト追加（+186行） | B |
| `apps/editor/test/store.test.ts` | テスト追加（+370行） | C |
| `packages/web/src/renderer/WebOpHandler.ts` | バグ修正 + 機能追加 | E |
| `packages/web/test/WebOpHandler.bgch.test.ts` | テスト新規作成（17件） | E |

---

## 7. 残課題（スコープ外）

| 項目 | 理由 |
|------|------|
| KS compiler ch_move / wait_voice_end | テスト追加ではなく機能追加に該当 |
| Visual Regression Testing | インフラ整備が必要、別タスク |
