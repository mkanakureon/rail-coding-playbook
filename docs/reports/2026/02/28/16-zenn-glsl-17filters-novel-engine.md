---
title: "ノベルゲームにGLSLフィルター17種を一括実装した：PC98風からグリッチまで全設計"
emoji: "🎨"
type: "tech"
topics: ["claudecode", "glsl", "pixijs", "webgl", "gamedev"]
published: false
---

## はじめに

ノベルゲームエンジンに**ポスト処理エフェクトフィルター17種**を実装した。PC98風の16色パレット、CRTの走査線、グリッチノイズ、雨のパーティクル——すべて GLSL シェーダーで書き、PixiJS v8 の `Filter` API に統合した。

エディタからはドロップダウン1つでフィルターを選べる。KSCスクリプトからは `filter(type="crt")` の1行で適用できる。

この記事では**シェーダーの設計パターン**と、17種のフィルターを**分類・管理する設計**を解説する。

## 全17フィルター一覧

| カテゴリ | フィルター | 手法 |
|----------|-----------|------|
| **基本** | sepia / grayscale / blur | PixiJS 内蔵 ColorMatrix / BlurFilter |
| **レトロ** | pc98 | Bayer 8x8 ディザ + パレット量子化 |
| | gameboy | 4色パレット + ドット化 |
| | crt | バレル歪み + RGB蛍光体 + 走査線 |
| | pixelate | ピクセル化 |
| **色調** | vignette / colorTint / night / bloom / focusBlur | 色調変換・ぼかし系 |
| **異常演出** | chromaticAberration / oldFilm / noise / glitch | RGBずれ・ノイズ系 |
| **環境** | rain / underwater | プロシージャル自然現象 |

基本3種は PixiJS 内蔵フィルターを使い、残り14種が**カスタム GLSL シェーダー**。

## アーキテクチャ：ファクトリー + ライフサイクル管理

```
ScreenFilter (ファクトリー)
├── createFilter(type) → Filter
├── apply(type, intensity) → stage に適用
├── clear() → stage から除去 + ticker 停止
└── startTimeUpdate(filter) → アニメーションフィルターの time 更新
```

### 設計判断：1画面1フィルター

同時に適用できるフィルターは**1つだけ**。新しいフィルターを `apply()` すると、前のフィルターは自動で `clear()` される。

```typescript
apply(type: FilterType, intensity?: number): void {
  this.clear();  // 前のフィルターを除去
  const filter = this.createFilter(type, intensity);
  this.activeFilter = filter;
  this.stage.filters = [filter];
  // アニメーションフィルターならティッカーに登録
  if (this.isAnimated(filter)) {
    this.startTimeUpdate(filter);
  }
}
```

複数フィルターの合成も技術的には可能だが、ノベルゲームでは「夜＋雨」のような組み合わせより、**場面ごとに1つの雰囲気を出す**使い方が自然。複雑さを避けた。

## GLSL シェーダーの共通パターン

### 1. 頂点シェーダー（全フィルター共通）

```glsl
#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize, uOutputFrame, uOutputTexture;

void main() {
  gl_Position = vec4(
    (aPosition * uOutputFrame.zw + uOutputFrame.xy)
    * uOutputTexture.zw * 2.0 - 1.0, 0.0, 1.0);
  vTextureCoord = aPosition * (uInputSize.xy * uOutputTexture.zw);
}
```

### 2. プリマルチプライ・アルファの処理

PixiJS はプリマルチプライド・アルファを前提としている。すべてのフラグメントシェーダーで以下のパターンを守る：

```glsl
vec4 color = texture(uTexture, uv);
if (color.a > 0.0) color.rgb /= color.a;  // アンプリマルチプライ
// ... エフェクト処理 ...
color.rgb *= color.a;  // リプリマルチプライ
finalColor = color;
```

これを忘れると半透明部分が黒ずむ。14種のシェーダーすべてにこのボイラープレートがある。

### 3. 共有ユーティリティ（shaderUtils.ts）

```glsl
// 輝度計算（Rec.601）
float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// 擬似乱数ハッシュ
float hash(vec2 p) { ... }

// 2Dバリューノイズ
float noise2d(vec2 p) { ... }
```

ノイズ系フィルター（glitch, oldFilm, noise, rain）はすべてこのハッシュ関数を使う。

## 注目フィルター解説

### PC98Filter：8x8 Bayer ディザリング

1980年代の PC-9801 の画面を再現するフィルター。

```glsl
// Bayer 8x8 ディザマトリクス（64要素）
int m[64] = int[64](0,32,8,40,...);
int threshold = m[(py % 8) * 8 + (px % 8)];
float dither = (float(threshold) / 64.0 - 0.5) * uDitherStrength;

// パレット量子化
color.rgb = floor((color.rgb + dither) * uColorLevels) / uColorLevels;
```

処理パイプライン：ガンマ補正 → 彩度調整 → ディザリング → パレット量子化 → 走査線。

`uColorLevels = 32` がデフォルト。`8` にすると本格的な16色感が出る。

### CRTFilter：4層の合成

CRTモニターの再現には4つのエフェクトを重ねる：

1. **バレル歪み**：`uv += uv * offset * offset` でブラウン管の湾曲を再現
2. **RGB蛍光体**：`int(mod(pixelCoord.x * 3.0, 3.0))` でサブピクセルパターン
3. **走査線**：`sin(pixelCoord.y * π)` の明暗
4. **ビネット**：`smoothstep(0.7, 0.3, dist)` で周辺減光

### RainFilter：3層プロシージャル雨

```glsl
// 3つのスケールで奥行き感を出す
float r = rainLayer(uv, 1.0, 1.0, t)
        + rainLayer(uv, 1.5, 0.8, t) * 0.7
        + rainLayer(uv, 2.5, 0.6, t) * 0.4;
```

各レイヤーは異なるスケールと速度で降る。ハッシュ関数で列ごとに幅と長さをランダム化。`uAngle` で風向きを制御できる。

### GlitchFilter：時間駆動のバンドノイズ

```glsl
float t = floor(uTime * uSpeed);  // 離散化された時間
float bandNoise = hash(vec2(float(band), t));
if (bandNoise > 1.0 - uIntensity) {
  uv.x += (hash(vec2(t, float(band))) - 0.5) * 0.1;
}
```

`floor()` で時間を離散化して「コマ落ち感」を出す。PixiJS の Ticker が `filter.time` をインクリメントするので、フレームごとにエフェクトが変化する。

## エディタとの統合

エディタではカテゴリ分けしたドロップダウンから選択できる：

```tsx
<select value={block.filterType}>
  <option value="">なし（解除）</option>
  <optgroup label="基本">
    <option value="sepia">セピア</option>
    ...
  </optgroup>
  <optgroup label="レトロ">
    <option value="pc98">PC-9801風</option>
    <option value="crt">CRTモニター</option>
    ...
  </optgroup>
</select>
```

KSCスクリプトからは：

```
filter(type="pc98", intensity=0.8)
filter_clear()
```

コンパイラが `filter` / `filter_clear` を認識し、インタプリタ → エンジン API → `ScreenFilter.apply()` と伝搬する。

## 実装の振り返り

### よかった点

- **ファクトリーパターンで17種を管理できた**。switch 文1つで新フィルターを追加できる
- **GLSL の共通パターン（プリマルチプライ、shaderUtils）を先に決めた**のが効いた
- **アニメーションフィルターの時間更新**がティッカーの1行で済む設計は綺麗

### 注意点

- **解像度ハードコード**（1280x720）が一部のフィルターにある。リサイズ対応が必要
- **フィルターの重ね掛け**は対応していない。「夜の雨」は将来課題
- **パフォーマンス未計測**。Bloom の 13-tap ガウスぼかしはモバイルで重い可能性

### 数字で見る

| 指標 | 値 |
|------|-----|
| フィルター総数 | 17種（内蔵3 + カスタム14） |
| 新規ファイル | 16（ScreenFilter + 14フィルター + shaderUtils） |
| GLSL行数 | 約800行 |
| TypeScript行数 | 約1,200行 |
| エディタUI | ScreenFilterBlockCard.tsx（101行） |

## まとめ

ノベルゲームの画面エフェクトは「雰囲気を一発で変える」道具。PC98のノスタルジー、CRTのレトロ感、雨の空気感——シェーダー1つで画面全体の印象が変わる。

PixiJS v8 の `Filter` API は GLSL ES 3.0 をそのまま書けるので、WebGL に詳しくなくてもフラグメントシェーダーのロジックに集中できる。17種もあれば、ノベルゲームの演出としては十分すぎるほどだ。

---
17種のシェーダーを書いた。雨を降らせ、画面を歪ませ、16色に減色した。
コードとしては switch 文が1つ増えるだけのことだが、
フィルター越しに見える画面は、たしかに別の世界になっていた。

　　　　　　　　　　Claude Opus 4.6
