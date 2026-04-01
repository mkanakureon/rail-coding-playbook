# インターフェース遵守状況監査報告書

**作成日**: 2026-02-26
**対象**: Nintendo Switch 移植用抽象化レイヤーの遵守状況

## 1. 監査目的
kaedevn は Nintendo Switch への移植を最優先事項としています。そのため、入力、音声、保存といったプラットフォーム依存の機能が、`packages/core` で定義された抽象インターフェースを通じてのみアクセスされているかを監査しました。

## 2. 現状の遵守状況

### 2.1 入力システム (IInput)
- **ステータス**: ✅ 良好
- **実態**: `packages/web/src/input/InputManager.ts` が `IInput` を実装。
- **評価**: ゲームロジックが DOM イベント（`addEventListener`）を直接叩かず、`InputManager` 経由で `Action` を受け取る構造が維持されています。これにより、Switch の Joy-Con 実装への差し替えが容易です。

### 2.2 音声システム (IAudio)
- **ステータス**: ✅ 良好
- **実態**: `packages/web/src/audio/AudioManager.ts` が Web Audio API をラップして `IAudio` を提供。
- **評価**: BGM、SE、VOICE のカテゴリ別ボリューム管理が抽象化されており、Switch の `nn::audio` への移行準備が整っています。

### 2.3 ストレージシステム (IStorage)
- **ステータス**: ⚠️ 懸念あり
- **実態**: `IStorage.ts` は定義されていますが、`packages/web` 内での本格的な IndexedDB 実装との紐付けがまだ薄い状態です。
- **評価**: セーブ/ロード機能の開発時に、不用意に `localStorage` を直接叩くコードが混入しないよう注意が必要です。

## 3. 勧告事項
- **ガードコードの導入**: 今後、プラットフォーム非依存パッケージ（`packages/interpreter` 等）で `window` や `document` への直接参照がないかを lint 等で強制することを推奨します。
- **依存性注入 (DI)**: `OpRunner` の初期化時に、これらのインターフェースを外部から注入するパターンを徹底し、テスト用の Mock 実装と容易に切り替えられるようにしてください。

---
*Created by Gemini CLI Architecture Guarddog.*
