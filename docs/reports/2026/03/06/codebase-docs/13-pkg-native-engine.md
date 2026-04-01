# packages/native-engine, packages/sdl - ネイティブエンジン

## 概要

Nintendo Switch / Android 向けの C++ ビジュアルノベルエンジン。SDL2 + OpenGL でレンダリングし、KS スクリプトのインタプリタ、テクスチャ/オーディオ/フォント管理、セーブ/ロード機能を備える。Web エンジン (packages/web) と同等の機能をネイティブで実装する。

## ディレクトリ構成

```
packages/native-engine/
├── src/
│   ├── main.cpp                    # エントリポイント (203行)
│   ├── interpreter/                # スクリプトインタプリタ
│   │   ├── Tokenizer.hpp/cpp      # 字句解析 (91行)
│   │   ├── Parser.hpp/cpp         # AST 構築 (136行)
│   │   ├── Interpreter.hpp/cpp    # スクリプト実行 (85行)
│   │   ├── Evaluator.hpp/cpp      # 式評価 (85行)
│   │   └── GameState.hpp/cpp      # ゲーム状態 (73行)
│   └── engine/                     # エンジンモジュール
│       ├── SDL2Engine.hpp/cpp     # SDL2 レンダリングループ (157行)
│       ├── TextureManager.hpp/cpp # テクスチャ読込・キャッシュ (55行)
│       ├── AudioManager.hpp/cpp   # BGM/SE/Voice 再生 (61行)
│       ├── FontManager.hpp/cpp    # テキスト描画 (52行)
│       ├── FileStorage.hpp/cpp    # セーブ/ロード (40行)
│       ├── HistoryManager.hpp/cpp # 選択履歴 (60行)
│       ├── AssetProvider.hpp/cpp  # アセットレジストリ (41行)
│       ├── IEngineAPI.hpp         # エンジンインターフェース (32行)
│       ├── IStorage.hpp           # ストレージ抽象化 (15行)
│       ├── Shader.hpp/cpp         # GLSL シェーダー管理 (55行)
│       └── UniqueSDL.hpp          # SDL RAII ラッパー (31行)
├── tests/                          # C++ ユニットテスト (6ファイル, 281行)
│   ├── InterpreterTest.cpp
│   ├── ParserTest.cpp             # AST 構築検証
│   ├── EvaluatorTest.cpp          # 式評価テスト
│   ├── GameStateTest.cpp          # 状態管理テスト
│   ├── AssetProviderTest.cpp      # アセットレジストリテスト
│   └── ScreenshotTest.cpp        # スクリーンショットキャプチャ
├── external/
│   └── nlohmann/json.hpp          # JSON パーシング
├── android/                       # Android NDK サポート
│   ├── app/build.gradle
│   └── settings.gradle
├── build/                         # ビルド成果物
├── CMakeLists.txt                 # CMake ビルド設定 (2,404行)
├── run-auto-test.sh               # 自動テストランナー
├── test-cli.sh                    # CLI テストヘルパー
└── minimal_sdl3.cpp               # 最小 SDL3 デモ
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| main.cpp | 203 | エンジン初期化、イベントループ、入力ハンドリング |
| SDL2Engine.cpp | 157 | SDL2 ウィンドウ作成、レンダリングループ、フレームレート制御 |
| Interpreter.cpp | 85 | KS スクリプト実行 VM |
| Parser.cpp | 136 | スクリプト → AST 変換 |
| CMakeLists.txt | 2,404 | ビルド設定（SDL2, SDL_image, SDL_mixer, SDL_ttf リンク） |

## アーキテクチャ

```
[main.cpp] → イベントループ
    ↓
[SDL2Engine]
    ├── [TextureManager] → 背景/キャラクタースプライト描画
    ├── [FontManager] → テキスト描画
    ├── [AudioManager] → BGM/SE/Voice 再生
    ├── [Shader] → GLSL フィルター
    └── [Interpreter]
        ├── [Tokenizer] → [Parser] → AST
        ├── [Evaluator] → 式評価
        └── [GameState] → 変数, フラグ, 位置
            └── [FileStorage] → JSON セーブ/ロード
```

## インタプリタモジュール

| コンポーネント | 役割 |
|--------------|------|
| Tokenizer | KS スクリプトの字句解析 |
| Parser | トークン → AST ノード構築 |
| Interpreter | AST 実行、エンジン API 呼び出し |
| Evaluator | 式評価（変数参照、算術、比較） |
| GameState | 変数、既読フラグ、実行位置の管理 |

## エンジンモジュール

| コンポーネント | 役割 |
|--------------|------|
| SDL2Engine | ウィンドウ管理、レンダリングループ |
| TextureManager | 画像読込、キャッシュ (LRU) |
| AudioManager | SDL_mixer で BGM/SE/Voice 再生 |
| FontManager | SDL_ttf でテキストレンダリング |
| FileStorage | JSON 形式でセーブ/ロード |
| HistoryManager | 選択肢の履歴管理 |
| AssetProvider | アセット ID → ファイルパス解決 |
| Shader | GLSL シェーダーのコンパイル・適用 |
| UniqueSDL | SDL リソースの RAII ラッパー |

## Web エンジンとの対応

| 機能 | Web (packages/web) | Native (native-engine) |
|------|-------------------|----------------------|
| レンダリング | PixiJS (WebGL) | SDL2 + OpenGL |
| テクスチャ | PIXI.Texture | SDL_Texture / SDL_image |
| オーディオ | Web Audio API | SDL_mixer |
| フォント | PIXI.Text | SDL_ttf |
| セーブ | IndexedDB | ファイルシステム (JSON) |
| 入力 | ポインター/キーボード | SDL_Event |
| スクリプト | KscRunner + VM | Interpreter (C++) |

## ビルド

```bash
# SDL2 ソースダウンロード
./scripts/download-sdl2-sources.sh

# SDL2 ビルド
./scripts/build-sdl.sh

# ネイティブエンジンビルド
mkdir -p build && cd build
cmake .. && make

# テスト実行
./run-auto-test.sh
```

### CMake 依存

- SDL2, SDL2_image, SDL2_mixer, SDL2_ttf
- OpenGL / OpenGL ES
- nlohmann/json (ヘッダーオンリー)

## Android サポート

- `android/` ディレクトリに Gradle ビルド設定
- Android NDK 経由で SDL2 をビルド
- JNI で Java ↔ C++ ブリッジ

## packages/sdl

SDL2 ライブラリのソースコード / ビルド成果物を格納するサブモジュール。`scripts/build-sdl.sh` でビルドされる。

## テスト

| テスト | 行数 | 内容 |
|--------|------|------|
| InterpreterTest.cpp | — | スクリプト実行テスト |
| ParserTest.cpp | 50 | AST 構築検証 |
| EvaluatorTest.cpp | 34 | 式評価テスト |
| GameStateTest.cpp | 42 | 状態管理テスト |
| AssetProviderTest.cpp | 32 | アセットレジストリテスト |
| ScreenshotTest.cpp | 44 | スクリーンショットキャプチャ |

**合計: 6 テストファイル, 281 行**
