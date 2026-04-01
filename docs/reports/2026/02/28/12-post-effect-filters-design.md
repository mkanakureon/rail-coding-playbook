# ポスト処理エフェクトフィルター 設計書

- **日付**: 2026-02-28
- **ステータス**: 設計完了
- **前提**: PC98Filter 実装（`11-pc98-filter-implementation.md`）で確立した PixiJS v8 カスタム GLSL フィルターパターン

---

## 1. 目的

ビジュアルノベルエンジンの演出力を強化するため、画面全体に適用するポスト処理エフェクトを 14 種追加する。
既存の `ScreenFilter` クラスから `SCREEN_FILTER` Op 経由で文字列指定により呼び出せるようにし、
スクリプト（.ks）から `@screenFilter type=night` のように簡潔に利用可能とする。

### 設計原則

1. **PC98Filter で確立済みのパターンを踏襲** — `Filter` 継承、`GlProgram.from()`、`UniformGroup`
2. **共通 vertex シェーダーの抽出** — 全フィルターで同一の頂点シェーダーを共有
3. **animated フィルター対応** — `uTime` uniform を Ticker で自動更新する仕組み
4. **Switch 移植への影響なし** — ポスト処理は Web レンダリング層のみの機能。Core 層には一切影響しない

---

## 2. エフェクト一覧

### 2.1 Tier 1: 高インパクト・低難度（最優先）

| # | エフェクト名 | FilterType 文字列 | VN 演出用途 | 核心アルゴリズム | animated |
|---|-------------|-------------------|-------------|-----------------|----------|
| 1 | Vignette | `vignette` | 緊張・親密シーン、注意集中 | UV 中心からの距離で smoothstep 暗転 | No |
| 2 | ColorTint | `colorTint` | 夕焼け(暖色)/夜(寒色)/ホラー(赤)/病気(緑) | RGB tint 色と元色を mix | No |
| 3 | Night | `night` | 夜景シーン | 彩度低下 + 青シフト + 暗転 | No |
| 4 | ChromaticAberration | `chromaticAberration` | 精神異常・超常現象・気絶 | RGB 各チャンネルを放射方向にオフセット取得 | No |
| 5 | Pixelate | `pixelate` | シーン遷移・モザイク・レトロ回想 | UV 座標をグリッドに量子化 | No |

### 2.2 Tier 2: 高インパクト・中難度

| # | エフェクト名 | FilterType 文字列 | VN 演出用途 | 核心アルゴリズム | animated |
|---|-------------|-------------------|-------------|-----------------|----------|
| 6 | OldFilm | `oldFilm` | 回想・記憶・歴史シーン | ノイズ粒子 + 明滅 + セピア + 縦傷 | **Yes** |
| 7 | Bloom | `bloom` | ロマンチック・夢・神聖シーン | 輝度閾値抽出 → 13-tap blur → 加算合成 | No |
| 8 | Noise | `noise` | TV 静電気・通信断絶・SF | ホワイトノイズ生成 + スキャンライン | **Yes** |
| 9 | Glitch | `glitch` | デジタル破損・ホラー・第四の壁 | 水平バンドずらし + 色分離 + カラーバンド | **Yes** |

### 2.3 Tier 3: 中インパクト・高難度

| # | エフェクト名 | FilterType 文字列 | VN 演出用途 | 核心アルゴリズム | animated |
|---|-------------|-------------------|-------------|-----------------|----------|
| 10 | CRT | `crt` | レトロ端末・作中 TV・メタ演出 | 樽型歪み + RGB サブピクセル + スキャンライン + ビネット | No |
| 11 | GameBoy | `gameboy` | レトロゲーム言及・コメディ回想 | 輝度→4段階量子化→GB 緑パレットマップ | No |
| 12 | Rain | `rain` | 雨天・憂鬱・ドラマチック屋外 | 多層レイン関数（ノイズ列 + 細長ドロップ） | **Yes** |
| 13 | Underwater | `underwater` | 水中・溺れ・潜在意識・幻想 | sin 波 UV 歪み + 青緑 tint + コースティクス | **Yes** |
| 14 | FocusBlur | `focusBlur` | 被写界深度・キャラ注目・ぼかし背景 | 焦点中心からの距離に応じた多段タップ blur | No |

> **animated フィルター**: 6 種（OldFilm, Noise, Glitch, Rain, Underwater）+ 既存の PC98 以外で uTime を使用。
> Ticker の `add()` でフレームごとに `uTime` を加算し、リアルタイムにアニメーションする。

---

## 3. アーキテクチャ

### 3.1 ファイル構成

```
packages/web/src/renderer/
  filters/                          ← 新規ディレクトリ
    shaderUtils.ts                  ← 共通 vertex シェーダー + GLSL ユーティリティ関数
    VignetteFilter.ts               ← Tier 1
    ColorTintFilter.ts
    NightFilter.ts
    ChromaticAberrationFilter.ts
    PixelateFilter.ts
    OldFilmFilter.ts                ← Tier 2
    BloomFilter.ts
    NoiseFilter.ts
    GlitchFilter.ts
    CRTFilter.ts                    ← Tier 3
    GameBoyFilter.ts
    RainFilter.ts
    UnderwaterFilter.ts
    FocusBlurFilter.ts
  PC98Filter.ts                     ← 既存（shaderUtils の vertex を使うよう修正）
  ScreenFilter.ts                   ← 修正（FilterType 拡張 + Ticker 対応 + dispatch 追加）
packages/web/src/renderer/WebOpHandler.ts  ← 修正（ScreenFilter コンストラクタに Ticker 追加）
packages/web/filter-test.html       ← 新規（全エフェクト統合テストページ）
packages/web/src/filter-test.ts     ← 新規（ドロップダウン + スライダーで全フィルター操作）
packages/web/vite.config.ts         ← 修正（filterTest エントリ追加）
scripts/filter-screenshot.mjs       ← 新規（全エフェクトの自動スクリーンショット）
```

### 3.2 クラス関係図

```
                         PixiJS Filter (base)
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    PC98Filter          VignetteFilter        ... (14種)
    (既存)               (新規)
         │                    │
         └────────┬───────────┘
                  │
           ScreenFilter  ← FilterType 文字列で dispatch
                  │
           WebOpHandler  ← Op からの呼び出しゲートウェイ
                  │
         KscHostAdapter  ← .ks スクリプトからの呼び出し
```

### 3.3 共通基盤: `shaderUtils.ts`

全フィルターで共有するモジュール。

```typescript
// 全フィルター共通の vertex シェーダー（GLSL ES 3.0）
export const defaultFilterVertex: string;

// fragment に挿入する共通 GLSL 関数
export const GLSL_LUMINANCE: string;   // float luminance(vec3 c) — Rec.601 輝度
export const GLSL_HASH: string;        // float hash(vec2 p) — 疑似乱数
export const GLSL_NOISE2D: string;     // float noise2d(vec2 p) — 2D バリューノイズ
```

- **vertex シェーダー**: PixiJS v8 の `aPosition` → `vTextureCoord` 変換。`uInputSize`, `uOutputFrame`, `uOutputTexture` を使用
- **GLSL 関数**: テンプレートリテラルで fragment シェーダー文字列に `${GLSL_HASH}` のように挿入

---

## 4. ScreenFilter 拡張設計

### 4.1 FilterType 拡張

```typescript
export type FilterType =
  | "sepia" | "grayscale" | "blur"          // 既存（PixiJS 組み込み）
  | "pc98"                                   // 既存（カスタム GLSL）
  | "vignette" | "colorTint" | "night"       // Tier 1
  | "chromaticAberration" | "pixelate"
  | "oldFilm" | "bloom"                      // Tier 2
  | "noise" | "glitch"
  | "crt" | "gameboy"                        // Tier 3
  | "rain" | "underwater" | "focusBlur";
```

### 4.2 Ticker 統合（animated フィルター対応）

```typescript
export class ScreenFilter {
  private stage: Container;
  private ticker: Ticker;
  private activeAnimatedFilter: { time: number } | null = null;
  private tickerCallback: (() => void) | null = null;

  constructor(stage: Container, ticker: Ticker) {
    this.stage = stage;
    this.ticker = ticker;
  }

  apply(type: FilterType, intensity?: number): void {
    this.clear();
    const filter = this.createFilter(type, intensity);
    this.stage.filters = [filter];

    // animated フィルターなら Ticker で uTime を更新
    if (this.isAnimated(filter)) {
      this.startTimeUpdate(filter);
    }
  }

  clear(): void {
    this.stopTimeUpdate();
    this.stage.filters = [];
  }

  private startTimeUpdate(filter: { time: number }): void {
    this.activeAnimatedFilter = filter;
    this.tickerCallback = () => {
      if (this.activeAnimatedFilter) {
        this.activeAnimatedFilter.time += this.ticker.deltaMS / 1000;
      }
    };
    this.ticker.add(this.tickerCallback);
  }

  private stopTimeUpdate(): void {
    if (this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
    this.activeAnimatedFilter = null;
  }

  private isAnimated(filter: unknown): filter is { time: number } {
    return filter !== null
      && typeof filter === "object"
      && "time" in filter;
  }
}
```

### 4.3 WebOpHandler.ts 変更

```diff
- this.screenFilterHelper = new ScreenFilter(layers.root);
+ this.screenFilterHelper = new ScreenFilter(layers.root, this.ticker);
```

変更は 1 行のみ。`this.ticker` は既にコンストラクタで受け取り済み。

---

## 5. 各エフェクト Uniform 仕様

### 5.1 Vignette

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uIntensity` | f32 | 0.5 | 周辺暗転の強さ（0=なし, 1=最大） |
| `uRadius` | f32 | 0.75 | 暗転開始の内側半径（UV 空間, 0.5=画面中央, 1.0=画面端） |
| `uSoftness` | f32 | 0.45 | グラデーション幅（大きいほど緩やか） |

**GLSL 核心処理**:
```glsl
vec2 center = vTextureCoord - 0.5;
float dist = length(center);
float vignette = smoothstep(uRadius, uRadius - uSoftness, dist);
color.rgb *= mix(1.0, vignette, uIntensity);
```

### 5.2 ColorTint

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTintColor` | vec3\<f32\> | (1.0, 0.85, 0.6) | ティント色 RGB |
| `uIntensity` | f32 | 0.3 | 混合率（0=なし, 1=完全ティント） |
| `uBrightness` | f32 | 1.0 | 明度乗算（<1 で暗く、>1 で明るく） |

**プリセット例**:
| シーン | tintColor | intensity | brightness |
|--------|-----------|-----------|------------|
| 夕焼け | (1.0, 0.6, 0.3) | 0.5 | 0.95 |
| ホラー | (1.0, 0.2, 0.2) | 0.4 | 0.7 |
| 病的 | (0.6, 1.0, 0.5) | 0.3 | 0.85 |
| 回想(暖) | (1.0, 0.9, 0.7) | 0.3 | 1.0 |

### 5.3 Night

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uIntensity` | f32 | 0.6 | 全体強度 |
| `uDarkness` | f32 | 0.5 | 暗さ（0=暗転なし, 1=真っ暗） |
| `uBlueShift` | f32 | 0.3 | 青シフト強度 |

**処理パイプライン**: 彩度低下(60%) → 青色シフト → 暗転

### 5.4 ChromaticAberration

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uOffset` | f32 | 0.005 | チャンネル分離幅（UV 空間。0.01 でかなり強い） |
| `uIntensity` | f32 | 1.0 | 強度乗算 |

**GLSL 核心処理**: 画面中心からの放射方向に R/B チャンネルをずらして取得。中心付近は影響が少なく、画面端ほど色ずれが強くなる。

### 5.5 Pixelate

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uPixelSize` | f32 | 8.0 | モザイクセルサイズ（px 単位。大きいほど粗い） |

**GLSL 核心処理**: UV → ピクセル座標変換 → `floor(coord / size) * size` で量子化 → UV に戻してサンプリング

### 5.6 OldFilm (animated)

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTime` | f32 | 0.0 | 経過時間（Ticker 自動更新） |
| `uGrainIntensity` | f32 | 0.15 | フィルムグレイン強度 |
| `uFlickerIntensity` | f32 | 0.03 | 明滅量（フレームごとの明るさ揺れ） |
| `uSepiaStrength` | f32 | 0.5 | セピア色付け強度 |
| `uScratchDensity` | f32 | 0.3 | 縦傷密度 |

**処理パイプライン**: ノイズグレイン加算 → 全体明滅 → セピア変換 → 縦傷描画

### 5.7 Bloom

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uThreshold` | f32 | 0.6 | 輝度抽出閾値（これより明るい部分だけ光る） |
| `uIntensity` | f32 | 0.5 | ブルーム強度 |
| `uRadius` | f32 | 4.0 | ブラー半径（px 単位） |

**処理パイプライン**: 全ピクセル取得 → 輝度閾値で明部抽出 → 13-tap ガウシアンブラー → 元画像に加算合成

### 5.8 Noise (animated)

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTime` | f32 | 0.0 | 経過時間（Ticker 自動更新） |
| `uIntensity` | f32 | 0.5 | ノイズ混合率 |
| `uScanlines` | f32 | 0.3 | スキャンライン強度 |

### 5.9 Glitch (animated)

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTime` | f32 | 0.0 | 経過時間（Ticker 自動更新） |
| `uIntensity` | f32 | 0.5 | グリッチ強度 |
| `uBlockSize` | f32 | 0.05 | バンド高さ（UV 空間） |
| `uSpeed` | f32 | 3.0 | パターン変化速度 |

### 5.10 CRT

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uCurvature` | f32 | 0.03 | 樽型歪み強度 |
| `uScanlineStrength` | f32 | 0.15 | スキャンライン暗化 |
| `uPhosphorStrength` | f32 | 0.3 | RGB サブピクセル分離 |
| `uVignette` | f32 | 0.3 | 四隅暗転 |

**処理パイプライン**: 樽型歪み UV 変換 → RGB サブピクセルシミュレーション → スキャンライン → ビネット

### 5.11 GameBoy

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uContrast` | f32 | 1.0 | 量子化前コントラスト調整 |

**固定パレット（4色）**:
```glsl
const vec3 palette[4] = vec3[4](
    vec3(0.06, 0.22, 0.06),  // 最暗
    vec3(0.19, 0.38, 0.19),
    vec3(0.55, 0.67, 0.06),
    vec3(0.61, 0.74, 0.06)   // 最明
);
```

### 5.12 Rain (animated)

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTime` | f32 | 0.0 | 経過時間（Ticker 自動更新） |
| `uIntensity` | f32 | 0.4 | 雨の密度/明るさ |
| `uSpeed` | f32 | 1.0 | 落下速度 |
| `uAngle` | f32 | 0.1 | 風角度（ラジアン）|
| `uDropLength` | f32 | 0.15 | 雨筋の長さ |

**アルゴリズム**: 複数レイヤー（前景・背景）のノイズベース雨粒。各レイヤーでスケールとスピードを変えて奥行き感を出す。

### 5.13 Underwater (animated)

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uTime` | f32 | 0.0 | 経過時間（Ticker 自動更新） |
| `uWaveIntensity` | f32 | 0.01 | UV 歪み振幅 |
| `uWaveSpeed` | f32 | 1.0 | 波速度 |
| `uTintIntensity` | f32 | 0.4 | 青緑 tint 強度 |
| `uCausticIntensity` | f32 | 0.15 | コースティクス光（水面の光の揺らぎ） |

**処理パイプライン**: sin 波 UV 歪み → テクスチャサンプリング → 青緑 tint → コースティクスパターン加算

### 5.14 FocusBlur

| uniform | WGSL type | default | 説明 |
|---------|-----------|---------|------|
| `uFocusCenter` | vec2\<f32\> | (0.5, 0.5) | 焦点位置（UV 空間） |
| `uFocusRadius` | f32 | 0.3 | シャープ範囲の半径 |
| `uBlurAmount` | f32 | 3.0 | 最大ブラー強度（px） |

**アルゴリズム**: 焦点中心からの距離に応じてブラー強度を線形補間。12-tap 放射状ブラーで各ピクセルをサンプリング。

---

## 6. GLSL 実装ルール

PC98Filter 実装で確立したパターンを全フィルターに適用する。

### 6.1 必須ルール

| # | ルール | 理由 |
|---|--------|------|
| 1 | `#version 300 es` を vertex/fragment 両方の先頭に記述 | ES 1.0 フォールバック防止 |
| 2 | `precision mediump float;` を fragment に記述 | モバイル互換性 |
| 3 | Premultiplied Alpha 対応 | PixiJS はプリマルチプライドアルファを使用 |
| 4 | animated フィルターは `time` getter/setter を公開 | ScreenFilter の Ticker 連携に必要 |
| 5 | 共通 vertex は `shaderUtils.ts` から import | DRY 原則 |

### 6.2 Premultiplied Alpha 処理

```glsl
// 処理の最初: アンプリマルチプライ
vec4 color = texture(uTexture, vTextureCoord);
if (color.a > 0.0) color.rgb /= color.a;

// ... 色処理 ...

// 処理の最後: プリマルチプライ復元
color.rgb *= color.a;
finalColor = color;
```

**例外**: Pixelate は UV 量子化のみで色演算を行わないため、premultiplied alpha 処理は不要。

### 6.3 animated フィルターの time インターフェース

```typescript
// 全 animated フィルターが実装するパターン
get time(): number {
    return this.resources.xxxUniforms.uniforms.uTime;
}
set time(v: number) {
    this.resources.xxxUniforms.uniforms.uTime = v;
}
```

---

## 7. テストページ設計

### 7.1 `filter-test.html`

- 全 18 種のフィルター（既存 4 + 新規 14）をドロップダウンから選択
- 選択したフィルターの uniform に対応するスライダーを動的生成
- animated フィルターは自動で Ticker 更新開始
- 背景画像 `assets/backgrounds/bg01.png` を表示

### 7.2 URL クエリ対応

```
?filter=vignette           → 起動時に Vignette を適用
?filter=rain               → 起動時に Rain を適用（animated 自動開始）
```

Playwright 等の自動テストから特定フィルターを直接指定可能。

### 7.3 グローバル公開

```typescript
(window as any).__FILTER_APP__ = app;
(window as any).__FILTER_READY__ = true;
```

---

## 8. スクリプトからの利用例

```ks
; 夜のシーン
@screenFilter type=night

; 回想シーン（セピア調の古い映画風）
@screenFilter type=oldFilm

; 精神世界（色収差 + 水中）
@screenFilter type=chromaticAberration

; 解除
@screenFilterClear
```

---

## 9. パフォーマンス考慮

| 項目 | 対策 |
|------|------|
| GPU 負荷 | 全フィルターは single-pass（Bloom のみ 13-tap blur で若干重い）。1280×720 なら問題なし |
| メモリ | フィルターインスタンスは `apply()` のたびに生成、`clear()` で破棄。同時に複数フィルターは適用しない |
| Ticker 負荷 | animated フィルターは `deltaMS / 1000` の加算のみ。無視できるレベル |
| Switch 影響 | なし。ポスト処理は Web レンダリング層のみ |

---

## 10. 既存コードへの影響

| ファイル | 変更内容 | 影響範囲 |
|---------|---------|---------|
| `ScreenFilter.ts` | FilterType 拡張、Ticker 引数追加、dispatch 拡張 | WebOpHandler のみ |
| `WebOpHandler.ts` | ScreenFilter コンストラクタに ticker 追加（1 行変更） | なし |
| `PC98Filter.ts` | vertex を `shaderUtils` から import に変更 | 動作変更なし |
| `vite.config.ts` | `filterTest` エントリ追加 | ビルドのみ |
| `KscHostAdapter.ts` | 変更なし | — |

既存の `sepia`, `grayscale`, `blur`, `pc98` フィルターの動作は一切変わらない。
