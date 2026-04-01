# Phase 3 実装計画: スキップ高速化 + オート音声連動 + スクリーンフィルター

**作成日**: 2026-02-27
**ベースライン**: Phase 2 完了 (28984d3) — フェードトランジション・メニューLog・waitVoiceEnd 実装済み

---

## 背景: 文書精査と実装状況の照合

`docs/10_ai_docs/2026/02/26/` の 64 文書を精査し、最近のコミット履歴と照合した結果を以下にまとめる。

### 実装済み（対応不要）

| 文書 | 内容 | 対応コミット |
|------|------|-------------|
| 35-BACKLOG_SYSTEM | バックログ基本実装 | ef047fa |
| 36-SAVE_LOAD_SYSTEM | セーブロード + ビジュアル復元 | ef047fa |
| 51-BACKLOG_UI_DESIGN | バックログ UI（スクロール、音声ボタン） | ef047fa |
| 33-VISUAL_EFFECTS (§1 Fade) | クロスフェードトランジション | 28984d3 |
| 32-ENGINE_QOL (§1,2) | バックログ、セーブロード基本 | ef047fa |

### 部分的に実装済み → 今回強化

| 文書 | 内容 | 現状 | 残タスク |
|------|------|------|---------|
| 37-AUTO_SKIP_LOGIC | オート/スキップ高速処理 | トグルとテキスト送りは実装済み | **スキップ時のフェード0ms強制、オートの音声連動待機** |
| 52-SKIP_SYSTEM_LOGIC | スキップ時の演出無効化 | 既読判定でスキップ停止は実装済み | **演出(fade/wait)を0msにする共通ロジック** |
| 33-VISUAL_EFFECTS (§2) | スクリーンフィルター | 未実装 | **セピア/モノクロ/ブラーの全画面フィルタ** |

### 今回は対象外（理由付き）

| 文書 | 内容 | 除外理由 |
|------|------|---------|
| 49, 50 マスクワイプ | GLSL シェーダートランジション | コスト大、Phase 4 以降 |
| 38-41 SDL2/ネイティブ系 | C++ ネイティブエンジン | 別トラック |
| 08, 34 AI 執筆支援改善 | プロンプト/YAML 改善 | 別トラック |
| 24-29 Editor/TSX 改善 | エディタ UI リファクタ | 別トラック |

---

## 実装項目

### Phase 3-1: スキップモード演出無効化

**根拠**: 37-AUTO_SKIP_LOGIC §2, 52-SKIP_SYSTEM_LOGIC §1-2

**現状の問題**: skipMode=ON でもフェードトランジション (bg/ch) は指定された fadeMs で実行されるため、スキップが遅い。waitMs もそのまま待機してしまう。

**変更ファイル**: `packages/web/src/renderer/WebOpHandler.ts`

**方針**: 各メソッドの冒頭で `this.skipMode` を判定し、fadeMs/waitMs を 0 に強制する。

```typescript
// 各フェードメソッドに追加するパターン
const ms = (this.skipMode ? 0 : fadeMs) ?? 0;
```

対象メソッド:
- `bgSet` — fadeMs を 0 に
- `bgClear` — fadeMs を 0 に
- `chSet` — fadeMs を 0 に
- `chHide` — fadeMs を 0 に
- `chClear` — fadeMs を 0 に
- `bgmPlay` — fadeMs を 0 に（BGM は即座に目標音量へ）
- `bgmStop` — fadeMs を 0 に（BGM は即座に停止）
- `waitMs` — skipMode 時は即 return

---

### Phase 3-2: オートモード音声連動

**根拠**: 37-AUTO_SKIP_LOGIC §1, 32-ENGINE_QOL §3

**現状の問題**: autoMode の待機は TextWindow 内の固定 2000ms タイマーのみ。音声再生中でも 2 秒で次に進んでしまう。文字数に応じた待機時間の調整もない。

**変更ファイル**:
- `packages/web/src/renderer/TextWindow.ts`
- `packages/web/src/renderer/WebOpHandler.ts`

**方針**:

1. **TextWindow の autoTimer を文字数ベースに変更**:
   ```typescript
   // 現在: 固定 2000ms
   // 変更: Math.max(文字数 * 50, 1500) — 30文字で1.5秒、60文字で3秒
   const autoDelay = Math.max(this.fullText.length * 50, 1500);
   ```

2. **音声再生中の待機**: WebOpHandler の `waitClick` で autoMode 時に `waitVoiceEnd()` を await してからテキスト送りする。TextWindow 自体は変更せず、WebOpHandler 側で音声終了を待ってから resolve する。

   ```typescript
   // waitClick 内、テキスト表示後
   if (this.autoMode && this.pendingVoiceId) {
     await this.audio.onEnded("voice");
   }
   ```

---

### Phase 3-3: スクリーンフィルター (全画面エフェクト)

**根拠**: 33-VISUAL_EFFECTS §2

**目的**: 回想シーン（セピア）、夢シーン（ブラー）、モノクロ演出などの雰囲気作り。

**新規ファイル**: `packages/web/src/renderer/ScreenFilter.ts`

**方針**: PixiJS v8 の組み込みフィルタを使用。`ColorMatrixFilter` (セピア/モノクロ) と `BlurFilter` (ブラー) のみで十分。

```typescript
export class ScreenFilter {
  constructor(private stage: Container) {}

  apply(type: "sepia" | "grayscale" | "blur", intensity?: number): void;
  clear(): void;
}
```

**IOpHandler 拡張**: `packages/core/src/engine/IOpHandler.ts` にオプショナルメソッド追加:
```typescript
screenFilter?(type: string, intensity?: number): void;
screenFilterClear?(): void;
```

**Op 拡張**: `packages/core/src/types/Op.ts` に新 Op 型追加:
```typescript
{ type: "SCREEN_FILTER"; filter: string; intensity?: number }
{ type: "SCREEN_FILTER_CLEAR" }
```

**KSC コマンド**: コンパイラ側も対応が必要（ただし Phase 3 では手動 Op 挿入でテスト可能）:
```
@filter type=sepia
@filter_clear
```

---

## 実装順序

```
Step 1: Phase 3-1 — skipMode 演出無効化（WebOpHandler のみ）
Step 2: Phase 3-2 — autoMode 音声連動 + 文字数ベース待機
Step 3: Phase 3-3 — ScreenFilter ユーティリティ作成
Step 4: Phase 3-3 — IOpHandler + Op 型拡張
Step 5: Phase 3-3 — WebOpHandler に screenFilter 実装
Step 6: typecheck + build
```

## 工数見積もり

| 項目 | 変更ファイル数 | 新規ファイル | 難易度 |
|------|-------------|------------|--------|
| 3-1 skipMode | 1 | 0 | 低 |
| 3-2 autoMode 音声連動 | 2 | 0 | 低 |
| 3-3 スクリーンフィルター | 3 (IOpHandler, Op, WebOpHandler) | 1 (ScreenFilter) | 中 |

## 検証方法

1. `npm run typecheck` — 型エラーなし
2. `npm run build` — ビルド成功
3. 手動テスト:
   - skipMode ON でフェードが瞬時に完了すること
   - skipMode ON で waitMs が即スキップされること
   - autoMode ON + 音声再生中は音声終了まで待機すること
   - autoMode の待機時間が文字数に応じて変動すること
   - `screenFilter("sepia")` でセピア調になること
   - `screenFilterClear()` でフィルタが解除されること
