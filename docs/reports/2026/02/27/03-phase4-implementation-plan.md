# Phase 4 実装計画: セーブサムネイル + ギャラリーUnlock + KSCコンパイラ filter 対応 + 画面シェイク

**作成日**: 2026-02-27
**ベースライン**: Phase 3 完了 (9882005) — スキップ高速化・オート音声連動・スクリーンフィルター実装済み

---

## 実装済み機能の整理

| Phase | 実装内容 |
|-------|---------|
| Phase 1 | バックログ、セーブロード + ビジュアル復元 |
| Phase 2 | フェードトランジション（bg/ch/bgm）、waitVoiceEnd、メニュー Log ボタン |
| Phase 3 | skipMode 演出無効化、autoMode 音声連動+文字数待機、スクリーンフィルター (sepia/grayscale/blur) |

## Phase 4 で対応する項目

文書精査から抽出した**ブラウザで即実装可能**な残タスク。ネイティブ (SDL2/C++) は対象外。

---

### Phase 4-1: セーブサムネイル

**根拠**: 36-SAVE_LOAD_SYSTEM §1 (thumbnail)、31-VN_PLATFORM_GAP_ANALYSIS §2.1

**現状**: SaveData に `thumbnail` フィールドがない。SaveLoadScreen のスロットは label + timestamp のテキストのみ。

**方針**: PixiJS の `app.renderer.extract` を使ってセーブ時にスクリーンショットを取得し、Base64 で SaveData に埋め込む。

**変更ファイル**:

1. **`packages/core/src/types/SaveData.ts`**
   - `thumbnail?: string` フィールドを追加

2. **`packages/web/src/renderer/WebOpHandler.ts`**
   - `captureThumbnail(): string | undefined` メソッド追加
   - `layers.root` を `app.renderer.extract.canvas()` でキャンバス取得 → 小さくリサイズ (160x90) → `toDataURL("image/jpeg", 0.7)`
   - `getViewState()` にはサムネイルを含めず、`captureThumbnail()` は別メソッドとして公開

3. **`packages/web/src/renderer/ui/GameUI.ts`**
   - `handleSave()` / `handleQuickSave()` 内で `handler.captureThumbnail?.()` を呼んでサムネイルを保存

4. **`packages/web/src/renderer/ui/SaveLoadScreen.ts`**
   - `SlotInfo` に `thumbnail?: string` 追加
   - スロット描画時にサムネイル画像があれば Sprite で表示

**注意**: WebOpHandler は現在 `app` (Application) への参照を持っていないため、renderer extract を使うにはコンストラクタに `Renderer` を渡すか、`IOpHandler` にオプショナルメソッドとして定義する。最小限のアプローチとして `captureThumbnail` を WebOpHandler 限定の公開メソッドにし、GameUI 側で `(handler as WebOpHandler).captureThumbnail?.()` でキャストする。

---

### Phase 4-2: ギャラリー Unlock 管理

**根拠**: GameUI.ts の TODO (4箇所)、33-VISUAL_EFFECTS §3

**現状**: ギャラリーアイテムは全てハードコードの `unlocked: false`。CG 閲覧が機能していない。

**方針**: IStorage を使った永続的な unlock フラグ管理。bgSet 時に背景 ID を自動記録。

**変更ファイル**:

1. **`packages/web/src/renderer/WebOpHandler.ts`**
   - `bgSet()` 内でギャラリー用 unlock セットに背景 ID を追加
   - `getUnlockedGalleryIds(): Set<string>` メソッド追加

2. **`packages/web/src/renderer/ui/GameUI.ts`**
   - `openGallery()` でストレージから unlock 済み ID を読み込み、GalleryItem の `unlocked` を動的に設定
   - ハードコードされたアイテム定義を外部化（プロジェクト設定から読む構造に変更、ただし Phase 4 ではまずストレージ連携のみ）

3. **`packages/web/src/storage/StorageManager.ts`**
   - `saveGalleryFlags(ids: string[]): Promise<void>` / `loadGalleryFlags(): Promise<string[]>` 追加（既存の IStorage を利用）

---

### Phase 4-3: KSC コンパイラに filter / filter_clear 追加

**根拠**: Phase 3 で Op 型 (SCREEN_FILTER / SCREEN_FILTER_CLEAR) とランタイムは完成したが、KSC スクリプトから呼べない。

**現状**: `packages/ksc-compiler/src/checker/builtins.ts` に filter 系のビルトインが未登録。

**変更ファイル**:

1. **`packages/ksc-compiler/src/checker/builtins.ts`**
   - `screenFilter(type, intensity?)` と `screenFilterClear()` のシグネチャを追加

2. **`packages/ksc-compiler/src/emitter.ts`**
   - `screenFilter` 呼び出しを `SCREEN_FILTER` Op に変換
   - `screenFilterClear` 呼び出しを `SCREEN_FILTER_CLEAR` Op に変換

3. **`packages/web/src/engine/KscHostAdapter.ts`**（KSC VM → IOpHandler のブリッジ）
   - `screenFilter` / `screenFilterClear` のディスパッチ追加

---

### Phase 4-4: 画面シェイク演出

**根拠**: 33-VISUAL_EFFECTS §3 (キャラクター演出)、31-VN_PLATFORM_GAP_ANALYSIS §2.2

**現状**: 震えや衝撃の演出手段がない。VN として基本的な演出。

**方針**: `layers.root` の position を Ticker で揺らす小さいユーティリティ。

**新規ファイル**: `packages/web/src/renderer/shake.ts`

```typescript
export function shake(
  target: Container,
  intensity: number, // px
  durationMs: number,
  ticker: Ticker,
): Promise<void>
```
- フレームごとにランダムオフセット → 終了時に元の位置に戻す

**変更ファイル**:

1. **`packages/core/src/types/Op.ts`**
   - `{ op: "SHAKE"; intensity?: number; durationMs?: number }` 追加

2. **`packages/core/src/engine/IOpHandler.ts`**
   - `shake?(intensity?: number, durationMs?: number): Promise<void>` 追加

3. **`packages/core/src/engine/OpRunner.ts`**
   - `case "SHAKE":` ハンドリング追加

4. **`packages/web/src/renderer/WebOpHandler.ts`**
   - `shake()` を実装（shake ユーティリティ使用）
   - skipMode 時は即 return

5. **`packages/ksc-compiler/src/checker/builtins.ts`**
   - `shake(intensity?, duration?)` のシグネチャ追加

6. **`packages/ksc-compiler/src/emitter.ts`**
   - `shake` 呼び出しを `SHAKE` Op に変換

---

## 実装順序

```
Step 1: Phase 4-1 — セーブサムネイル（SaveData 型 → WebOpHandler → GameUI → SaveLoadScreen）
Step 2: Phase 4-2 — ギャラリー Unlock（StorageManager → WebOpHandler → GameUI）
Step 3: Phase 4-3 — KSC コンパイラ filter 対応（builtins → emitter → KscHostAdapter）
Step 4: Phase 4-4 — shake ユーティリティ → Op/IOpHandler/OpRunner → WebOpHandler → コンパイラ
Step 5: typecheck + build
```

## 工数見積もり

| 項目 | 変更ファイル数 | 新規ファイル | 難易度 |
|------|-------------|------------|--------|
| 4-1 サムネイル | 4 (SaveData, WebOpHandler, GameUI, SaveLoadScreen) | 0 | 中（renderer extract 依存） |
| 4-2 ギャラリー | 3 (WebOpHandler, GameUI, StorageManager) | 0 | 低 |
| 4-3 コンパイラ filter | 3 (builtins, emitter, KscHostAdapter) | 0 | 低 |
| 4-4 shake | 5 (Op, IOpHandler, OpRunner, WebOpHandler, コンパイラ) | 1 (shake.ts) | 低 |

## 検証方法

1. `npm run typecheck` — 型エラーなし
2. `npm run build` — ビルド成功
3. 手動テスト:
   - セーブ時にサムネイルが生成され、ロード画面で表示されること
   - 背景表示後にギャラリーでその CG が unlock されていること
   - KSC スクリプトで `screenFilter("sepia")` / `screenFilterClear()` が動作すること
   - `shake()` で画面が振動し、skipMode 時は即完了すること
