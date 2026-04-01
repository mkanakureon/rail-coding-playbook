# PC-98 風ポスト処理フィルター 実装結果報告書

**日付**: 2026-02-28
**対象**: `packages/web` (PixiJS v8.16.0 / WebGL)

---

## 1. 概要

1280×720 の画面解像度を維持したまま、色味だけを PC-98 風にするポスト処理フィルターを実装した。
PixiJS v8 の `Filter` クラスを継承し、カスタム GLSL シェーダーで以下の処理をパイプラインとして実行する。

```
入力テクスチャ → ガンマ補正 → 彩度調整 → Bayer ディザ → パレット量子化 → スキャンライン → 出力
```

## 2. 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `packages/web/src/renderer/PC98Filter.ts` | 新規 | カスタム GLSL フィルター本体 |
| `packages/web/src/renderer/ScreenFilter.ts` | 修正 | `FilterType` に `"pc98"` 追加 |
| `packages/web/pc98-test.html` | 新規 | ブラウザテスト用ページ |
| `packages/web/src/pc98-test.ts` | 新規 | テストページのエントリポイント |
| `packages/web/vite.config.ts` | 修正 | ビルド入力に `pc98Test` 追加 |
| `scripts/pc98-screenshot.mjs` | 新規 | Playwright によるスクリーンショット自動撮影 |

## 3. スクリーンショット

`screenshots/2026-02-28/` に保存：

| ファイル | 内容 |
|---------|------|
| `pc98-filter-OFF.png` | オリジナル（フィルターなし） |
| `pc98-filter-8colors.png` | 8色量子化 |
| `pc98-filter-16colors.png` | 16色量子化 |
| `pc98-filter-32colors.png` | 32色量子化 |

---

## 4. PixiJS v8 カスタムフィルター作成ガイド

### 4.1 アーキテクチャ

PixiJS v8 のフィルターは以下の3層で構成される：

```
Filter (TypeScript クラス)
  ├── GlProgram (GLSL vertex + fragment シェーダー)
  ├── UniformGroup (CPU → GPU に渡すパラメータ)
  └── resources (UniformGroup をまとめたオブジェクト)
```

**最小構成:**

```typescript
import { Filter, GlProgram, UniformGroup } from "pixi.js";

const glProgram = GlProgram.from({
  vertex: vertexShaderSource,
  fragment: fragmentShaderSource,
  name: "my-filter",
});

class MyFilter extends Filter {
  constructor() {
    super({
      glProgram,
      resources: {
        myUniforms: new UniformGroup({
          uParam: { value: 1.0, type: "f32" },
        }),
      },
    });
  }
}
```

### 4.2 GLSL バージョンの罠（重要）

`GlProgram.from()` は **シェーダーソースに `#version 300 es` が含まれているかどうか**で挙動が変わる。

```javascript
// pixi.js/lib/rendering/renderers/gl/shader/GlProgram.js
const isES300 = options.fragment.indexOf("#version 300 es") !== -1;
```

| `#version 300 es` | 結果 |
|---|---|
| **あり** | GLSL ES 3.0 としてそのままコンパイル |
| **なし** | WebGL1 互換マクロが自動注入され、**GLSL ES 1.0 にフォールバック** |

**フォールバック時に注入されるマクロ（fragment）:**

```glsl
#ifdef GL_ES
#define in varying
#define finalColor gl_FragColor
#define texture texture2D
#endif
```

つまり `in`, `out`, `texture()` は ES 1.0 互換に変換されるが、以下の ES 3.0 機能は使えなくなる：

- `int[64] = int[64](...)` — 配列コンストラクタ初期化
- `%` 整数モジュロ演算子
- 動的配列インデックス（`m[idx]` で idx が非 const）

**結論:** カスタムシェーダーには必ず `#version 300 es` を先頭に書く。

```glsl
// NG — フォールバックで壊れる
const fragment = `
in vec2 vTextureCoord;
...`;

// OK
const fragment = `#version 300 es
precision mediump float;

in vec2 vTextureCoord;
...`;
```

vertex シェーダーも同様。vertex/fragment の両方に `#version 300 es` を入れること。

### 4.3 Vertex シェーダー（テンプレート）

フィルター用の vertex シェーダーは基本的に全フィルター共通。以下をそのまま使える。

```glsl
#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
```

**PixiJS が自動的に提供する uniform:**

| uniform | 型 | 内容 |
|---------|------|------|
| `uInputSize` | `vec4` | (幅, 高さ, 1/幅, 1/高さ) — テクスチャサイズ |
| `uOutputFrame` | `vec4` | (x, y, width, height) — 出力領域 |
| `uOutputTexture` | `vec4` | 出力テクスチャ情報 |
| `uTexture` | `sampler2D` | 入力テクスチャ（フィルター対象の描画結果） |

これらは宣言するだけで PixiJS が値をセットしてくれる。

### 4.4 Fragment シェーダー（テンプレート）

```glsl
#version 300 es
precision mediump float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// ↓ 自分の uniform をここに追加
uniform float uMyParam;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);

    // PixiJS は premultiplied alpha を使うので、処理前に戻す
    if (color.a > 0.0) {
        color.rgb /= color.a;
    }

    // ここに色処理を書く
    color.rgb *= uMyParam;

    // 処理後に premultiplied alpha に戻す
    color.rgb *= color.a;

    finalColor = color;
}
```

**重要: Premultiplied Alpha**

PixiJS はデフォルトで premultiplied alpha を使う。色処理の前に `color.rgb /= color.a` で戻し、処理後に `color.rgb *= color.a` で掛け直す。これを忘れると半透明領域の色がおかしくなる。

### 4.5 UniformGroup の型

| type | GLSL 型 | 例 |
|------|---------|-----|
| `"f32"` | `float` | `uGamma: { value: 0.95, type: "f32" }` |
| `"i32"` | `int` | `uMode: { value: 1, type: "i32" }` |
| `"vec2<f32>"` | `vec2` | `uSize: { value: [1280, 720], type: "vec2<f32>" }` |
| `"vec3<f32>"` | `vec3` | `uColor: { value: [1, 0, 0], type: "vec3<f32>" }` |
| `"vec4<f32>"` | `vec4` | `uRect: { value: [0, 0, 1, 1], type: "vec4<f32>" }` |
| `"mat3x3<f32>"` | `mat3` | 行列 |

### 4.6 TypeScript 側でのパラメータアクセス

getter/setter で uniform を公開すると、ランタイムにパラメータを変更できる。

```typescript
get myParam(): number {
  return this.resources.myUniforms.uniforms.uMyParam;
}
set myParam(value: number) {
  this.resources.myUniforms.uniforms.uMyParam = value;
}
```

---

## 5. PC98Filter シェーダー処理の詳細

### 5.1 処理パイプライン

```
テクスチャ読取 → Un-premultiply → ガンマ → 彩度 → ディザ → 量子化 → スキャンライン → Premultiply → 出力
```

各ステージは独立しており、不要なものは uniform を調整して無効化できる。

### 5.2 ガンマ補正

```glsl
color.rgb = pow(color.rgb, vec3(1.0 / uGamma));
```

- `uGamma < 1.0` → 明るくなる（シャドウが持ち上がる）
- `uGamma = 1.0` → 変化なし
- `uGamma > 1.0` → 暗くなる（コントラスト増）

PC-98 のモニターは現代より暗めなので、デフォルト `0.95` でわずかに明るく補正。

**応用例:** CRT エミュレーションでは `uGamma = 1.1〜1.3` で黒を締める。

### 5.3 彩度調整

```glsl
float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
color.rgb = mix(vec3(luma), color.rgb, uSaturation);
```

ITU-R BT.601 の輝度係数でグレースケールを求め、`mix()` で元色とブレンドする。

- `uSaturation = 0.0` → 完全グレースケール
- `uSaturation = 0.5` → 半分の彩度
- `uSaturation = 1.0` → 変化なし
- `uSaturation > 1.0` → 過飽和（彩度ブースト）

**応用例:**
- セピア調 → 彩度 0 + カラーオフセット `color.rgb += vec3(0.1, 0.05, 0.0)`
- 回想シーン → 彩度 0.3 + ガンマ 0.85
- ホラー演出 → 彩度 0.2 + 赤みシフト

### 5.4 Bayer 8×8 Ordered Dithering

```glsl
float bayer8x8(ivec2 p) {
    int m[64] = int[64](
         0, 32,  8, 40,  2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44,  4, 36, 14, 46,  6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
         3, 35, 11, 43,  1, 33,  9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47,  7, 39, 13, 45,  5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
    );
    int idx = (p.y % 8) * 8 + (p.x % 8);
    return float(m[idx]) / 64.0 - 0.5;  // 範囲: -0.5 ~ +0.484375
}
```

**Bayer ディザリングとは:**

限られた色数で中間色を表現するための技法。8×8 ピクセルの各位置に「閾値」が割り当てられており、ピクセルの色をこの閾値でずらしてから量子化することで、マクロ的に中間色に見える規則的パターンを生成する。

**なぜ Bayer（ordered）か:**
- ランダムディザ → 毎フレームノイズが変わりちらつく
- Floyd-Steinberg → 前ピクセルに依存するため GPU 並列化不可
- **Bayer → 座標だけで決定。GPU フレンドリー。静止画でも安定**

**適用方法:**

```glsl
ivec2 pixelCoord = ivec2(gl_FragCoord.xy);
float dither = bayer8x8(pixelCoord);
color.rgb += dither * uDitherStrength / uColorLevels;
```

`uDitherStrength / uColorLevels` で正規化することで、色レベル数に依存せず自然なディザになる。

- `uDitherStrength = 0.0` → ディザなし（ベタ塗り量子化）
- `uDitherStrength = 0.5` → 標準（PC-98 風）
- `uDitherStrength = 1.0` → 強め（パターンが目立つ）

**応用: 4×4 Bayer（軽量版）**

```glsl
float bayer4x4(ivec2 p) {
    int m[16] = int[16](
         0,  8,  2, 10,
        12,  4, 14,  6,
         3, 11,  1,  9,
        15,  7, 13,  5
    );
    int idx = (p.y % 4) * 4 + (p.x % 4);
    return float(m[idx]) / 16.0 - 0.5;
}
```

パターンが粗くなるが演算が軽い。モバイル向けや意図的に粗くしたい場合に。

### 5.5 パレット量子化

```glsl
color.rgb = floor(color.rgb * uColorLevels) / uColorLevels;
color.rgb = clamp(color.rgb, 0.0, 1.0);
```

RGB 各チャンネルを `uColorLevels` 段階に丸める。

- `uColorLevels = 8` → チャンネルあたり 8 段階 = 最大 512 色（実質少ない）
- `uColorLevels = 16` → 4096 色空間
- `uColorLevels = 32` → 32768 色空間

**注意:** PC-98 は「同時表示 16 色」だが、パレットから選べる色自体は 4096 色。ここでの `colorLevels` は「各チャンネルの階調数」であり「同時表示色数」とは異なる。PC-98 の雰囲気再現としては 16〜32 が適切。

**応用: 固定パレットへのスナップ**

完全に PC-98 を再現する場合は、量子化ではなく固定パレットへの最近傍色マッチングを使う：

```glsl
// 例: 16 色パレットテーブル（uniform でテクスチャとして渡す）
uniform sampler2D uPalette;  // 16×1 のテクスチャ

vec3 nearestPaletteColor(vec3 color) {
    float minDist = 999.0;
    vec3 best = vec3(0.0);
    for (int i = 0; i < 16; i++) {
        vec3 pal = texelFetch(uPalette, ivec2(i, 0), 0).rgb;
        float d = distance(color, pal);
        if (d < minDist) { minDist = d; best = pal; }
    }
    return best;
}
```

### 5.6 スキャンライン

```glsl
float scanline = 1.0 - uScanlineStrength * float(pixelCoord.y % 2);
color.rgb *= scanline;
```

偶数行を暗くすることで CRT モニターの走査線を模倣する。

- `uScanlineStrength = 0.0` → スキャンラインなし
- `uScanlineStrength = 0.08` → 薄め（デフォルト、PC-98 風）
- `uScanlineStrength = 0.2` → はっきり見える
- `uScanlineStrength = 0.5` → 強い CRT 感

**応用: より高品質なスキャンライン**

```glsl
// sin 波で滑らかなスキャンライン
float scanline = 1.0 - uScanlineStrength * sin(float(pixelCoord.y) * 3.14159);

// 解像度依存の自動調整
float scanline = 1.0 - uScanlineStrength
    * (0.5 + 0.5 * sin(float(pixelCoord.y) * 3.14159 * uInputSize.y / 360.0));
```

---

## 6. 他のエフェクトへの応用例

このフィルターの構造をベースに、以下のようなエフェクトが作れる。

### 6.1 Game Boy 風フィルター

```typescript
new CustomFilter({
  colorLevels: 4,        // 4 階調
  ditherStrength: 0.6,
  saturation: 0.0,       // 完全グレースケール
  gamma: 0.9,
  scanlineStrength: 0.0,
  // + 緑がかった色シフト（fragment に追加）
  // color.rgb = mix(color.rgb, vec3(0.06, 0.22, 0.06) * luma, 0.8);
})
```

### 6.2 セピア + 色収差（古写真風）

fragment に追加するコード：

```glsl
// 色収差（chromatic aberration）
float offset = 0.002;
float r = texture(uTexture, vTextureCoord + vec2(offset, 0.0)).r;
float g = texture(uTexture, vTextureCoord).g;
float b = texture(uTexture, vTextureCoord - vec2(offset, 0.0)).b;
color.rgb = vec3(r, g, b);

// セピアトーン
float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
color.rgb = vec3(luma * 1.2, luma * 1.0, luma * 0.8);
```

### 6.3 グリッチエフェクト

```glsl
uniform float uTime;
uniform float uGlitchStrength;

// 行単位の水平ずれ
float shift = uGlitchStrength * sin(float(pixelCoord.y) * 0.1 + uTime * 10.0);
vec2 shiftedUV = vTextureCoord + vec2(shift * uInputSize.z, 0.0);
color = texture(uTexture, shiftedUV);
```

### 6.4 ScreenFilter への統合パターン

新しいフィルターを追加する手順：

```typescript
// 1. FilterType に追加
export type FilterType = "sepia" | "grayscale" | "blur" | "pc98" | "gameboy";

// 2. apply() に case 追加
case "gameboy": {
    const f = new GameBoyFilter();
    this.gameboyFilter = f;
    this.stage.filters = [f];
    break;
}

// 3. clear() にクリーンアップ追加
this.gameboyFilter = null;
```

---

## 7. テスト方法

```bash
# テストページ
cd packages/web && npm run dev
# http://localhost:5175/pc98-test.html          — 32色（デフォルト）
# http://localhost:5175/pc98-test.html?colors=8  — 8色
# http://localhost:5175/pc98-test.html?colors=16 — 16色
# P キーでフィルター ON/OFF

# 自動スクリーンショット（Vite 起動中に別ターミナルで）
node scripts/pc98-screenshot.mjs
# → screenshots/YYYY-MM-DD/ に保存
```

## 8. 既知の制約

- **WebGL 専用**: Canvas2D レンダラーではカスタムフィルターがスキップされる（PixiJS の制限）
- **ヘッドレスブラウザ**: Playwright headless モードでは WebGL が使えない場合がある。スクリーンショット撮影時は `headless: false` + `--enable-webgl` フラグが必要
- **WebGPU 未対応**: `GpuProgram` を省略しているため WebGPU レンダラーではスキップされる。対応する場合は WGSL シェーダーの追加が必要
- **暗い画像での効果**: 元画像が暗い場合、量子化の効果が見えにくい。明るくカラフルなシーンで効果が顕著になる
