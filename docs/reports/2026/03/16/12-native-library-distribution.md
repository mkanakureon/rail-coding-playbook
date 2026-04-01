# ネイティブエンジン ライブラリ化・配布方式設計

**日付:** 2026-03-16

## 背景

作者にエクスポート機能を提供する際、エンジンのソースコードを渡さずに済む仕組みが必要。
特に iOS は Xcode でのビルドが必須のため、ソースコード保護が重要。

## 方針

エンジンのコアロジックを **共有/静的ライブラリ** にし、バイナリのみ配布する。

```
現在:
  main.cpp + engine/*.cpp + interpreter/*.cpp
    → kaedevn_native（単一実行ファイル）

変更後:
  engine/*.cpp + interpreter/*.cpp
    → libkaedevn（ライブラリ、非公開）
  main.cpp
    → kaedevn_native（薄いランチャー）
```

## ライブラリ API（公開ヘッダー）

```cpp
// kaedevn.h — 作者に公開する唯一のヘッダー
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// エンジン初期化（SDL 初期化済みの renderer を渡す）
// pakPath: game.pak のパス（NULL ならルースファイルモード）
// Returns: 0 = success, non-zero = error
int kaedevn_init(void* sdl_renderer, const char* pakPath, int logicalW, int logicalH);

// フォント読み込み
int kaedevn_load_font(const char* fontPath, int mainSize, int boldSize);

// スクリプト読み込み・実行
int kaedevn_load_script(const char* scriptContent);
int kaedevn_step(void);          // 1ステップ進める
int kaedevn_is_finished(void);   // スクリプト終了判定

// 描画
void kaedevn_render(void);
void kaedevn_render_title(const char* title);
void kaedevn_render_end(void);

// 入力
void kaedevn_on_tap(void);
void kaedevn_toggle_history(void);
void kaedevn_toggle_skip(void);

// 状態リセット
void kaedevn_reset(void);

// 終了
void kaedevn_shutdown(void);

#ifdef __cplusplus
}
#endif
```

C リンケージにすることで、Swift（iOS）/ Kotlin（Android JNI）/ C++（デスクトップ）のいずれからも呼べる。

## プラットフォーム別ライブラリ形態

| Platform | 形態 | ファイル名 | 備考 |
|----------|------|-----------|------|
| macOS | 動的ライブラリ | `libkaedevn.dylib` | Frameworks/ に配置 |
| Windows | DLL | `kaedevn.dll` | exe と同じフォルダ |
| iOS | **静的ライブラリ** | `libkaedevn.a` | App Store は dylib 禁止 |
| Android | 共有ライブラリ | `libkaedevn.so` | JNI 経由で呼び出し |

## プラットフォーム別配布方式

### macOS / Windows（サーバー生成）

```
[サーバー]
  テンプレート（事前ビルド済み）:
    kaedevn_native + libkaedevn.dylib/.dll + SDL2 ライブラリ

  エクスポート時:
    1. テンプレートをコピー
    2. game.pak を生成して差し込み
    3. Info.plist / タイトルを書き換え
    4. zip にして返す

[作者]
  エディタの「エクスポート」ボタンを押す → zip ダウンロード
  ソースコード不要、ビルド環境不要
```

### iOS（Xcode テンプレート方式）

iOS は Apple の署名が必須のため、以下のいずれかの方式で対応する。

#### 方式 A: 作者が Xcode でビルド

```
作者に渡すもの:
  kaedevn-ios-template/
    kaedevn.xcodeproj        ← テンプレートプロジェクト
    main.m                   ← 薄いエントリポイント（公開OK）
    libkaedevn.a             ← 静的ライブラリ（バイナリのみ、ソース非公開）
    SDL2.framework           ← 公開ライブラリ
    Resources/
      game.pak               ← エディタからダウンロード
      LaunchScreen.storyboard
      Info.plist
    include/
      kaedevn.h              ← 公開ヘッダー（C API のみ）

作者の操作:
  1. エディタで「iOS エクスポート」→ game.pak ダウンロード
  2. game.pak を Resources/ に配置
  3. Xcode で Bundle ID と署名を設定
  4. ビルド → 実機テスト → App Store 提出
```

**ソースコード露出:** main.m のみ（SDL 初期化 + kaedevn API 呼び出しの数十行）。
エンジンロジックは `libkaedevn.a` に閉じており、逆コンパイルは困難。

#### 方式 B: CI ビルド代行

```
作者に渡すもの: なし（.ipa だけ）

フロー:
  1. 作者がエディタで「iOS エクスポート」を押す
  2. 作者の Apple Developer 証明書をアップロード（初回のみ）
  3. サーバーが game.pak を生成
  4. GitHub Actions（macOS runner）が:
     - テンプレートプロジェクトをチェックアウト
     - game.pak を差し込み
     - 作者の証明書で署名
     - xcodebuild archive → .ipa 生成
  5. .ipa を作者に返す or TestFlight にアップロード
```

**ソースコード露出:** 完全にゼロ。ただし CI 運用コストがかかる。

#### 推奨

- **Phase 1:** 方式 A（Xcode テンプレート）— 実装が簡単、作者は Xcode 必要
- **Phase 2:** 方式 B（CI 代行）— 課金プランの上位機能として提供

### Android（サーバー生成 or テンプレート）

Android は Google Play 署名があるが、APK/AAB 自体は Linux でビルド可能。

#### 方式 A: サーバー生成（推奨）

```
[サーバー]
  テンプレート APK（事前ビルド済み）:
    libkaedevn.so + libSDL2.so（JNI）
    AndroidManifest.xml
    Java/Kotlin ランチャー

  エクスポート時:
    1. テンプレート APK を展開
    2. assets/game.pak を差し込み
    3. AndroidManifest.xml を書き換え（パッケージ名・タイトル）
    4. 再パッケージ + jarsigner で署名
    5. APK を返す

[作者]
  エディタの「Android エクスポート」ボタン → APK ダウンロード
```

#### 方式 B: Android Studio テンプレート

iOS と同じくテンプレートプロジェクトを渡す方式。
`libkaedevn.so` はバイナリのみ配布。

```
作者に渡すもの:
  kaedevn-android-template/
    app/
      src/main/java/.../MainActivity.kt  ← 薄いランチャー
      src/main/jniLibs/arm64-v8a/
        libkaedevn.so                     ← バイナリのみ
        libSDL2.so
      src/main/assets/
        game.pak                          ← エディタからダウンロード
    include/
      kaedevn.h
```

#### 推奨

サーバー生成を基本とし、自前ビルドしたい作者向けにテンプレートも用意。

## CMakeLists.txt 変更イメージ

```cmake
# ライブラリ（SHARED or STATIC を選択）
set(ENGINE_SOURCES
    src/engine/PakReader.cpp
    src/engine/TextureManager.cpp
    src/engine/FontManager.cpp
    src/engine/AudioManager.cpp
    src/engine/HistoryManager.cpp
    src/engine/FileStorage.cpp
    src/engine/Shader.cpp
    src/engine/SDL2Engine.cpp
    src/engine/AssetProvider.cpp
    src/interpreter/GameState.cpp
    src/interpreter/Parser.cpp
    src/interpreter/Tokenizer.cpp
    src/interpreter/Evaluator.cpp
    src/interpreter/Interpreter.cpp
    src/api/kaedevn_api.cpp         # C API ラッパー
)

# iOS: 静的ライブラリ
if(CMAKE_SYSTEM_NAME STREQUAL "iOS")
    add_library(kaedevn STATIC ${ENGINE_SOURCES})
else()
    add_library(kaedevn SHARED ${ENGINE_SOURCES})
endif()

# 公開ヘッダー
target_include_directories(kaedevn PUBLIC include/)

# ランチャー（ライブラリをリンク）
add_executable(kaedevn_native src/main.cpp)
target_link_libraries(kaedevn_native PRIVATE kaedevn SDL2::SDL2 ...)
```

## 実装順序

| Phase | 内容 | 対象 |
|-------|------|------|
| 1 | macOS/Windows テンプレート方式（現在の延長） | サーバーエクスポート |
| 2 | libkaedevn 分離 + C API ヘッダー | 全プラットフォーム共通 |
| 3 | iOS Xcode テンプレート（方式 A） | 作者が Xcode でビルド |
| 4 | Android サーバー生成 | サーバーエクスポート |
| 5 | iOS CI 代行（方式 B） | 課金上位プラン |

## まとめ

- エンジンのソースコードは **一切作者に渡らない**
- 作者が触るのは `game.pak`（エディタが生成）と、iOS の場合は Xcode テンプレート
- C リンケージの公開 API により、将来 Switch SDK 連携も同じインターフェースで対応可能
