# GPU macOS 実装計画 — Native Engine ポストプロセス+フィルター+パーティクル

## Context

Native Engine（`packages/native-engine`）の GLRenderer は Phase 2 まで完了（スプライト描画、テキスト、矩形）。
しかし **FBO が確保済みなのにポストプロセスパイプラインが未接続**、Web にある 45 種のフィルターと パーティクルシステムが Native にはゼロ。

macOS 上の OpenGL 3.3 Core で動作するポストプロセスパイプラインを構築し、Web フィルターを Native に移植する。
Metal は現時点では不要（macOS OpenGL は非推奨だが動作する。MetalRenderer は将来 IRenderer 実装として追加可能）。

---

## Phase 3A: ポストプロセスパイプライン基盤（最優先）

**目的**: シーン → FBO → フィルターシェーダー → 画面 のパイプライン接続

### 描画フロー

```
beginFrame()       → sceneFBO バインド、glClear
  [drawSprite/drawRect/drawText → すべて sceneFBO に描画]
endPostProcess()   → FBO 0 に戻す → フルスクリーンクワッドで sceneFBO テクスチャを描画
                     ← フィルター有効時はフィルターシェーダーで描画
                     ← フィルター無効時はパススルーシェーダーで描画
endFrame()         → SDL_GL_SwapWindow
```

### 作業内容

1. **フルスクリーンクワッド頂点シェーダー** (POSTPROCESS_VERT) 追加 — NDC クワッド + UV パススルー
2. **パススルー断片シェーダー** (PASSTHROUGH_FRAG) 追加 — uTexture をそのまま出力
3. `initShaders()` に `passthroughProgram` コンパイル追加
4. `beginFrame()` を `sceneFBO` バインドに変更
5. `endPostProcess()` 実装 — FBO 0 バインド → フルスクリーンクワッド描画
6. `endFrame()` に `endPostProcess()` 呼び出し追加
7. FBO リサイズ対応（ウィンドウサイズ変更時）

### 修正ファイル

- `GLRenderer.hpp` — `passthroughProgram`, `activeFilterProgram`, `endPostProcess()` 追加
- `GLRenderer.cpp` — シェーダーソース追加、beginFrame/endFrame 書き換え

### 検証

`--gl` フラグで起動して **パススルーが元画像と一致** することを確認（フィルターなしで見た目が変わらない）

---

## Phase 3B: IRenderer フィルター API + 最初のフィルター

**目的**: フィルター API を定義し、Vignette フィルターで動作実証

### IRenderer 拡張

```cpp
struct FilterParams {
    float intensity = 1.0f;
    float time = 0.0f;
};

virtual void applyFilter(const std::string& filterType, const FilterParams& params) = 0;
virtual void clearFilter() = 0;
```

- SoftRenderer: no-op 実装
- GLRenderer: `std::unordered_map<std::string, GLuint> filterPrograms` で遅延コンパイル

### Web → Native GLSL 変換ルール

| Web (GLSL 300 es / PixiJS) | Native 330 core (macOS) | Native 300 es (iOS/Android) |
|---|---|---|
| `#version 300 es` | `#version 330 core` | そのまま |
| `precision mediump float;` | 削除 | そのまま |
| `in vec2 vTextureCoord;` | `in vec2 vUV;` | `in vec2 vUV;` |
| `out vec4 finalColor;` | `out vec4 fragColor;` | `out vec4 fragColor;` |
| `${GLSL_HASH}` テンプレートリテラル | C++ 文字列にインライン | 同左 |
| Pre-multiplied alpha 処理 | **削除**（Native は straight alpha） | **削除** |

### 最初のテスト: VignetteFilter

Web の `VignetteFilter.ts` の GLSL を上記ルールで変換して `GLRenderer` に組み込む。

### 修正/作成ファイル

- `IRenderer.hpp` — `applyFilter` / `clearFilter` 追加
- `SoftRenderer.cpp` — no-op 実装
- `GLRenderer.cpp` — フィルタープログラム管理、Vignette シェーダー
- `FilterShaders.hpp`（新規）— フィルターシェーダーソース集約

---

## Phase 3C: 全フィルター一括移植

**目的**: Web の 20 カスタム GLSL フィルターを Native に移植

### 移植順序（段階的）

| 順序 | カテゴリ | フィルター | 備考 |
|:---:|---|---|---|
| 1 | 静的ポストプロセス | vignette, night, colorTint, focusBlur, bloom, noise, pixelate, chromaticAberration | uTime 不要、最も単純 |
| 2 | アニメーション | CRT, oldFilm, glitch, gameboy, underwater | uTime uniform 更新が必要 |
| 3 | パーティクル系 | rain, snow, sakura, firefly, sparkle, dust | 最も複雑な GLSL |
| 4 | 色行列系 | morning, sunset, sepia, warm 等 25 種 | **1つのシェーダー** + 4x5 行列パラメータ |

### カラーマトリクスフィルター（1シェーダーで 25 種対応）

```glsl
uniform mat4 uColorMatrix;
uniform vec4 uColorOffset;
void main() {
    vec4 tex = texture(uTexture, vUV);
    vec3 result = (uColorMatrix * vec4(tex.rgb, 1.0)).rgb + uColorOffset.rgb;
    fragColor = vec4(clamp(result, 0.0, 1.0), tex.a);
}
```

各フィルター種別の行列値は `ScreenFilter.createFilter()` から抽出。

### 作成ファイル

- `FilterShaders.hpp` — 全フィルター断片シェーダー（330 core / 300 es 両バージョン）
- `FilterPipeline.hpp/cpp`（新規）— フィルター管理、プログラムコンパイル、uniform ディスパッチ

---

## Phase 4: パーティクルシステム

**目的**: CPU ベースパーティクル + GPU スプライト描画

### アーキテクチャ

```
ParticleEmitter (CPU)
  ├ Particle[] { pos, vel, life, size, alpha, color }
  ├ update(dt): 物理演算、生成、消滅
  └ render(IRenderer&): drawSprite × 粒子数（Add ブレンド）

ParticleManager
  ├ vector<ParticleEmitter>
  ├ update(dt) / render(IRenderer&)
  └ SDL2Engine が所有
```

- 最大粒子数 500（VN 用途なら十分、60fps で余裕）
- CPU ベースは Switch NVN に移植容易

### 作成ファイル

- `Particle.hpp` — 構造体定義
- `ParticleEmitter.hpp/cpp` — 生成/更新/描画
- `ParticleManager.hpp/cpp` — 管理クラス

---

## Phase 5: クリーンアップ・ビルド

1. **`Shader.cpp/hpp` 削除** — GLRenderer に統合済みで不使用
2. **CMakeLists.txt iOS/Android 対応**:
   ```cmake
   if(APPLE AND NOT IOS)
       find_library(OPENGL_LIBRARY OpenGL)
   elseif(IOS)
       find_library(OPENGLES_LIBRARY OpenGLES)
   elseif(ANDROID)
       target_link_libraries(... GLESv3 EGL)
   endif()
   ```
3. **スクリーンショットテスト拡張** — フィルター適用画面が黒でないことを確認

---

## 設計判断

| 判断 | 理由 |
|---|---|
| Metal は今やらない | macOS OpenGL 3.3 Core で十分。将来 MetalRenderer を IRenderer 下に追加すればよい |
| 文字列ベースのフィルター種別 | スクリプト `@overlay type=rain` と直結。enum 管理不要 |
| Pre-multiplied alpha 行を削除 | PixiJS は pre-multiplied、SDL2 は straight alpha。残すとフリンジ発生 |
| CPU パーティクル | Switch NVN に compute shader 互換がない。VN の粒子数なら CPU で十分 |
| 遅延シェーダーコンパイル | 全 45 種を起動時にコンパイルは無駄。初回 applyFilter 時に遅延コンパイル |

---

## 検証手順

### Phase 3A 検証
```bash
cd packages/native-engine/build && cmake .. && make -j4
./kaedevn_native --gl
# → 画面が従来と同じに表示される（パススルーが正しい）
```

### Phase 3B 検証
```bash
# KS スクリプトで overlay テスト
@overlay type=vignette intensity=0.8
# → 四隅が暗くなる
@overlay_hide
# → 元に戻る
```

### Phase 3C 検証
```bash
# 各フィルターを順に適用して目視確認
# + ScreenshotTest.cpp でフィルター適用画像が非黒/非同一であることを自動検証
cd build && ctest --test-dir . -R Screenshot
```
