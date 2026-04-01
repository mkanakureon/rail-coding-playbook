# スクリーンショットを使ったビジュアルテスト手順書

**日付**: 2026-02-27
**対象**: kaedevn ネイティブエンジン (macOS / Android)

## 概要

ネイティブエンジンの描画結果をスクリーンショットで取得し、目視またはスクリプトで検証する方法をまとめる。macOS（ローカル）と Android（エミュレーター）の両プラットフォームに対応。

---

## 実例スクリーンショット（2026-02-27 取得）

以下は実際にキャプチャしたスクリーンショット。同ディレクトリの `screenshots/` フォルダに保存済み。

| ファイル | 内容 | 取得方法 |
|---------|------|---------|
| [`screenshots/android_01_initial.png`](screenshots/android_01_initial.png) | Android: 背景画像 + テキストウィンドウ（初期状態） | `adb exec-out screencap -p` |
| [`screenshots/android_02_character.png`](screenshots/android_02_character.png) | Android: 背景 + 立ち絵 + 日本語テキスト表示 | `adb exec-out screencap -p`（タップ進行後） |
| [`screenshots/macos_headless_test.png`](screenshots/macos_headless_test.png) | macOS: ヘッドレステストのテストパターン（オレンジ + 青四角） | `ctest` (`ScreenshotTest.cpp`) |

### android_01_initial.png の見方

- **上部**: Android OS の「Viewing full screen」通知（初回のみ表示、テストには無関係）
- **中央**: 背景画像（bg01.png — 神社の赤い柱）が `SDL_RenderSetLogicalSize(1280, 720)` で描画
- **下部**: 紺色半透明のテキストウィンドウ（テキスト未表示 = 初期状態）

### android_02_character.png の見方

- **背景**: bg01.png が全画面表示
- **中央**: 立ち絵 ch01.png が `x=640` で中央配置、背景の上にレンダリング
- **テキストウィンドウ**: 話者名 + 日本語テキストが表示されている

### macos_headless_test.png の見方

- 640x480 の SDL_Surface をメモリ上に作成
- 全面オレンジ (RGB 255, 100, 0) で塗りつぶし
- 中央に 100x100 の青四角 (RGB 0, 100, 255) を描画
- `IMG_SavePNG` で保存 → ウィンドウ不要で CI でも実行可能

---

## 1. macOS での確認

### 1-1. エンジン内蔵スクリーンショット (`takeScreenshot`)

SDL2Engine には `takeScreenshot(path)` メソッドがあり、KSC スクリプトまたは C++ から呼び出せる。

**C++ から直接呼ぶ場合：**

```cpp
// main.cpp のメインループ内で任意のタイミングに
engine.takeScreenshot("screenshot_bg.png");
```

**KSC スクリプトから呼ぶ場合：**

```
bg('bg01')
debug_screenshot('test_after_bg.png')

ch('ch01', 'normal', 'none', 640)
debug_screenshot('test_after_ch.png')
```

※ `debug_screenshot` コマンドは Interpreter に `takeScreenshot` をバインドする実装が必要（未実装の場合は C++ 側で直接呼ぶ）。

**出力先:** ビルドディレクトリ (`packages/native-engine/build/`)

### 1-2. ヘッドレススクリーンショット（テスト用）

`ScreenshotTest.cpp` で SDL_Surface を直接作成し、`IMG_SavePNG` で保存する方法：

```cpp
// SDL ウィンドウ不要、メモリ上の Surface に描画
SDL_Surface* surface = SDL_CreateRGBSurfaceWithFormat(
    0, 1280, 720, 32, SDL_PIXELFORMAT_ARGB8888);
SDL_FillRect(surface, nullptr, SDL_MapRGB(surface->format, 0, 0, 0));
// ... 描画 ...
IMG_SavePNG(surface, "test_output.png");
SDL_FreeSurface(surface);
```

**実行：**
```bash
cd packages/native-engine/build
ctest --output-on-failure   # ScreenshotTest も実行される
ls test_screenshot_headless.png
```

### 1-3. macOS スクリーンキャプチャ

OS レベルのスクリーンキャプチャを使う方法：

```bash
# エンジン起動
cd packages/native-engine/build
./kaedevn_native &

# 2秒待ってスクリーンキャプチャ
sleep 2
screencapture -l $(osascript -e 'tell app "System Events" to get id of window 1 of process "kaedevn_native"') screenshot.png
```

---

## 2. Android エミュレーターでの確認

### 2-1. adb screencap（推奨）

エミュレーターの画面全体をキャプチャする。

```bash
# 前提: エミュレーター起動済み、APK インストール済み
adb shell am start -n com.kaedevn.native_engine/.KaedevnActivity

# 3秒待って（アプリ起動 + レンダリング完了を待つ）
sleep 3

# スクリーンショット取得
adb exec-out screencap -p > screenshot_android.png
```

**タップ操作でシーン進行させてからキャプチャ：**

```bash
# 画面中央をタップ（1080x2400 端末の場合）
adb shell input tap 540 1200

# 1秒待ってキャプチャ
sleep 1
adb exec-out screencap -p > screenshot_after_tap.png
```

### 2-2. 連続キャプチャスクリプト

複数のシーンを自動で進行させてキャプチャするスクリプト例：

```bash
#!/bin/bash
# scripts/android-visual-test.sh
set -euo pipefail

ADB="/Users/kentaromukunasi/Library/Android/sdk/platform-tools/adb"
PKG="com.kaedevn.native_engine"
OUT_DIR="test-screenshots/android"

mkdir -p "$OUT_DIR"

# アプリ起動
$ADB shell am force-stop "$PKG"
$ADB shell am start -n "$PKG/.KaedevnActivity"
sleep 4  # 起動 + フォント読み込み + 初回レンダリング

# Scene 1: 初期状態（背景 + テキストウィンドウ）
$ADB exec-out screencap -p > "$OUT_DIR/01_initial.png"
echo "Captured: 01_initial.png"

# Scene 2: タップ → 次のダイアログ
$ADB shell input tap 540 1200
sleep 1
$ADB exec-out screencap -p > "$OUT_DIR/02_dialogue1.png"
echo "Captured: 02_dialogue1.png"

# Scene 3: タップ → 立ち絵表示
$ADB shell input tap 540 1200
sleep 1
$ADB exec-out screencap -p > "$OUT_DIR/03_character.png"
echo "Captured: 03_character.png"

# Scene 4: タップ → 次のダイアログ
$ADB shell input tap 540 1200
sleep 1
$ADB exec-out screencap -p > "$OUT_DIR/04_dialogue2.png"
echo "Captured: 04_dialogue2.png"

# Scene 5: タップ → 立ち絵消去
$ADB shell input tap 540 1200
sleep 1
$ADB exec-out screencap -p > "$OUT_DIR/05_ch_hidden.png"
echo "Captured: 05_ch_hidden.png"

echo "=== All screenshots saved to $OUT_DIR ==="
ls -la "$OUT_DIR"
```

### 2-3. logcat と合わせた確認

スクリーンショットとログを併用してデバッグする：

```bash
# ログをリアルタイム表示しながら操作
adb logcat -s "kaedevn:*" "SDL:*" &
LOG_PID=$!

# アプリ起動
adb shell am start -n com.kaedevn.native_engine/.KaedevnActivity
sleep 4

# タップしてスクリーンショット
adb shell input tap 540 1200
sleep 1
adb exec-out screencap -p > test.png

# ログ停止
kill $LOG_PID

# ログの確認ポイント
# "Font loaded: fonts/NotoSansJP-Regular.ttf"  → フォント読み込み成功
# "Starting engine..."                          → メインループ開始
# "[dialogue] ナレーション: ..."               → ダイアログ進行
```

---

## 3. 確認チェックリスト

各スクリーンショットで以下を目視確認する。

### 背景表示

| # | 確認項目 | 合格基準 |
|---|---------|---------|
| 1 | 背景画像が画面全体に表示されている | 1280x720 論理解像度で引き伸ばし、黒枠なし |
| 2 | 背景の色味が正しい | bg01.png（神社の赤い柱）と一致 |
| 3 | 上下左右が欠けていない | 端まで画像が到達している |

### 立ち絵表示

| # | 確認項目 | 合格基準 |
|---|---------|---------|
| 4 | 立ち絵が中央に表示されている | x=640 指定で画面中央 |
| 5 | 立ち絵が背景の上に重なっている | Z-order が正しい |
| 6 | 透過が効いている | キャラクター周囲の背景が見える |

### テキスト表示

| # | 確認項目 | 合格基準 |
|---|---------|---------|
| 7 | テキストウィンドウが下部に表示 | y=480, 紺色半透明 |
| 8 | 日本語テキストが読める | 文字化けなし、適切なサイズ |
| 9 | 話者名が金色で表示 | 話者ボックス + 金色テキスト |

### プラットフォーム固有

| # | 確認項目 | macOS | Android |
|---|---------|-------|---------|
| 10 | 解像度 | 1280x720 (Retina は内部2倍) | フルスクリーン + 論理1280x720 |
| 11 | フォント | ヒラギノ角ゴシック | Noto Sans JP |
| 12 | 操作 | クリック / キーボード | タップ |

---

## 4. ゴールドマスター比較（将来）

スクリーンショットの自動比較を行う仕組み（未実装だが設計済み）。

### 構成

```
tests/gold_masters/
├── macOS/
│   ├── 01_initial.png       # 期待結果
│   ├── 02_dialogue1.png
│   └── ...
└── android/
    ├── 01_initial.png
    └── ...
```

### ImageMagick による比較

```bash
# 2枚の画像のピクセル差分を計算
compare -metric RMSE screenshot.png gold_master.png diff.png 2>&1

# 閾値判定（RMSE < 0.05 で合格）
DIFF=$(compare -metric RMSE screenshot.png gold_master.png null: 2>&1 | awk -F'[()]' '{print $2}')
if (( $(echo "$DIFF < 0.05" | bc -l) )); then
    echo "PASS: Diff=$DIFF"
else
    echo "FAIL: Diff=$DIFF (threshold: 0.05)"
fi
```

### perceptualdiff による比較（より人間の目に近い）

```bash
brew install perceptualdiff
perceptualdiff screenshot.png gold_master.png -threshold 100 -output diff.png
```

---

## 5. CI 統合の想定

```yaml
# .github/workflows/visual-test.yml (将来)
- name: Android Visual Test
  run: |
    # エミュレーター起動
    $ANDROID_HOME/emulator/emulator -avd test -no-window -gpu swiftshader_indirect &
    adb wait-for-device

    # ビルド & インストール
    cd packages/native-engine/android
    ./gradlew assembleDebug
    adb install app/build/outputs/apk/debug/app-debug.apk

    # テスト実行
    bash scripts/android-visual-test.sh

    # ゴールドマスター比較
    for img in test-screenshots/android/*.png; do
      compare -metric RMSE "$img" "tests/gold_masters/android/$(basename $img)" null:
    done
```

---

## クイックリファレンス

```bash
# === macOS ===
cd packages/native-engine/build
./kaedevn_native                    # エンジン起動（デモスクリプト）
./kaedevn_native path/to/script.ksc  # スクリプト指定

# === Android ===
cd packages/native-engine/android
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.kaedevn.native_engine/.KaedevnActivity
sleep 3 && adb exec-out screencap -p > screenshot.png

# === ログ ===
adb logcat -s "kaedevn:*"          # Android ログ
```
