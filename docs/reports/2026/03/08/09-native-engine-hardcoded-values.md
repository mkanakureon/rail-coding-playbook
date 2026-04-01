# Native Engine ハードコード値の整理

## 現状

`packages/native-engine` の C++ ソースコードには、論理解像度やUI座標がハードコードされている箇所が多数ある。現在は 2560x1440 に統一済みだが、将来の解像度変更やマルチ解像度対応時に一括変更が必要になる。

## ハードコード箇所一覧

### 1. 論理解像度 (main.cpp)

| 箇所 | 値 | 用途 |
|------|---|------|
| `SDL_RenderSetLogicalSize(renderer, 2560, 1440)` | 2560x1440 | レンダラーの論理解像度 |

### 2. 背景描画サイズ (SDL2Engine.cpp: render())

| 箇所 | 値 | 用途 |
|------|---|------|
| `drawTexture(prevBg, 0, 0, 2560, 1440, false)` | 2560x1440 | 背景画像のフルスクリーン描画 |
| `drawTexture(currentBg, 0, 0, 2560, 1440, false)` | 同上 | 同上（トランジション中・通常表示） |

### 3. キャラクター位置 (SDL2Engine.cpp: render())

| 箇所 | 値 | 用途 |
|------|---|------|
| `drawTexture(fullSlug, ch.x, 200, -1, -1, true)` | y=200 | キャラ立ち絵の上端 Y 座標 |

### 4. テキストウィンドウ (SDL2Engine.cpp: render())

| 箇所 | 値 | 用途 |
|------|---|------|
| `SDL_Rect win = { 120, 960, 2320, 400 }` | 120,960,2320,400 | テキストウィンドウの矩形 |
| `SDL_Rect nameBox = { 160, 900, 400, 70 }` | 160,900,400,70 | 話者名背景の矩形 |
| `renderText(currentSpeaker, 180, 906, ...)` | 180,906 | 話者名テキスト位置 |
| `renderText(currentText, 180, 1000, ..., 2200)` | 180,1000,wrap=2200 | 本文テキスト位置・折返し幅 |
| `renderText("Click or press...", 180, 1020, ...)` | 180,1020 | 初期メッセージ位置 |
| `renderText(">> SKIP MODE", 2200, 60, ...)` | 2200,60 | スキップモード表示位置 |

### 5. ヒストリーオーバーレイ (SDL2Engine.cpp: renderHistoryOverlay())

| 箇所 | 値 | 用途 |
|------|---|------|
| `SDL_Rect full = { 0, 0, 2560, 1440 }` | 2560x1440 | 半透明オーバーレイ全体 |
| `renderText("HISTORY", 100, 60, ...)` | 100,60 | タイトル位置 |
| `renderText(label, 160, y, ..., 2200)` | 160,y,wrap=2200 | 履歴テキスト位置・折返し幅 |
| `y += 120` | 120 | 履歴エントリ間隔 |

### 6. キャラクター配置座標 (Interpreter.cpp: handleCommand())

| 箇所 | 値 | 用途 |
|------|---|------|
| `x = 1280` | 1280 | center 位置 |
| `x = 640` | 640 | left 位置 |
| `x = 1920` | 1920 | right 位置 |

### 7. フォントサイズ (main.cpp)

| 箇所 | 値 | 用途 |
|------|---|------|
| `loadFont("main", fp, 48)` | 48pt | メインフォント |
| `loadFont("bold", fp, 40)` | 40pt | 太字フォント |

## 推奨改善案

### Phase 1: 定数化（最小工数）

```cpp
// engine/EngineConfig.hpp
namespace kaedevn {
    constexpr int LOGICAL_W = 2560;
    constexpr int LOGICAL_H = 1440;
    constexpr int TEXT_WIN_X = 120;
    constexpr int TEXT_WIN_Y = 960;
    constexpr int TEXT_WIN_W = 2320;
    constexpr int TEXT_WIN_H = 400;
    constexpr int FONT_SIZE_MAIN = 48;
    constexpr int FONT_SIZE_BOLD = 40;
    // ...
}
```

### Phase 2: レイアウト相対化

座標を論理解像度に対する割合で指定し、解像度変更時に自動でスケールされるようにする。

```cpp
// テキストウィンドウ: 画面下部 2/3 の位置、幅は画面の 90%
int winX = LOGICAL_W * 0.05;
int winY = LOGICAL_H * 0.667;
int winW = LOGICAL_W * 0.90;
int winH = LOGICAL_H * 0.278;
```

### Phase 3: 外部定義ファイル（JSON/YAML）

レイアウトをデータファイルとして外出しし、ビルドなしで調整可能にする。Switch/Web/iOS でテーマを共有できる。

## 変更履歴

| 日付 | 解像度 | 理由 |
|------|--------|------|
| 初期 | 1280x720 | 仕様の基本解像度 |
| 2026-03-08 | 2560x1440 | iOS Retina 対応で 2x 化 |
