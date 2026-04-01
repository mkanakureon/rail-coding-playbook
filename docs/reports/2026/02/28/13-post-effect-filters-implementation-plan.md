# ポスト処理エフェクトフィルター 実装計画書

- **日付**: 2026-02-28
- **ステータス**: 計画完了
- **前提**: `12-post-effect-filters-design.md`（設計書）
- **見積り**: 全 3 フェーズ

---

## 1. 実装フェーズ

### Phase 1: 共通基盤 + Tier 1（5 エフェクト）

**目標**: shaderUtils と静的フィルター 5 種の実装。テストページの基本形を構築。

| # | タスク | 対象ファイル | 内容 |
|---|--------|-------------|------|
| 1-1 | 共通基盤作成 | `filters/shaderUtils.ts` | defaultFilterVertex, GLSL_LUMINANCE, GLSL_HASH, GLSL_NOISE2D |
| 1-2 | Vignette | `filters/VignetteFilter.ts` | smoothstep 暗転 |
| 1-3 | ColorTint | `filters/ColorTintFilter.ts` | RGB tint mix |
| 1-4 | Night | `filters/NightFilter.ts` | 彩度低下 + 青シフト + 暗転 |
| 1-5 | ChromaticAberration | `filters/ChromaticAberrationFilter.ts` | RGB チャンネル放射オフセット |
| 1-6 | Pixelate | `filters/PixelateFilter.ts` | UV グリッド量子化 |
| 1-7 | ScreenFilter 拡張 | `ScreenFilter.ts` | FilterType 拡張 + Ticker 引数 + dispatch |
| 1-8 | WebOpHandler 修正 | `WebOpHandler.ts` | コンストラクタに ticker 追加（1 行） |
| 1-9 | テストページ | `filter-test.html`, `src/filter-test.ts` | ドロップダウン + スライダー |
| 1-10 | ビルド設定 | `vite.config.ts` | filterTest エントリ追加 |

**完了条件**:
- `http://localhost:5175/filter-test.html` で 5 種の Tier 1 フィルターがドロップダウンから選択・適用可能
- 各フィルターの uniform をスライダーでリアルタイム調整可能
- `npx tsc --noEmit` がエラーなしで通る

### Phase 2: Tier 2（4 エフェクト — animated 対応）

**目標**: animated フィルター（uTime 使用）を 4 種追加。ScreenFilter の Ticker 自動更新機構を実装。

| # | タスク | 対象ファイル | 内容 |
|---|--------|-------------|------|
| 2-1 | OldFilm | `filters/OldFilmFilter.ts` | ノイズ + 明滅 + セピア + 縦傷 |
| 2-2 | Bloom | `filters/BloomFilter.ts` | 輝度閾値 → 13-tap blur → 加算合成 |
| 2-3 | Noise | `filters/NoiseFilter.ts` | ホワイトノイズ + スキャンライン |
| 2-4 | Glitch | `filters/GlitchFilter.ts` | バンドずらし + 色分離 + カラーバンド |
| 2-5 | ScreenFilter 更新 | `ScreenFilter.ts` | animated フィルター uTime Ticker 更新追加 |
| 2-6 | テストページ更新 | `src/filter-test.ts` | Tier 2 フィルターのスライダー定義追加 |

**完了条件**:
- animated フィルター（OldFilm, Noise, Glitch）がリアルタイムにアニメーション
- Bloom がライティング効果を正しく表現
- フィルター切り替え時に Ticker リスナーが正しくクリーンアップされる

### Phase 3: Tier 3（5 エフェクト）+ 仕上げ

**目標**: 高難度フィルター 5 種を追加。PC98Filter のリファクタ。全エフェクトスクショ。

| # | タスク | 対象ファイル | 内容 |
|---|--------|-------------|------|
| 3-1 | CRT | `filters/CRTFilter.ts` | 樽型歪み + サブピクセル + スキャンライン |
| 3-2 | GameBoy | `filters/GameBoyFilter.ts` | 4 段階量子化 + GB パレットマップ |
| 3-3 | Rain | `filters/RainFilter.ts` | 多層レインドロップ（animated） |
| 3-4 | Underwater | `filters/UnderwaterFilter.ts` | sin 波歪み + tint + コースティクス（animated） |
| 3-5 | FocusBlur | `filters/FocusBlurFilter.ts` | 焦点距離ベース放射状ブラー |
| 3-6 | PC98Filter リファクタ | `PC98Filter.ts` | vertex を shaderUtils から import |
| 3-7 | テストページ最終化 | `src/filter-test.ts` | Tier 3 スライダー定義追加 |
| 3-8 | スクショスクリプト | `scripts/filter-screenshot.mjs` | 全 18 フィルター自動スクリーンショット |

**完了条件**:
- 全 18 フィルターが filter-test.html で動作
- `scripts/filter-screenshot.mjs` で全フィルターのスクリーンショットが `screenshots/` に保存される
- `npx tsc --noEmit` がエラーなしで通る

---

## 2. フェーズ間の依存関係

```
Phase 1 ───→ Phase 2 ───→ Phase 3
  │              │              │
  │  shaderUtils │  Ticker 機構 │  全フィルター完成
  │  Tier 1 (5)  │  Tier 2 (4)  │  Tier 3 (5)
  │  テストページ│  animated    │  PC98 リファクタ
  │  基本形      │  対応        │  スクショ自動化
  └──────────────┴──────────────┘
```

- Phase 2 は Phase 1 の ScreenFilter Ticker 基盤に依存
- Phase 3 は Phase 2 の animated パターンに依存（Rain, Underwater）
- 各 Phase は独立してテスト可能

---

## 3. 検証手順

### 3.1 各 Phase 共通

```bash
# 型チェック
cd packages/web && npx tsc --noEmit

# dev サーバー起動
cd packages/web && npm run dev

# ブラウザで確認
open http://localhost:5175/filter-test.html
```

### 3.2 テストページでの確認項目

| 確認項目 | 方法 |
|---------|------|
| フィルター適用 | ドロップダウンから選択 → 画面に反映される |
| スライダー操作 | 各 uniform のスライダーを動かす → リアルタイムに変化する |
| animated 動作 | OldFilm/Noise/Glitch/Rain/Underwater がフレームごとに変化する |
| フィルター切替 | 別フィルターに切り替え → 前のフィルターが完全に解除される |
| OFF | "none" 選択 → 元画像に戻る |
| URL 指定 | `?filter=vignette` → 起動時にそのフィルターが適用される |

### 3.3 全フィルター自動スクリーンショット（Phase 3 完了後）

```bash
# dev サーバーが起動している状態で
node scripts/filter-screenshot.mjs
# → screenshots/YYYY-MM-DD/filter-*.png（18枚）
```

---

## 4. リスク・注意点

| リスク | 対策 |
|--------|------|
| Bloom の 13-tap blur がモバイルで重い | PixelateFilter と同様 `uInputSize` を使い、px 単位を UV 単位に変換して精度を保つ |
| Rain/Underwater の GLSL が複雑 | 段階的に実装。まず最小限の波エフェクト → 詳細な雨粒/コースティクス追加 |
| animated フィルター切替時の Ticker リーク | `clear()` で必ず `ticker.remove()` を呼ぶ。テストページでフィルター切替を繰り返して確認 |
| GLSL コンパイルエラー | `#version 300 es` + `precision mediump float;` を忘れない。ブラウザコンソールで即座に検出可能 |
| Premultiplied Alpha 忘れ | チェックリスト化。色演算フィルターは必ずアンプリマルチプライ→処理→プリマルチプライ |

---

## 5. 成果物一覧

### 新規ファイル（19 ファイル）

| ファイル | Phase |
|---------|-------|
| `packages/web/src/renderer/filters/shaderUtils.ts` | 1 |
| `packages/web/src/renderer/filters/VignetteFilter.ts` | 1 |
| `packages/web/src/renderer/filters/ColorTintFilter.ts` | 1 |
| `packages/web/src/renderer/filters/NightFilter.ts` | 1 |
| `packages/web/src/renderer/filters/ChromaticAberrationFilter.ts` | 1 |
| `packages/web/src/renderer/filters/PixelateFilter.ts` | 1 |
| `packages/web/src/renderer/filters/OldFilmFilter.ts` | 2 |
| `packages/web/src/renderer/filters/BloomFilter.ts` | 2 |
| `packages/web/src/renderer/filters/NoiseFilter.ts` | 2 |
| `packages/web/src/renderer/filters/GlitchFilter.ts` | 2 |
| `packages/web/src/renderer/filters/CRTFilter.ts` | 3 |
| `packages/web/src/renderer/filters/GameBoyFilter.ts` | 3 |
| `packages/web/src/renderer/filters/RainFilter.ts` | 3 |
| `packages/web/src/renderer/filters/UnderwaterFilter.ts` | 3 |
| `packages/web/src/renderer/filters/FocusBlurFilter.ts` | 3 |
| `packages/web/filter-test.html` | 1 |
| `packages/web/src/filter-test.ts` | 1 |
| `scripts/filter-screenshot.mjs` | 3 |

### 修正ファイル（4 ファイル）

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `packages/web/src/renderer/ScreenFilter.ts` | 1-3 | FilterType 拡張 + Ticker + dispatch |
| `packages/web/src/renderer/WebOpHandler.ts` | 1 | コンストラクタ 1 行変更 |
| `packages/web/src/renderer/PC98Filter.ts` | 3 | vertex を shaderUtils import に変更 |
| `packages/web/vite.config.ts` | 1 | filterTest エントリ追加 |
