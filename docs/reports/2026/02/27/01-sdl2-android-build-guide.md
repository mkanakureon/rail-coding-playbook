# SDL2 ネイティブエンジン Android ビルドガイド

**日付**: 2026-02-27
**前提**: macOS 上で SDL2 ネイティブエンジンが動作済み（[05-sdl2-native-engine-player.md](../26/05-sdl2-native-engine-player.md) 参照）

## 概要

macOS で動作していた SDL2 ノベルゲームプレイヤーを Android 向けにクロスビルドし、エミュレーター上で背景画像・立ち絵・日本語テキスト表示を確認した。既存コードへの変更は `#ifdef __ANDROID__` ガードの追加のみで、macOS ビルドへの影響はゼロ。

## 前提環境

| 項目 | バージョン / パス |
|------|-----------------|
| Android SDK | API 35 (`~/Library/Android/sdk/`) |
| NDK | 25.1.8937393（Gradle が自動選択） |
| Build Tools | 35.0.1 |
| AGP | 8.1.1 |
| Gradle | 8.1.1 |
| Java | OpenJDK 17 (`/opt/homebrew/opt/openjdk@17`) |
| エミュレーター | Medium_Phone_API_35 (arm64, API 35) |

## 手順

### Step 1: SDL2 ソースダウンロード

Android ビルドでは SDL2 をソースからビルドする必要がある（homebrew の .dylib は macOS 専用）。

```bash
# リポジトリルートから実行
bash scripts/download-sdl2-sources.sh
```

ダウンロードされるもの：

| ライブラリ | バージョン | サイズ |
|-----------|-----------|--------|
| SDL2 | 2.30.12 | ~34MB |
| SDL2_image | 2.8.4 | ~10MB |
| SDL2_ttf | 2.22.0 | ~5MB |
| SDL2_mixer | 2.8.1 | ~3MB |
| + vendored deps | (ogg, vorbis, opus, freetype, harfbuzz 等) | ~20MB |

配置先: `packages/native-engine/external/SDL2-2.30.12/` 等（.gitignore 済み）

### Step 2: Android プロジェクト構造

```
packages/native-engine/android/
├── build.gradle              # AGP 8.1.1
├── settings.gradle
├── gradle.properties         # android.useAndroidX=true
├── gradlew / gradlew.bat     # Gradle Wrapper (8.1.1)
├── local.properties          # sdk.dir=... (.gitignore 済み)
└── app/
    ├── build.gradle          # minSdk 21, targetSdk 35, arm64-v8a
    ├── jni/
    │   └── CMakeLists.txt    # JNI ビルド設定 (93行)
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/
        │   ├── org/libsdl/app/    # SDLActivity.java 等 (SDL2 から複製)
        │   └── com/kaedevn/native_engine/
        │       └── KaedevnActivity.java  # SDLActivity を継承
        ├── res/
        │   ├── values/strings.xml
        │   └── mipmap-*/ic_launcher.png
        └── assets/
            ├── assets/assets.json
            ├── assets/bg/bg01.png
            ├── assets/ch/ch01.png
            └── fonts/NotoSansJP-Regular.ttf  # Google Fonts (OFL)
```

### Step 3: JNI CMakeLists.txt のポイント

```cmake
# SDL2 + satellite libs をソースビルド
add_subdirectory("${EXTERNAL_DIR}/SDL2-2.30.12" SDL2)
add_subdirectory("${EXTERNAL_DIR}/SDL2_image-2.8.4" SDL2_image)
add_subdirectory("${EXTERNAL_DIR}/SDL2_ttf-2.22.0" SDL2_ttf)
add_subdirectory("${EXTERNAL_DIR}/SDL2_mixer-2.8.1" SDL2_mixer)

# エンジンソースを共有ライブラリとしてビルド
# ※ SDL2 Android は libmain.so という名前を要求する
add_library(main SHARED ${ENGINE_SRC_DIR}/main.cpp ${CORE_SOURCES})
```

**ヘッダ互換性問題の解決:**
macOS では `#include <SDL2/SDL.h>` 形式だが、SDL2 ソースビルドではヘッダが `SDL2/` サブディレクトリにない。CMake で互換 include ディレクトリを作成して解決：

```cmake
# SDL2/ プレフィックス付き include を解決するための互換レイヤー
set(SDL2_COMPAT_INCLUDE_DIR "${CMAKE_CURRENT_BINARY_DIR}/sdl2-compat-include/SDL2")
file(MAKE_DIRECTORY "${SDL2_COMPAT_INCLUDE_DIR}")
file(COPY ${SDL2_CORE_HEADERS} ${SDL2_IMAGE_HEADERS} ... DESTINATION ...)
target_include_directories(main PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/sdl2-compat-include")
```

### Step 4: 既存コードの Android 対応

`#ifdef __ANDROID__` ガードで分岐。既存ロジックの変更はゼロ。

| ファイル | Android 対応内容 |
|---------|-----------------|
| `main.cpp` | `SDL_WINDOW_FULLSCREEN_DESKTOP`、`SDL_FINGERDOWN` イベント、`SDLK_AC_BACK`、logcat 出力 (`android/log.h`) |
| `FontManager.cpp` | `TTF_OpenFontRW(SDL_RWFromFile(...))` で APK assets から読み込み |
| `AssetProvider.cpp` | `SDL_RWFromFile` + `SDL_RWread` で JSON 読み込み |
| `FileStorage.cpp` | `SDL_AndroidGetInternalStoragePath()` + `mkdir` (std::filesystem 不使用) |
| `Shader.cpp/.hpp` | 全メソッドをスタブ化（SDL2Engine は SDL_Renderer ベースで OpenGL 不使用） |

**AssetProvider の Android 対応例:**
```cpp
#ifdef __ANDROID__
SDL_RWops* rw = SDL_RWFromFile(jsonPath.c_str(), "rb");
Sint64 size = SDL_RWsize(rw);
jsonStr.resize(static_cast<size_t>(size));
SDL_RWread(rw, &jsonStr[0], 1, static_cast<size_t>(size));
SDL_RWclose(rw);
#else
std::ifstream file(jsonPath);
// ...
#endif
```

### Step 5: KaedevnActivity.java

```java
package com.kaedevn.native_engine;
import org.libsdl.app.SDLActivity;

public class KaedevnActivity extends SDLActivity {
    @Override
    protected String[] getLibraries() {
        return new String[]{
            "SDL2", "SDL2_image", "SDL2_ttf", "SDL2_mixer", "main"
        };
    }
}
```

SDLActivity が JNI 経由で `libmain.so` の `SDL_main` を呼び出す。

### Step 6: ビルド & インストール

```bash
cd packages/native-engine/android

# JAVA_HOME を設定（brew の OpenJDK 17）
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"

# ビルド（初回 ~40秒、2回目以降 ~5秒）
./gradlew assembleDebug

# インストール
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 起動
adb shell am start -n com.kaedevn.native_engine/.KaedevnActivity

# ログ確認
adb logcat -s "kaedevn:*" "SDL:*"
```

## 結果

| 項目 | 結果 |
|------|------|
| APK サイズ | 11.4 MB (debug) |
| ビルド時間 | 初回 39秒 |
| 背景画像 | 表示 |
| 立ち絵 | 表示 |
| 日本語テキスト | 表示 (Noto Sans JP) |
| テキストウィンドウ | 紺色半透明で表示 |
| タップ操作 | ダイアログ進行 |
| macOS テスト | 全24テスト合格（回帰なし） |

## 変更量

```
 .gitignore                          |  5 ++
 src/engine/AssetProvider.cpp        | 25 ++++++++-
 src/engine/FileStorage.cpp          | 13 +++++
 src/engine/FontManager.cpp          | 10 ++++
 src/engine/Shader.cpp               | 15 +++++
 src/engine/Shader.hpp               |  2 +
 src/main.cpp                        | 64 +++++++++++++++++-----
 8 files changed, 118 insertions(+), 16 deletions(-)
```

新規ファイル: Android プロジェクト一式 + ダウンロードスクリプト

## アーキテクチャ（再確認）

```
.ksc スクリプト
    │
    ▼
Interpreter (step 駆動, PC ベース)
    │
    ▼
IEngineAPI (純粋仮想クラス)
    │
    ├── SDL2Engine (macOS / Android / Switch)  ← 同一コード
    └── WebEngine  (PixiJS / ブラウザ)
```

SDL2Engine のコードは macOS / Android で完全に共通。プラットフォーム差異は main.cpp と各マネージャの `#ifdef` のみ。

## トラブルシューティング

### `No cmake project for ogg found in external/ogg`
SDL2_mixer の vendored 依存が未ダウンロード。`scripts/download-sdl2-sources.sh` を再実行する（satellite libs の `external/download.sh` も実行される）。

### `'SDL2/SDL_image.h' file not found`
SDL2 ソースビルドではヘッダが `SDL2/` サブディレクトリにない。JNI CMakeLists.txt の互換 include ディレクトリ設定が必要。

### `resource mipmap/ic_launcher not found`
`app/src/main/res/mipmap-*/ic_launcher.png` が不足。SDL2 テンプレートからコピーするか、自前アイコンを配置する。

### Java が見つからない
`export JAVA_HOME="/opt/homebrew/opt/openjdk@17"` を設定。macOS の `/usr/bin/java` は JDK 未インストール時にエラーになる。

## 次のステップ

- [ ] Release ビルド（ProGuard + signing）
- [ ] 実機テスト（arm64 端末）
- [ ] BGM/SE 再生テスト
- [ ] 複数解像度対応の検証
- [ ] CI での APK 自動ビルド
