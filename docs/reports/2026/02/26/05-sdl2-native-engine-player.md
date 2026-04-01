# SDL2 ネイティブエンジン：ノベルゲームプレイヤー実装

**日付**: 2026-02-26
**コミット**: d23c15a

## 概要

既存の native-engine ソースコード（インタプリタ・描画抽象層・各種マネージャ）を SDL2 でビルド可能にし、背景画像・立ち絵・テキスト表示が動作するノベルゲームプレイヤーを完成させた。

## 背景

`packages/native-engine/` には以下が実装済みだった：

- **IEngineAPI** — 描画・音声・入力の抽象インターフェース
- **SDL2Engine** — IEngineAPI の SDL2 実装（BG/キャラ/テキスト/選択肢/フェード/履歴/スキップ）
- **Interpreter** — step 駆動の KSC スクリプト実行エンジン
- **Parser / Evaluator / Tokenizer** — 構文解析・式評価・文字列補間
- **AudioManager / TextureManager / FontManager** — SDL2_mixer / SDL2_image / SDL2_ttf ラッパー
- **AssetProvider** — slug → ファイルパス解決
- **FileStorage** — JSON ベースのセーブ/ロード

しかし CMakeLists.txt と main.cpp が存在しない `SDL3Engine` を参照しており、ビルドが通らない状態だった。

## 実施内容

### 1. ビルド環境整備

| 作業 | 詳細 |
|------|------|
| SDL2 衛星ライブラリ導入 | `brew install sdl2_image sdl2_ttf sdl2_mixer` |
| CMakeLists.txt 修正 | SDL3 参照 → SDL2 + pkg-config (`IMPORTED_TARGET`) |
| UniqueSDL.hpp 修正 | `<SDL3/*>` → `<SDL2/*>`、`SDL_DestroySurface` → `SDL_FreeSurface` |

### 2. main.cpp 書き直し

- SDL2 API でウィンドウ・レンダラー生成
- `SDL_RenderSetLogicalSize(1280, 720)` で Retina 対応
- macOS 日本語フォント自動検出（ヒラギノ → Hiragino Sans GB → フォールバック）
- コマンドライン引数で .ksc スクリプトを指定可能
- デモスクリプト内蔵（bg/ch コマンド付き）
- キーボード操作: ESC=終了, H=履歴, S=スキップ

### 3. バグ修正

| ファイル | バグ | 修正 |
|---------|------|------|
| Tokenizer.cpp | String 正規表現が不正 `[^"\]` → 全式評価が例外 | `[^"\\]` に修正 |
| Parser.cpp | `LineType.DialogueStart` typo（ドットアクセス） | `LineType::DialogueStart` |
| Parser.cpp | `trim("")` で空イテレータ逆参照 | 早期リターン追加 |
| IEngineAPI.hpp | `playVoice()` 未定義 | 純粋仮想関数追加 |

### 4. テスト修正

- MockEngine に `playVoice` / `isSkipping` / `takeScreenshot` 追加
- ParserTest: 文字列リテラル内改行 → エスケープシーケンスに変換
- ParserTest: `if` 文の分類期待値を `Expression` → `IfStart` に修正

### 5. UI 改善

- テキストウィンドウ: 黒背景 → 紺色半透明（黒画面でも視認可能）
- 話者名: 金色テキスト + 背景ボックス
- 初期状態: "Click or press a key to start..." を表示

## 結果

- **ビルド成功**: `kaedevn_native` 実行ファイル生成
- **全24テスト合格**: GameState(6), Parser(8), Evaluator(4), Interpreter(2), AssetProvider(3), Screenshot(1)
- **動作確認**: 背景画像(bg01.png)・立ち絵(ch01.png)・日本語テキスト表示

## 既存コードの再利用率

9ファイル変更で +190 / -127 行。既存の約1,000行のエンジンコードのうち、ロジック変更はほぼゼロ。ビルド配線の修正だけで動作した。

**IEngineAPI による抽象化が正しく機能しており、同じ .ksc スクリプトが Web 版（PixiJS）とネイティブ版（SDL2）の両方で実行可能な構造が確認できた。**

## アーキテクチャ

```
.ksc スクリプト
    │
    ▼
Interpreter (step 駆動, PC ベース)
    │
    ▼
IEngineAPI (純粋仮想クラス)
    │
    ├── SDL2Engine (native / Switch)
    └── WebEngine  (PixiJS / ブラウザ)
```

## 実行方法

```bash
cd packages/native-engine/build

# デモ（bg + 立ち絵 + テキスト）
./kaedevn_native

# スクリプト指定
./kaedevn_native path/to/script.ksc
```

## アセット構成

```
build/assets/
├── assets.json          # slug → path マッピング
├── bg/bg01.png          # 背景 (1456x816)
└── ch/ch01.png          # 立ち絵 (1024x1024)
```

## 次のステップ

- 選択肢 UI の改善（現在はキーボード数字キーのみ → マウスクリック対応）
- フェードトランジションの動作確認
- BGM/SE 再生テスト（アセット追加）
- より本格的な .ksc シナリオでの統合テスト
- Switch 向け Joy-Con 入力マッピング（IInput 抽象化）
