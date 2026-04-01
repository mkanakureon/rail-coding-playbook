# SDL3 macOS ビルドガイド

**日付**: 2026-02-26

---

## 概要

SDL3 を macOS (Apple Silicon) でビルドし、テストプログラムで動作確認するまでの手順。

---

## 1. 前提条件

| ツール | バージョン | 確認コマンド |
|--------|-----------|-------------|
| macOS | 26.2+ (Apple Silicon) | `sw_vers` |
| Xcode Command Line Tools | 17+ | `xcode-select -p` |
| CMake | 3.16+ | `cmake --version` |
| Apple Clang | 17+ | `cc --version` |

### CMake がない場合

```bash
brew install cmake
```

### Xcode Command Line Tools がない場合

```bash
xcode-select --install
```

---

## 2. SDL ソースの取得

リポジトリに git submodule として登録済み:

```bash
# 初回 clone 後
git submodule update --init packages/sdl

# 確認
ls packages/sdl/CMakeLists.txt
```

---

## 3. ビルド

### 3a. ビルドスクリプトを使う場合（推奨）

```bash
./scripts/build-sdl.sh macos
```

内部で以下を実行:
1. submodule 未取得なら自動で `git submodule update --init`
2. `cmake -S packages/sdl -B packages/sdl/build -DCMAKE_BUILD_TYPE=Release -DSDL_TESTS=ON`
3. `cmake --build packages/sdl/build --config Release -j$(sysctl -n hw.ncpu)`

2回目以降は差分ビルドのみ実行される。

### 3b. 手動でビルドする場合

```bash
cd packages/sdl

# Configure
cmake -S . -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DSDL_TESTS=ON

# Build（CPU コア数に応じて並列）
cmake --build build --config Release -j$(sysctl -n hw.ncpu)
```

### ビルド出力

```
packages/sdl/build/
├── libSDL3.dylib          # 共有ライブラリ（メイン）
├── libSDL3.0.dylib        # バージョン付き共有ライブラリ
├── libSDL3_test.a         # テスト用静的ライブラリ
└── test/                  # テストバイナリ群
    ├── testdraw
    ├── testsprite
    ├── testgl
    └── ...（80+ テスト）
```

---

## 4. 動作確認

### テストプログラム一覧（主要なもの）

| バイナリ | 内容 |
|---------|------|
| `test/testdraw` | 図形描画（線、矩形、点） |
| `test/testsprite` | スプライトが跳ね回るデモ |
| `test/testgl` | OpenGL レンダリング |
| `test/testgles2` | OpenGL ES 2.0 |
| `test/testgpu_simple_clear` | GPU API（Metal/Vulkan） |
| `test/testgpu_spinning_cube` | GPU で回転する立方体 |
| `test/testcontroller` | ゲームパッド入力テスト |
| `test/testaudio` | オーディオ再生 |
| `test/testcamera` | カメラ（WebCam）キャプチャ |
| `test/testautomation` | ユニットテスト一括実行 |

### 実行例

```bash
# 図形描画ウィンドウ（ウィンドウが開いて描画される）
packages/sdl/build/test/testdraw

# スプライトバウンドデモ
packages/sdl/build/test/testsprite

# OpenGL レンダリング
packages/sdl/build/test/testgl

# GPU API で画面クリア
packages/sdl/build/test/testgpu_simple_clear

# 全ユニットテスト
packages/sdl/build/test/testautomation
```

いずれもウィンドウが開き、ESC キーまたはウィンドウ閉じるボタンで終了。

---

## 5. 有効になっているバックエンド

ビルド時に自動検出された macOS 向けバックエンド:

| カテゴリ | ドライバ |
|---------|---------|
| Video | cocoa, dummy, offscreen |
| Render | gpu, metal, opengl, opengl_es2, vulkan |
| GPU | metal, vulkan |
| Audio | coreaudio, disk, dummy |
| Joystick | hidapi, iokit, mfi, virtual |
| Camera | coremedia, dummy |
| Haptic | iokit |

---

## 6. 自分のプログラムからリンクする

### CMakeLists.txt の例

```cmake
cmake_minimum_required(VERSION 3.16)
project(MyGame)

# SDL3 のビルド済みディレクトリを指定
set(SDL3_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../sdl/build")
find_package(SDL3 REQUIRED)

add_executable(mygame main.c)
target_link_libraries(mygame PRIVATE SDL3::SDL3)
```

### 最小サンプル (main.c)

```c
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

int main(int argc, char *argv[]) {
    (void)argc; (void)argv;

    if (!SDL_Init(SDL_INIT_VIDEO)) {
        SDL_Log("SDL_Init failed: %s", SDL_GetError());
        return 1;
    }

    SDL_Window *win = SDL_CreateWindow("Hello SDL3", 800, 600, 0);
    SDL_Renderer *ren = SDL_CreateRenderer(win, NULL);

    int running = 1;
    while (running) {
        SDL_Event e;
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_EVENT_QUIT) running = 0;
        }
        SDL_SetRenderDrawColor(ren, 40, 40, 80, 255);
        SDL_RenderClear(ren);
        SDL_RenderPresent(ren);
    }

    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
```

---

## 7. トラブルシューティング

| 問題 | 原因 | 対策 |
|------|------|------|
| `cmake` が見つからない | 未インストール | `brew install cmake` |
| `No C compiler found` | Xcode CLI Tools 未インストール | `xcode-select --install` |
| `libusb-1.0 not found` | Homebrew に未インストール | 無視して OK（macOS は IOKit で代替） |
| 再ビルドしたい | キャッシュが残っている | `rm -rf packages/sdl/build` してから再ビルド |
| Metal shader エラー | macOS バージョンが古い | macOS 11+ が必要 |

---

## 8. クイックリファレンス

```bash
# ビルド
./scripts/build-sdl.sh macos

# テスト実行
packages/sdl/build/test/testdraw
packages/sdl/build/test/testsprite
packages/sdl/build/test/testautomation

# クリーンビルド
rm -rf packages/sdl/build
./scripts/build-sdl.sh macos
```
