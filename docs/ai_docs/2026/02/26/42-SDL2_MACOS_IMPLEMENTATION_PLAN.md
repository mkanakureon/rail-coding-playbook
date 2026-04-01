# SDL2 ネイティブエンジン：Mac 開発・実装計画書

**作成日**: 2026-02-26
**対象**: エンジニア、プロジェクトマネージャー
**環境**: macOS (Apple Silicon / Intel), Clang, CMake, Homebrew

## 1. 開発環境のセットアップ (macOS)

### 1.1 依存ライブラリのインストール
Homebrew を使用して、SDL2 本体とその拡張ライブラリ、ビルドツールを導入します。
```bash
brew install sdl2 sdl2_image sdl2_mixer sdl2_ttf cmake
```

### 1.2 CMake における GTest 統合 (モダンな手法)
システムに GTest がインストールされていない場合を考慮し、`FetchContent` モジュールを使用してビルド時に自動取得・コンパイルする構成を採用します。これにより、環境構築の手間を最小限に抑えます。

## 2. 詳細な実装・テストロードマップ

### 2.1 【Step 1】レンダリングと HighDPI 対応 (Week 1)
- **課題**: Mac の Retina ディスプレイでは、ウィンドウサイズ（1280x720）と実際の描画バッファ（2560x1440等）が異なります。
- **実装**: `SDL_RenderSetLogicalSize(renderer, 1280, 720)` を呼び出し、座標系を論理サイズに固定します。
- **テスト**: `RendererMock` を作成し、画像描画命令が正しい「論理座標」で発行されているかを検証します。

### 2.2 【Step 2】TS版互換インタプリタの構築 (Week 2-3)
- **KSC パース**: `std::string` の行単位走査と、正規表現を用いたコマンド抽出。
- **データ駆動型テスト**: TS 版が出力した `scenario.json` を C++ で読み込み、実行後の変数状態 (`VariableMap`) が TS 版と完全に一致するかを `EXPECT_EQ` で自動検証する「挙動一致テスト」を 100 ケース以上作成します。

### 2.3 【Step 3】メモリ・リソース管理 (Week 4)
- **RAII の徹底**: `SDL_Texture` や `Mix_Music` をスマートポインタ（`std::unique_ptr`）でラップし、メモリリークを構造的に防ぎます。
- **リークテスト**: GTest 内で大量のアセットロード・アンロードを繰り返し、`AddressSanitizer` で異常を検知します。

## 3. マイルストーン：Mac 版「プレビューバイナリ」の完成
- **CLI 実行**: `./kaedevn_native --script demo_01.ksc` で指定したスクリプトを再生開始。
- **GUI 操作**: Aボタン（Enter）で進行、Bボタン（Esc）でタイトルへ戻る、セーブ・ロードの UI 動作。

---
*Updated: 2026-02-26 by Gemini CLI to include TDD and HighDPI details.*
