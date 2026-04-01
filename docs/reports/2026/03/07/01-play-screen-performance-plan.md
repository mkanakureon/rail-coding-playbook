# プレイ画面パフォーマンス最適化計画

作成日: 2026-03-07

## 目的

読者（プレイヤー）のPC要件を下げる。低スペックPC・タブレット・スマートフォンでも快適にプレイできるようにする。

## 対象

`packages/web` — PixiJS ベースのビジュアルノベルエンジン（プレイ画面）

プレイ画面の構成:
- Next.js ラッパー: `apps/next/app/(public)/play/[id]/page.tsx`
- エンジン本体: `packages/web/src/ksc-demo.ts` → iframe で埋め込み
- レンダラ: `packages/web/src/renderer/WebOpHandler.ts`
- フィルタ: `packages/web/src/renderer/ScreenFilter.ts` + `filters/*.ts`（15種）

## 現状分析

### 軽い部分（対応不要）

| 項目 | 理由 |
|------|------|
| 基本描画 | 1280x720 論理解像度、4レイヤー構成、Ticker 駆動 |
| テキスト表示 | フレームベースの文字送り、軽量 |
| セーブ/ロード | IndexedDB、参照IDのみ保存（画像埋め込みなし） |
| オーディオ | Web Audio API、オンデマンド fetch |
| 入力 | Action dispatch パターン、ポーリングなし |

### 重い部分（対応必要）

| 項目 | 原因 | 影響 |
|------|------|------|
| GLSL フィルタ | 毎フレーム GPU シェーダー実行（Bloom: 25テクスチャサンプル、Rain: 3レイヤー） | 統合GPUで FPS 低下 |
| アニメスプライト | 全フレームテクスチャを一括メモリ読み込み | メモリスパイク |
| テクスチャ管理 | キャッシュなし、使い捨て | 同じ画像の再読み込み |

---

## Phase 1: フィルタ品質の自動調整（最優先）

### 概要

FPS を実測し、低下を検知したらフィルタ品質を自動で下げる。読者が手動で品質を選ぶこともできる。

### 1-1. PerformanceMonitor クラス新規作成

**ファイル**: `packages/web/src/renderer/PerformanceMonitor.ts`

```typescript
export type QualityLevel = "high" | "medium" | "low";

export class PerformanceMonitor {
  private ticker: Ticker;
  private fpsSamples: number[] = [];
  private sampleWindow = 60; // 60フレーム（約1秒）の移動平均
  private currentQuality: QualityLevel = "high";
  private onQualityChange: ((level: QualityLevel) => void) | null = null;

  // 閾値
  private readonly DOWNGRADE_FPS = 40;  // これ以下で品質を下げる
  private readonly UPGRADE_FPS = 55;    // これ以上で品質を上げる
  private readonly CHECK_INTERVAL = 120; // 2秒ごとにチェック

  constructor(ticker: Ticker) { ... }

  // Ticker callback で毎フレーム FPS を記録
  update(): void { ... }

  // 移動平均 FPS を返す
  getAverageFPS(): number { ... }

  // 品質レベルの自動判定
  private evaluateQuality(): void { ... }

  // 手動設定（Settings 画面から）
  setQuality(level: QualityLevel): void { ... }

  // コールバック登録
  onChanged(cb: (level: QualityLevel) => void): void { ... }
}
```

**判定ロジック**:
- `high`（デフォルト）: 全フィルタをフル品質で適用
- `medium`: Bloom のサンプル数を 25→9 に削減、Rain を 3レイヤー→1レイヤーに
- `low`: アニメーションフィルタを静的エフェクトに置換 or 無効化

**自動切り替えフロー**:
```
high → (avg FPS < 40 が 2秒継続) → medium
medium → (avg FPS < 40 が 2秒継続) → low
low → (avg FPS > 55 が 3秒継続) → medium
medium → (avg FPS > 55 が 3秒継続) → high
```

### 1-2. ScreenFilter の品質対応

**ファイル**: `packages/web/src/renderer/ScreenFilter.ts`

変更内容:
- `apply(type, intensity)` → `apply(type, intensity, quality)` に拡張
- `quality` に応じて `createFilter()` の生成パラメータを変更

```typescript
// 品質別パラメータ例
private getFilterParams(type: FilterType, quality: QualityLevel) {
  switch (type) {
    case "bloom":
      // high: 13-tap (25 samples), medium: 5-tap (9 samples), low: 無効→vignette代替
      return quality === "high" ? { taps: 6 }
           : quality === "medium" ? { taps: 2 }
           : null; // low では bloom を vignette に置き換え
    case "rain":
      // high: 3レイヤー, medium: 1レイヤー, low: 静的オーバーレイ
      return quality === "high" ? { layers: 3 }
           : quality === "medium" ? { layers: 1 }
           : null;
    case "crt":
      // high: full, medium: scanline のみ, low: 無効
      ...
  }
}
```

### 1-3. フィルタシェーダーの軽量版

対象フィルタと軽量化方針:

| フィルタ | high | medium | low |
|---------|------|--------|-----|
| **bloom** | 13-tap cross (25 samples) | 5-tap cross (9 samples) | vignette で代替 |
| **rain** | 3レイヤー + アニメ | 1レイヤー + アニメ | 静的 darkening のみ |
| **crt** | barrel distortion + phosphor + scanline + vignette | scanline + vignette | 無効 |
| **glitch** | フルエフェクト | RGB shift のみ | 無効 |
| **oldFilm** | grain + vignette + flicker | vignette のみ | 無効 |
| **underwater** | wave distortion + color | color shift のみ | color shift のみ |
| **chromaticAberration** | フル | offset 半減 | 無効 |

軽量化不要（元から軽い）:
- sepia, grayscale, blur, pixelate, night, vignette, colorTint, noise, gameboy, focusBlur, fadeBlack, fadeWhite

### 1-4. Settings 画面に品質設定を追加

**ファイル**: `packages/web/src/renderer/ui/SettingsScreen.ts`

追加項目:
- **演出品質**: High / Medium / Low（スライダーではなく3択ボタン）
- **Auto（デフォルト）**: FPS ベースの自動調整を有効にする

UI:
```
[Auto] [High] [Medium] [Low]
```

設定値は `StorageManager` で永続化（LocalStorage）。

---

## Phase 2: テクスチャキャッシュ

### 概要

同じアセットの再読み込みを防ぐ LRU キャッシュを導入する。

### 2-1. TextureCache クラス新規作成

**ファイル**: `packages/web/src/renderer/TextureCache.ts`

```typescript
export class TextureCache {
  private cache = new Map<string, { texture: Texture; lastUsed: number }>();
  private maxEntries = 30;        // 最大保持数
  private maxMemoryMB = 128;      // メモリ上限（推定）
  private currentMemoryMB = 0;

  get(url: string): Texture | null { ... }
  set(url: string, texture: Texture): void { ... }
  private estimateMemory(texture: Texture): number { ... }
  private evict(): void { ... }  // LRU で古いものから破棄
  clear(): void { ... }
}
```

### 2-2. WebOpHandler への統合

**ファイル**: `packages/web/src/renderer/WebOpHandler.ts`

変更箇所:
- `loadPremultiplied()` でキャッシュを先にチェック
- `resolveAssetPath()` → fetch → キャッシュ登録
- `reset()` 時にキャッシュは保持（シーン遷移で同じ背景を再利用するケースが多い）

```typescript
// Before
const tex = await this.loadPremultiplied(url);

// After
let tex = this.textureCache.get(url);
if (!tex) {
  tex = await this.loadPremultiplied(url);
  this.textureCache.set(url, tex);
}
```

---

## Phase 3: アニメスプライトのストリーミングロード

### 概要

全フレームの一括読み込みを避け、初回は最初の数フレームだけ読み込んで再生開始。残りをバックグラウンドで読み込む。

### 3-1. StreamingAnimatedSprite

**ファイル**: `packages/web/src/renderer/StreamingAnimatedSprite.ts`

```typescript
export class StreamingAnimatedSprite {
  // 最初の 3 フレームを即座にロード → 再生開始
  // 残りのフレームを requestIdleCallback or setTimeout で順次ロード
  // ロード完了したフレームから AnimatedSprite.textures に追加

  static async create(
    frames: Array<{ index: number; url: string }>,
    fps: number,
    loop: boolean,
    loadFn: (url: string) => Promise<Texture>,
  ): Promise<AnimatedSprite> { ... }
}
```

### 3-2. WebOpHandler.chAnim() の変更

**ファイル**: `packages/web/src/renderer/WebOpHandler.ts` (line 722-806)

変更: `for...of` 一括ロード → `StreamingAnimatedSprite.create()` に委譲

---

## 実装順序

```
Phase 1-1: PerformanceMonitor （FPS 計測基盤）
    |
Phase 1-2: ScreenFilter 品質パラメータ対応
    |
Phase 1-3: 重いフィルタ 7 種の軽量版シェーダー
    |
Phase 1-4: Settings 画面に品質設定 UI 追加
    |
Phase 2-1: TextureCache クラス
    |
Phase 2-2: WebOpHandler 統合
    |
Phase 3: StreamingAnimatedSprite
```

## 見積もり

| Phase | 変更ファイル数 | 新規ファイル数 | 規模 |
|-------|-------------|-------------|------|
| 1-1 | 1 (WebOpHandler) | 1 (PerformanceMonitor) | 小 |
| 1-2 | 1 (ScreenFilter) | 0 | 小 |
| 1-3 | 7 (filters/) | 0 | 中 |
| 1-4 | 2 (SettingsScreen, GameUI) | 0 | 小 |
| 2 | 1 (WebOpHandler) | 1 (TextureCache) | 小 |
| 3 | 1 (WebOpHandler) | 1 (StreamingAnimatedSprite) | 中 |

## 読者への影響

| 変更前 | 変更後 |
|--------|--------|
| 低スペックPCでフィルタ使用時に FPS 低下 | 自動で品質調整、安定 FPS を維持 |
| Settings に音量・テキスト速度のみ | 演出品質の手動選択が可能に |
| 同じ背景を再表示するたびに再 fetch | キャッシュヒットで即表示 |
| アニメキャラ表示時に一瞬フリーズ | 数フレーム先行ロードで即再生開始 |

## 作者（シナリオ制作者）への影響

- 変更なし。`@filter bloom` 等のコマンドはそのまま使える
- 読者の端末で自動的に品質が調整されるため、作者が端末を意識する必要がない
- 「演出が重いから使わない」という制約が緩和される

## 非対応（スコープ外）

- エディタ側のパフォーマンス改善（別計画）
- WebGPU 対応（PixiJS v8 で将来的に検討）
- 解像度の動的ダウンスケール（1280x720 は十分軽い）
