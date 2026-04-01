# テストギャップ解消 実装計画書

**日付:** 2026-03-02
**ステータス:** 完了
**関連レポート:** `01-test-gap-coverage-report.md`

---

## 1. 背景・目的

テスト評価報告書 (`23-TEST_EVALUATION_REPORT.md`) で指摘されたテストギャップを解消する。
コマンドレジストリ（Phase 1-2）は実装済みだが、パイプラインの他の層に未テスト領域が残っている。

**調査結果:**
- OpRunner: 35 Op 中 7 Op が単体テスト未実装
- preview.ts (`generateKSCScript`): effect / screen_filter / overlay ブロックが未テスト
- useEditorStore.ts: `buildPageScript` / `buildSnapshotScript` のカバレッジが極めて低い
- **バグ発見**: `buildPreviewScript` に overlay サポートが欠落（`buildPageScript` にはある）

---

## 2. 実装計画

### Phase D: buildPreviewScript overlay バグ修正（最優先）

`buildPreviewScript` の switch 文に `case 'overlay':` が欠落。`buildPageScript` には存在するため、コピーして追加。

| 項目 | 内容 |
|------|------|
| ファイル | `apps/editor/src/store/useEditorStore.ts` |
| 修正量 | +3行 |
| リスク | 低（既存コードのパターン踏襲） |

```typescript
case 'overlay':
  if (!block.assetId) return '';
  return block.visible ? `@overlay ${block.assetId}` : `@overlay_hide ${block.assetId}`;
```

### Phase A: OpRunner 不足テスト追加

7 Op × 3 パターン = 21 テスト追加。

| 項目 | 内容 |
|------|------|
| ファイル | `packages/core/test/OpRunner.test.ts` |
| 依存 | なし（独立実行可） |

**対象 Op:**

| Op | handler メソッド | 引数 |
|----|-----------------|------|
| OVERLAY_SET | `overlaySet(id, fadeMs)` | id: string, fadeMs?: number |
| OVERLAY_HIDE | `overlayHide(id, fadeMs)` | id?: string, fadeMs?: number |
| FLASH | `flash(durationMs)` | durationMs?: number |
| FADE_BLACK | `fadeBlack(durationMs)` | durationMs?: number |
| FADE_WHITE | `fadeWhite(durationMs)` | durationMs?: number |
| BLACK_IN | `blackIn(durationMs)` | durationMs?: number |
| WHITE_IN | `whiteIn(durationMs)` | durationMs?: number |

**各 Op のテストパターン:**
1. 引数ありで handler メソッドに正しい値が渡ること
2. 引数なし（デフォルト）で handler が呼ばれること
3. handler が未実装（optional）の場合にエラーなく pc がインクリメントされること

**実装方針:** 既存テスト `SHAKE` / `SCREEN_FILTER` のパターンに合わせる（spy + toHaveBeenCalledWith）

### Phase B: preview.test.ts 不足テスト追加

`generateKSCScript` の 14 ブロックタイプ中、effect / screen_filter / overlay が未テスト。18 テスト追加。

| 項目 | 内容 |
|------|------|
| ファイル | `apps/hono/test/preview.test.ts` |
| 依存 | なし（独立実行可） |

**B-1: effect ブロック（9テスト）**

| サブタイプ | 期待出力 |
|-----------|---------|
| shake | `@shake {intensity} {duration}` |
| flash | `@flash {duration}` |
| fade_black | `@fade_black {duration}` |
| fade_white | `@fade_white {duration}` |
| black_in | `@black_in {duration}` |
| white_in | `@white_in {duration}` |
| vignette | `@filter vignette {intensity/5}` |
| blur | `@filter focusBlur {intensity/5}` |
| duration 省略 | デフォルト 500 が適用されること |

**B-2: screen_filter ブロック（2テスト）**

| ケース | 期待出力 |
|-------|---------|
| filterType あり | `@filter {filterType} {intensity}` |
| filterType なし/null | `@filter_clear` |

**B-3: overlay ブロック（3テスト）**

| ケース | 期待出力 |
|-------|---------|
| visible=true | `@overlay {assetId}` |
| visible=false | `@overlay_hide {assetId}` |
| assetId 空 | 空文字列（ガード） |

**B-4: if ブロック内のネストブロック（2テスト）**

| ケース | 検証内容 |
|-------|---------|
| if 内の text | テキスト + `@l` が生成されること |
| if 内の overlay | `@overlay` / `@overlay_hide` が生成されること |

**B-5: choice オプションの condition（1テスト）**

| ケース | 検証内容 |
|-------|---------|
| condition あり | `"text" if (condition) { ... }` が生成されること |

### Phase C: store.test.ts 不足テスト追加

buildPreviewScript / buildPageScript / buildSnapshotScript のカバレッジ向上。25 テスト追加。
Phase D の修正後に実施（overlay テストが修正を前提とするため）。

| 項目 | 内容 |
|------|------|
| ファイル | `apps/editor/test/store.test.ts` |
| 依存 | Phase D 完了後 |

**C-1: buildPreviewScript 追加テスト（10件）**

| ブロック | 期待出力 |
|---------|---------|
| effect (shake) | `@shake {intensity} {duration}` |
| effect (flash) | `@flash {duration}` |
| screen_filter | `@filter {filterType} {intensity}` |
| screen_filter (null) | `@filter_clear` |
| overlay (visible) | `@overlay {assetId}` |
| overlay (hidden) | `@overlay_hide {assetId}` |
| set_var | `{varName} {operator} {value}` |
| battle | `@battle {troopId} onWin={...} onLose={...}` |
| timeline | `@timeline_play {id}` |
| ksc | `block.script` をそのまま出力 |

**C-2: buildPageScript 追加テスト（8件）**

| ブロック | 期待出力 |
|---------|---------|
| bg | `@bg {slug}` |
| ch (visible) | `@ch {slug} {expr} {pos}` |
| ch (hidden) | `@ch_hide {slug}` |
| text | テキスト + `@l` |
| overlay (visible) | `@overlay {assetId}` |
| overlay (hidden) | `@overlay_hide {assetId}` |
| effect | `@shake {intensity} {duration}` |
| screen_filter | `@filter {filterType} {intensity}` |

**C-3: buildSnapshotScript 追加テスト（7件）**

| テスト | 検証内容 |
|-------|---------|
| character 状態蓄積 | 同キャラ複数 ch → 最終状態の `@ch` のみ出力 |
| overlay 状態蓄積 | visible=true → `@overlay` 出力 |
| overlay 非表示 | visible→hidden → 出力されないこと |
| filter 状態蓄積 | `@filter` 出力 |
| effect 状態蓄積 | `@wait 0.1` + effect コマンド出力 |
| timeline 蓄積 | 複数 timeline → 全 `@timeline_play` 出力 |
| ch 上書き | 同キャラ pose 変更 → 最新 pose で出力 |

---

## 3. 実装順序

```
D → A → B → C
│    │    │    └─ Phase D の修正に依存
│    │    └────── 独立（Phase A と並行可）
│    └─────────── 独立（Phase B と並行可）
└──────────────── 最小修正（1行追加）、最優先
```

- Phase D: 小さいバグ修正（3行追加）を最初に実施
- Phase A, B: 独立して並行実施可能
- Phase C: Phase D の修正後に実施（overlay テストが修正を前提）

---

## 4. 対象ファイル一覧

| ファイル | 操作 | Phase |
|---------|------|-------|
| `apps/editor/src/store/useEditorStore.ts` | バグ修正 | D |
| `packages/core/test/OpRunner.test.ts` | テスト追加 | A |
| `apps/hono/test/preview.test.ts` | テスト追加 | B |
| `apps/editor/test/store.test.ts` | テスト追加 | C |

---

## 5. 検証手順

```bash
# Phase A: OpRunner テスト
npm test -w @kaedevn/core

# Phase B: preview テスト
npx vitest run apps/hono/test/preview.test.ts

# Phase C: store テスト
npx vitest run apps/editor/test/store.test.ts

# 型チェック
npx tsc --noEmit
```

---

## Phase E: WebOpHandler bg_new / ch_new テスト

**ステータス:** 完了
**背景:** `31-BG_NEW_IMPLEMENTATION_PLAN.md` / `33-CHARACTER_REPLACEMENT_SPEC.md` の実装に対するテスト

| 項目 | 内容 |
|------|------|
| ファイル | `packages/web/test/WebOpHandler.bgch.test.ts`（新規） |
| テスト数 | 17 件（bg_new: 7, ch_new: 10） |
| モック | PixiJS (Container/Sprite/Graphics/Text/Assets), fadeTo, lerpPosition, ScreenFilter, Logger, battle |

### E-1: bg_new テスト（7件）

| テスト | 検証内容 |
|-------|---------|
| bgSet (fadeMs=0) | bg が backgroundLayer に配置される |
| bgSet (cross-fade) | bg_new が backgroundLayer に配置（characterLayer ではない） |
| bgSet (cross-fade) 昇格 | sprites から bg_new が消え bg に昇格 |
| bgSet (cross-fade) fadeTo | 旧背景(→0) と新背景(→1) 両方で呼ばれる |
| bgSet 連続呼び出し | 残存 bg_new が強制削除される |
| bgClear | bg_new も安全に消去される |
| bgSet (slide_left) | bg_new が backgroundLayer に配置される |

### E-2: ch_new テスト（10件）

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

### モック方針

PixiJS はブラウザ API に依存するため、`vi.hoisted` + `vi.mock` でモジュール全体を差し替え。
`loadPremultiplied` は `fetch` / `createImageBitmap` を使うためインスタンスメソッドをモック。
`fadeTo` / `lerpPosition` は即座に完了する同期モックで遷移後の状態を検証。

```bash
# Phase E: WebOpHandler bg_new / ch_new テスト
npx vitest run packages/web/test/WebOpHandler.bgch.test.ts
```

---

## 6. スコープ外（今回は実施しない）

| 項目 | 理由 |
|------|------|
| KS compiler ch_move / wait_voice_end | テスト追加ではなく機能追加に該当 |
| Visual Regression Testing | インフラ整備が必要、別タスク |
