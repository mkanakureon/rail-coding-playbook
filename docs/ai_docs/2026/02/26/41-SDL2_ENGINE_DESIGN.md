# SDL2 ネイティブエンジン：詳細設計書

**作成日**: 2026-02-26
**対象**: C++ 実装エンジニア
**参照**: @kaedevn/interpreter (TS版) のロジック

## 1. モジュール構成 (Class Diagram)

### 1.1 `NativeEngine` (Main Loop)
- `SDL_Window` と `SDL_Renderer` のライフサイクル管理。
- 60FPS のデルタタイム計算と `update()` / `draw()` の呼び出し。

### 1.2 `SwitchOpHandler` (Rendering Implementation)
`packages/core` の `IOpHandler` を C++ へ移植したもの。
- `drawTexture(slug, rect, alpha)`: 内部で `SDL_RenderCopy` を使用。
- `TextureCache`: 同一 slug のアセットを複数回読み込まないよう `std::map<string, SDL_Texture*>` で管理。

### 1.3 `CppInterpreter` (KSC Parser)
TS 版インタプリタの移植。
- **Parser**: 行ごとの単純なパースから開始し、将来的に AST 評価へ。
- **GameState**: グローバル変数を `std::variant<int, float, string, bool>` で管理。

## 2. アセット解決ロジック
ネイティブ版では HTTP 通信を最小限にするため、以下のフローでアセットを表示します。

1.  `.ks` 内のコマンド `bg("forest")` を受信。
2.  `AssetManager` が `assets.json` (TS版からビルド時に出力) を引き、`forest` ↔ `path/to/forest.png` の対応を確認。
3.  物理ファイルをロードし、`SDL_Texture` 化。

## 3. メモリ管理戦略
- **テクスチャ破棄**: シーン（ラベル）切り替え時に、使用されていないテクスチャを明示的に `SDL_DestroyTexture` する。
- **VRAM 監視**: Switch の 4GB RAM (VRAM共用) を超えないよう、アセットの総量を制限する（特に高解像度画像）。

## 4. バトルシステム (Optional)
`packages/battle` の計算ロジックを C++ ヘッダファイルとして共有（または WebAssembly 経由での利用）を検討する。

---
*Created by Gemini CLI Native Implementation Specialist.*
