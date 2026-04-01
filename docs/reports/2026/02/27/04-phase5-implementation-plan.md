# Phase 5 実装計画: キャラ移動 + スクリーンショット + イージング + トランジション拡張

**作成日**: 2026-02-27
**ベースライン**: Phase 4 完了 (8a3aa69) — サムネイル・ギャラリーUnlock・シェイク・KSCフィルタ対応実装済み

---

## 実装済み機能の整理

| Phase | 実装内容 |
|-------|---------|
| Phase 1 | バックログ、セーブロード + ビジュアル復元 |
| Phase 2 | フェードトランジション（bg/ch/bgm）、waitVoiceEnd、メニュー Log ボタン |
| Phase 3 | skipMode 演出無効化、autoMode 音声連動+文字数待機、スクリーンフィルター |
| Phase 4 | セーブサムネイル、ギャラリーUnlock、画面シェイク、KSC filter/shake コンパイラ対応 |

## Phase 5 で対応する項目

文書精査 (docs/10_ai_docs) と現コードベースの未実装箇所から抽出。ブラウザ (PixiJS) で即実装可能なものに限定。

---

### Phase 5-1: キャラクター移動アニメーション (`moveChar`)

**根拠**: KscHostAdapter.ts:232 で `moveChar: IOpHandler has no move method; ignoring` と警告。KSC スクリプトの `moveChar(name, position, time)` が無効化されている。

**現状**: builtins.ts に moveChar シグネチャあり、KscHostAdapter にディスパッチあり（警告で無視）。IOpHandler に対応メソッドなし。Op 型に CH_MOVE なし。

**方針**: fadeTo.ts と同じ Ticker ベースの線形補間ユーティリティで position を lerp。

**新規ファイル**: `packages/web/src/renderer/lerpPosition.ts`

```typescript
export function lerpPosition(
  target: Container,
  toX: number,
  toY: number,
  durationMs: number,
  ticker: Ticker,
): Promise<void>
```
- 既存の fadeTo.ts と同構造
- `durationMs <= 0` は即座に position を設定して resolve

**変更ファイル**:

1. **`packages/core/src/types/Op.ts`**
   - `{ op: "CH_MOVE"; name: string; pos: "left" | "center" | "right"; durationMs: number }` 追加

2. **`packages/core/src/engine/IOpHandler.ts`**
   - `chMove?(name: string, pos: "left" | "center" | "right", durationMs: number): Promise<void>` 追加

3. **`packages/core/src/engine/OpRunner.ts`**
   - `case "CH_MOVE":` ハンドリング追加

4. **`packages/web/src/renderer/WebOpHandler.ts`**
   - `chMove()` 実装: sprites Map から対象キャラを取得 → lerpPosition で目標位置まで移動
   - 位置計算: left=320, center=640, right=960（chSet と同じ）
   - skipMode 時は durationMs=0 で即座に移動

5. **`packages/web/src/engine/KscHostAdapter.ts`**
   - `moveChar` ケースを修正: 警告ではなく `handler.chMove()` を呼ぶ

---

### Phase 5-2: スクリーンショット保存

**根拠**: 63-SCREENSHOT_FEATURE_SPEC.md、商用 VN の基本機能

**現状**: `captureThumbnail()` で renderer.extract のインフラは整っているが、ユーザー操作でスクリーンショットを保存する機能がない。

**方針**: `P` キー or 専用ボタンで PNG をダウンロード。

**変更ファイル**:

1. **`packages/core/src/types/Action.ts`**
   - `Screenshot` アクション追加

2. **`packages/web/src/input/InputManager.ts`**
   - `P` キーに `Action.Screenshot` をマッピング

3. **`packages/web/src/renderer/WebOpHandler.ts`**
   - `captureScreenshot(): Promise<void>` メソッド追加
   - `renderer.extract.canvas(layers.root)` → `canvas.toBlob("image/png")` → `<a download>` で自動ダウンロード
   - ファイル名: `screenshot_YYYYMMDD_HHMMSS.png`

4. **`packages/web/src/renderer/ui/GameUI.ts`**
   - `Action.Screenshot` リスナー追加 → `handler.captureScreenshot()` 呼び出し

---

### Phase 5-3: イージング関数の導入

**根拠**: fadeTo / shake / lerpPosition が全て線形補間。VN としてはイーズイン・アウトが自然。

**現状**: fadeTo.ts は elapsed/duration の線形比率のみ。

**方針**: 最小限のイージング関数セットを用意し、fadeTo / lerpPosition / shake に適用可能にする。

**新規ファイル**: `packages/web/src/renderer/easing.ts`

```typescript
export type EasingFn = (t: number) => number;

export const linear: EasingFn = (t) => t;
export const easeInOut: EasingFn = (t) => t < 0.5
  ? 2 * t * t
  : 1 - (-2 * t + 2) ** 2 / 2;
export const easeIn: EasingFn = (t) => t * t;
export const easeOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
```

**変更ファイル**:

1. **`packages/web/src/renderer/fadeTo.ts`**
   - `easing?: EasingFn` パラメータ追加（デフォルト: `easeInOut`）
   - 既存の `progress = elapsed / durationMs` に easing 適用

2. **`packages/web/src/renderer/lerpPosition.ts`**（5-1 で新規作成）
   - `easing?: EasingFn` パラメータ追加（デフォルト: `easeInOut`）

3. **`packages/web/src/renderer/shake.ts`**
   - intensity を duration 末尾に向けてフェードアウト（`easeOut` 固定）

---

### Phase 5-4: 背景トランジション拡張（スライド）

**根拠**: 49-ADVANCED_TRANSITION_SHADER_DESIGN.md、31-VN_PLATFORM_GAP_ANALYSIS §2.2。現在はクロスフェード (alpha) のみ。

**現状**: bgSet の `effect` 引数は `"fade"` のみ対応。`"slide_left"` / `"slide_right"` が一般的な VN トランジション。

**方針**: Phase 5 ではシェーダー不要のスライドトランジションを追加。マスクワイプ (GLSL) は Phase 6 以降。

**変更ファイル**:

1. **`packages/web/src/renderer/WebOpHandler.ts`** — `bgSet()` の effect 分岐拡張
   - `"fade"`: 既存のクロスフェード（変更なし）
   - `"slide_left"`: 新背景を右端から左にスライドイン、旧背景を左にスライドアウト
   - `"slide_right"`: 逆方向のスライド
   - lerpPosition ユーティリティを利用して position.x を補間

2. **`packages/web/src/engine/KscHostAdapter.ts`** — `setBg` の effect 引数を拡張
   - `"fade"` | `"slide_left"` | `"slide_right"` をそのまま WebOpHandler に渡す
   - effect → fadeMs 変換ロジックを拡張

3. **`packages/core/src/types/Op.ts`** — `BG_SET` の型拡張
   - `effect?: "fade" | "slide_left" | "slide_right"` フィールド追加（fadeMs と共存）

---

## 実装順序

```
Step 1: Phase 5-3 — easing.ts（他のステップの前提）
Step 2: Phase 5-1 — lerpPosition.ts → Op/IOpHandler/OpRunner → WebOpHandler → KscHostAdapter
Step 3: Phase 5-2 — Action.Screenshot → InputManager → WebOpHandler → GameUI
Step 4: Phase 5-4 — bgSet slide トランジション → KscHostAdapter effect 拡張
Step 5: typecheck + build
```

## 工数見積もり

| 項目 | 変更ファイル数 | 新規ファイル | 難易度 |
|------|-------------|------------|--------|
| 5-1 moveChar | 5 (Op, IOpHandler, OpRunner, WebOpHandler, KscHostAdapter) | 1 (lerpPosition.ts) | 低 |
| 5-2 スクリーンショット | 4 (Action, InputManager, WebOpHandler, GameUI) | 0 | 低 |
| 5-3 イージング | 3 (fadeTo, lerpPosition, shake) | 1 (easing.ts) | 低 |
| 5-4 スライドトランジション | 3 (Op, WebOpHandler, KscHostAdapter) | 0 | 中 |

## 検証方法

1. `npm run typecheck` — 型エラーなし
2. `npm run build` — ビルド成功
3. 手動テスト:
   - `moveChar("hero", "right", 800)` でキャラがスムーズに右に移動すること
   - `P` キーで PNG がダウンロードされること
   - フェードイン・アウトがイーズイン・アウトカーブで滑らかに見えること
   - `setBg("forest", "slide_left")` で背景がスライドインすること
   - skipMode 時はすべて即座に完了すること
