# PC-98 風エフェクト 実現可能性検討

- 日付: 2026-02-28
- ステータス: 検討完了
- 元仕様: `docs/01_in_specs/0228/pc98.md`

## 1. 要件の整理

元仕様の結論として、以下の方針が決定されている。

| 項目 | 方針 |
|------|------|
| 解像度 | 1280×720 を維持（現代風のまま） |
| レトロ感の表現手段 | **色味のみ** に限定（ドット感・ビットマップフォントは対象外） |
| 適用範囲 | Scene Layer（背景・立ち絵）優先。UI Layer は可読性を優先し軽めに |

つまり「画面レイアウトは今のまま、色味だけ PC-98 寄りにする」という要件。

### 必要な色処理

| 処理 | 説明 | 優先度 |
|------|------|--------|
| パレット量子化 | フルカラーを 32 or 64 色の固定パレットにスナップ | 必須 |
| Ordered Dithering | Bayer 8×8 でパレット化ののっぺり感を軽減 | 推奨 |
| ガンマ・彩度・コントラスト | 少し暗め、彩度低め、黒の締まり | 推奨 |
| スキャンライン | 1px おきに 5〜12% 暗化 | 任意 |

---

## 2. 現在のエフェクト基盤

### 2.1 Op 命令（`packages/core/src/types/Op.ts`）

```typescript
| { op: "SCREEN_FILTER"; filter: string; intensity?: number }
| { op: "SCREEN_FILTER_CLEAR" }
```

`filter` が文字列型なので、新しいフィルター名を追加するだけで Op の変更は不要。

### 2.2 ScreenFilter クラス（`packages/web/src/renderer/ScreenFilter.ts`）

```typescript
export type FilterType = "sepia" | "grayscale" | "blur";

export class ScreenFilter {
  apply(type: FilterType, intensity?: number): void { ... }
  clear(): void { ... }
}
```

- PixiJS の `ColorMatrixFilter` / `BlurFilter` を使用
- `stage.filters` にフィルター配列をセットするポスト処理方式
- **カスタムフィルターの追加が容易な構造**

### 2.3 KSC コマンド（`packages/ksc-compiler/src/checker/builtins.ts`）

```
screenFilter(type, intensity)
screenFilterClear()
```

コンパイラ・ランタイム共に対応済み。

### 2.4 レイヤー構成（`packages/web/src/renderer/LayerManager.ts`）

```
Stage
└── LayerManager.root
    ├── backgroundLayer   ← PC-98 エフェクト対象
    ├── characterLayer    ← PC-98 エフェクト対象
    └── uiLayer           ← 通常描画（可読性優先）
```

### 2.5 SDL2 側（`packages/native-engine/`）

- `Shader` クラス（OpenGL ベース）が存在（`Shader.hpp` / `Shader.cpp`）
- GLSL シェーダーのロード・コンパイル・uniform 設定の基盤あり
- 現時点では実稼働していないが、PC-98 エフェクトの受け皿になる

---

## 3. 結論: 既存エフェクトの一種として実現可能

**PC-98 風の色処理は、既存の `screenFilter()` コマンドの拡張として実装できる。**

理由:

1. **Op 命令の変更不要** — `SCREEN_FILTER.filter` が `string` 型なので `"pc98"` を追加するだけ
2. **KSC コマンドの変更不要** — `screenFilter("pc98")` でそのまま呼べる
3. **ポスト処理に閉じる** — 全処理が最終合成時のフラグメントシェーダーで完結し、上位ロジック（シナリオ実行・レイヤー管理）に影響しない
4. **レイヤー単位の適用も可能** — `stage.filters` の代わりに Scene 用コンテナの `filters` にセットすれば UI を除外できる
5. **SDL2/Switch 移植にも対応** — 同じ GLSL を `Shader` クラスで使い回せる

---

## 4. 実装設計

### 4.1 全体構成

```
KSC スクリプト
  screenFilter("pc98")
       ↓
Op: SCREEN_FILTER { filter: "pc98" }
       ↓
ScreenFilter.apply("pc98")
       ↓
┌──────────────────────────────────┐
│  PixiJS Custom Filter (GLSL)    │
│  ┌───────────────────────────┐  │
│  │ 1. パレット量子化 (32色)  │  │
│  │ 2. Bayer 8×8 ディザリング │  │
│  │ 3. ガンマ・彩度補正       │  │
│  └───────────────────────────┘  │
│  + ColorMatrixFilter (補助)     │
│  + Scanline Filter (任意)       │
└──────────────────────────────────┘
       ↓
  stage.filters = [pc98Filter, ...]
```

### 4.2 カスタム GLSL シェーダー（核心部分）

1つのフラグメントシェーダーで パレット量子化 + ディザ を処理する。

```glsl
// PC-98 Look Fragment Shader (概要)
uniform sampler2D uTexture;
uniform float uPaletteSize;    // 32.0 or 64.0
uniform float uDitherStrength; // 0.0 ~ 1.0
uniform float uSaturation;     // 0.0 ~ 1.0
uniform float uGamma;          // 0.8 ~ 1.2

// Bayer 8×8 マトリクス
const mat4 bayerHi = mat4(...);
const mat4 bayerLo = mat4(...);

void main() {
    vec4 color = texture2D(uTexture, vTextureCoord);

    // 1. ガンマ補正
    color.rgb = pow(color.rgb, vec3(uGamma));

    // 2. 彩度調整
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, uSaturation);

    // 3. Bayer ディザ + パレット量子化
    float threshold = getBayerValue(gl_FragCoord.xy) * uDitherStrength;
    float levels = uPaletteSize - 1.0;
    color.rgb = floor(color.rgb * levels + threshold) / levels;

    gl_FragColor = color;
}
```

### 4.3 ScreenFilter.ts の拡張

```typescript
export type FilterType = "sepia" | "grayscale" | "blur" | "pc98";

// apply() 内に case "pc98" を追加
case "pc98": {
    const pc98 = new PC98Filter({
        paletteSize: 32,
        ditherStrength: 0.5,
        saturation: 0.7,
        gamma: 0.95,
    });
    this.stage.filters = [pc98];
    break;
}
```

### 4.4 Scene Layer のみに適用する場合

```typescript
// LayerManager に sceneContainer を追加
// backgroundLayer + characterLayer を包む親コンテナ
const sceneContainer = new Container();
sceneContainer.addChild(backgroundLayer);
sceneContainer.addChild(characterLayer);

// フィルター適用先を sceneContainer にする
sceneContainer.filters = [pc98Filter];
// uiLayer には適用されない
```

### 4.5 LookProfile（将来拡張）

PC-98 以外のレトロ風（ゲームボーイ、ファミコン等）にも対応できるよう、設定をプロファイル化する。

```typescript
interface LookProfile {
    name: string;                              // "pc98" | "gameboy" | "famicom" | ...
    paletteMode: "off" | 16 | 32 | 64;
    dither: "off" | "bayer8";
    ditherStrength: number;                    // 0.0 ~ 1.0
    gamma: number;                             // 0.8 ~ 1.2
    saturation: number;                        // 0.0 ~ 1.0
    contrast: number;                          // 0.0 ~ 1.0
    scanlineStrength: number;                  // 0.0 ~ 1.0
    applyTo: "scene" | "all";
}

const PC98_PROFILE: LookProfile = {
    name: "pc98",
    paletteMode: 32,
    dither: "bayer8",
    ditherStrength: 0.5,
    gamma: 0.95,
    saturation: 0.7,
    contrast: 1.0,
    scanlineStrength: 0.08,
    applyTo: "scene",
};
```

---

## 5. 実装タスク

| # | タスク | 変更対象 | 工数目安 |
|---|--------|---------|---------|
| 1 | PC98Filter クラス（GLSL シェーダー） | `packages/web/src/renderer/PC98Filter.ts` (新規) | 主タスク |
| 2 | ScreenFilter 拡張 | `packages/web/src/renderer/ScreenFilter.ts` | 小 |
| 3 | FilterType に `"pc98"` 追加 | 同上 | 極小 |
| 4 | （任意）Scene コンテナ分離 | `packages/web/src/renderer/LayerManager.ts` | 小 |
| 5 | （任意）LookProfile 型定義 | `packages/core/src/types/LookProfile.ts` (新規) | 小 |
| 6 | （将来）SDL2 シェーダー移植 | `packages/native-engine/src/engine/` | 中 |

**Op 命令・KSC コマンド・コンパイラの変更は不要。**

---

## 6. リスク・注意点

| リスク | 対策 |
|--------|------|
| WebGL 非対応ブラウザでシェーダーが動かない | PixiJS の `Filter` は WebGL 必須だが、現時点で Canvas2D フォールバックは不要（PixiJS は WebGL 前提） |
| パレット量子化でUIテキストが読みにくくなる | `applyTo: "scene"` で UI Layer を除外する |
| パフォーマンス（毎フレームシェーダー処理） | 1280×720 のフラグメントシェーダーは十分軽量。モバイルでも問題なし |
| 32 色パレットの選定 | PC-98 実機の厳密再現ではなく「それっぽい制約」で十分。RGB 各チャンネルを均等に量子化する方式が安定 |
| SDL2/Switch での見た目の一致 | 同一 GLSL を使えば原理的に一致するが、ガンマ特性の差に注意 |
