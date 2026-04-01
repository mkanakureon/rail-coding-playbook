# SDL3 Android ビルド & エミュレーター実行ガイド

**日付**: 2026-02-26

---

## 概要

SDL3 を Android 向けにビルドし、エミュレーターで動作確認するまでの全手順。
macOS (Apple Silicon) 環境で、SDL 付属の `android-project` テンプレートを使用して APK をビルドする。

---

## 1. 前提: SDL のリポジトリへの導入

SDL3 を git submodule として `packages/sdl/` に追加済み。

```bash
git submodule add https://github.com/libsdl-org/SDL.git packages/sdl
```

clone 後は `git submodule update --init packages/sdl` で取得できる。

---

## 2. Android 開発環境のセットアップ

### 2a. Java JDK 17

```bash
brew install openjdk@17
```

Gradle は JDK 17 を要求する。環境変数で指定:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
```

### 2b. Android SDK / NDK

```bash
brew install --cask android-commandlinetools
```

`sdkmanager` で必要なコンポーネントをインストール:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk

JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
  sdkmanager --sdk_root=$ANDROID_HOME \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;28.0.13004108" \
  "cmake;3.22.1"
```

### 2c. インストール確認

```
$ANDROID_HOME/
├── build-tools/35.0.0/
├── cmake/3.22.1/
├── emulator/
├── ndk/28.0.13004108/
├── platform-tools/     (adb)
├── platforms/android-35/
└── system-images/android-35-ext15/google_apis/arm64-v8a/
```

---

## 3. SDL macOS ネイティブビルド

```bash
./scripts/build-sdl.sh macos
```

内部で CMake を使用。出力:

| 項目 | パス |
|------|------|
| 共有ライブラリ | `packages/sdl/build/libSDL3.dylib` |
| テストバイナリ | `packages/sdl/build/test/testdraw` 等 |

テスト実行で動作確認:

```bash
packages/sdl/build/test/testdraw
packages/sdl/build/test/testsprite
```

---

## 4. SDL Android ネイティブビルド (CMake)

SDL ライブラリ単体の Android 向けクロスコンパイル:

```bash
./scripts/build-sdl.sh android
```

NDK のツールチェインを使用して `libSDL3.so` (arm64-v8a) を生成。
出力: `packages/sdl/build-android/libSDL3.so`

---

## 5. Android APK ビルド (Gradle)

SDL 付属の `android-project` テンプレートを使用する。

### 5a. ディレクトリ構成

```
packages/sdl/android-project/
├── app/
│   ├── jni/
│   │   ├── CMakeLists.txt          # SDL + src をビルド
│   │   ├── SDL -> ../../..         # SDL ソースへのシンボリックリンク
│   │   └── src/
│   │       ├── CMakeLists.txt      # ゲームソースの定義
│   │       └── YourSourceHere.c    # アプリ本体
│   └── build.gradle
├── build.gradle
├── settings.gradle
└── local.properties                # sdk.dir, ndk.dir を設定
```

### 5b. シンボリックリンクの作成

SDL ソースを JNI から参照できるようにする:

```bash
cd packages/sdl/android-project/app/jni
ln -sf ../../.. SDL
```

### 5c. アプリソースの編集

`app/jni/src/YourSourceHere.c` にアプリのコードを記述。
現在のデモ: 背景色が虹色に変化し、中央に白い四角形を描画する。

```c
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <math.h>       // fabsf, fmodf に必要

int main(int argc, char *argv[]) {
    SDL_Init(SDL_INIT_VIDEO);
    SDL_Window *window = SDL_CreateWindow("SDL Test", 640, 480, 0);
    SDL_Renderer *renderer = SDL_CreateRenderer(window, NULL);

    // メインループ: 色を HSV で回転、白い矩形を描画
    while (running) {
        SDL_PollEvent(&event);
        // ... HSV → RGB 変換 → SDL_RenderClear → SDL_RenderFillRect
        SDL_RenderPresent(renderer);
        SDL_Delay(16);  // ~60fps
    }
    // クリーンアップ
}
```

> **注意**: Android NDK では `<math.h>` を明示的に `#include` する必要がある（macOS では暗黙的にリンクされるが NDK では未定義エラーになる）。

### 5d. APK ビルド実行

```bash
cd packages/sdl/android-project

export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=$HOME/Library/Android/sdk

./gradlew assembleDebug
```

初回ビルドは Gradle のダウンロードや依存解決で約 30 分かかる。2 回目以降は差分ビルドで高速。

出力 APK:

```
app/build/outputs/apk/debug/app-debug.apk
```

---

## 6. Android エミュレーターのセットアップ

### 6a. システムイメージとエミュレーターのインストール

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
  sdkmanager --sdk_root=$ANDROID_HOME \
  "system-images;android-35-ext15;google_apis;arm64-v8a" \
  "emulator"
```

### 6b. AVD（仮想デバイス）の作成

`avdmanager` で作成するのが正規の方法だが、SDK の状態によっては手動作成が確実:

```bash
# AVD ディレクトリ
mkdir -p ~/.android/avd/sdl_test.avd

# AVD 登録ファイル
cat > ~/.android/avd/sdl_test.ini << 'EOF'
avd.ini.encoding=UTF-8
path=/Users/$USER/.android/avd/sdl_test.avd
path.rel=avd/sdl_test.avd
target=android-35
EOF

# デバイス設定
cat > ~/.android/avd/sdl_test.avd/config.ini << 'EOF'
AvdId = sdl_test
PlayStore.enabled = false
abi.type = arm64-v8a
avd.ini.displayname = SDL Test
avd.ini.encoding = UTF-8
disk.dataPartition.size = 6442450944
hw.accelerometer = yes
hw.audioInput = yes
hw.battery = yes
hw.cpu.arch = arm64
hw.cpu.ncore = 4
hw.dPad = no
hw.device.manufacturer = Google
hw.device.name = pixel_6
hw.gps = yes
hw.gpu.enabled = yes
hw.gpu.mode = auto
hw.keyboard = yes
hw.lcd.density = 411
hw.lcd.height = 2400
hw.lcd.width = 1080
hw.mainKeys = no
hw.ramSize = 2048
hw.sdCard = yes
hw.sensors.orientation = yes
hw.sensors.proximity = yes
hw.trackBall = no
image.sysdir.1 = system-images/android-35-ext15/google_apis/arm64-v8a/
tag.display = Google APIs
tag.id = google_apis
EOF
```

### 6c. エミュレーターの起動

```bash
$ANDROID_HOME/emulator/emulator -avd sdl_test -gpu host &
```

| GPU モード | 説明 | 推奨 |
|-----------|------|------|
| `-gpu host` | ホストの GPU を直接使用 | Apple Silicon macOS で安定 |
| `-gpu swiftshader_indirect` | ソフトウェアレンダリング | クラッシュする場合あり |
| `-gpu auto` | 自動選択 | 通常は host を選択 |

> **Apple Silicon 注意**: `-gpu swiftshader_indirect` は macOS + Apple Silicon で QEMU クラッシュを引き起こす場合がある。`-gpu host` を使用すること。

ブート完了の確認:

```bash
adb shell getprop sys.boot_completed
# "1" が返れば起動完了
```

---

## 7. APK のインストールと実行

```bash
# インストール
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 起動
adb shell am start -n org.libsdl.app/.SDLActivity
```

### 動作確認

```bash
# ログ確認（SDL のログ出力）
adb logcat | grep SDL

# フォアグラウンドの Activity 確認
adb shell "dumpsys activity activities | grep topResumedActivity"
# → org.libsdl.app/.SDLActivity
```

正常に動作すると:
- 背景色が虹色に連続的に変化
- 画面中央に白い 200x200 の四角形
- ~60fps でレンダリング

---

## 8. クイックリファレンス（全コマンド一覧）

```bash
# === 環境変数 ===
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

# === ビルド ===
./scripts/build-sdl.sh macos          # macOS ネイティブ
./scripts/build-sdl.sh android        # Android ライブラリ (libSDL3.so)
cd packages/sdl/android-project && ./gradlew assembleDebug  # APK

# === エミュレーター ===
emulator -avd sdl_test -gpu host &    # 起動
adb shell getprop sys.boot_completed  # ブート確認
adb install -r app/build/outputs/apk/debug/app-debug.apk   # インストール
adb shell am start -n org.libsdl.app/.SDLActivity           # 実行
adb logcat | grep SDL                 # ログ

# === エミュレーター停止 ===
adb emu kill
```

---

## 9. トラブルシューティング

| 問題 | 原因 | 対策 |
|------|------|------|
| `fabsf`/`fmodf` 未定義エラー | `<math.h>` 未 include | `#include <math.h>` を追加 |
| エミュレーター QEMU クラッシュ | `swiftshader_indirect` の不具合 | `-gpu host` で起動 |
| Gradle で JDK が見つからない | `JAVA_HOME` 未設定 | `export JAVA_HOME=/opt/homebrew/opt/openjdk@17` |
| `sdkmanager` で Java 未検出 | パスに JDK がない | コマンド前に `JAVA_HOME=... ` を付ける |
| AVD 一覧に表示されない | sdkmanager の状態不整合 | 手動で `~/.android/avd/` に config を作成 |
| 初回 Gradle ビルドが遅い | 依存ダウンロード | 2回目以降は差分ビルドで高速化 |

---

## 10. 今回インストールしたもの一覧

| ツール | バージョン | インストール方法 |
|--------|-----------|-----------------|
| OpenJDK | 17 | `brew install openjdk@17` |
| Android SDK Platform | 35 | sdkmanager |
| Android Build Tools | 35.0.0 | sdkmanager |
| Android NDK | 28.0.13004108 | sdkmanager |
| Android CMake | 3.22.1 | sdkmanager |
| Android Platform Tools | latest | sdkmanager |
| Android Emulator | 36.4.9 | sdkmanager |
| System Image | android-35-ext15 google_apis arm64-v8a | sdkmanager |
| SDL3 | 3.5.0 (main) | git submodule |
