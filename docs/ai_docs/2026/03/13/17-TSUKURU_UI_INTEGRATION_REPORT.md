# ツクール型 UI レイアウト統合 実施報告書

**作成日**: 2026-03-13
**作成者**: Gemini CLI
**関連ブランチ**: `feature/map-system-integration`

## 1. 概要

`docs/01_in_specs/2026/03/0313/tsukuru-editor-spec.md` に基づき、プレイ画面の UI レイアウトを JSON で動的に制御する「ツクール型 UI レイアウトエンジン」の Phase 1 実装を完了した。これにより、メッセージウィンドウ、名前枠、ボタン等の配置をコードの変更なしに切り替え可能になった。

---

## 2. 実施内容

### 2.1 コアシステムの拡張 (packages/core)
- **PlayLayout 型定義**: `UiElementType`, `UiLayoutElement`, `PlayLayout` を追加。
- **標準プリセット**: 以下の 4 つの JSON プリセットを作成。
    - `novel-standard`: ADV 形式標準。
    - `rpg-classic`: RPG 拡張（所持金、ミニマップ枠等）。
    - `message-top`: 画面上部メッセージ。
    - `message-center`: NVL 形式（全画面中央）。
- **インフラ整備**: `tsconfig.json` を更新し、JSON モジュールのインポートをネイティブサポート。

### 2.2 レンダリングエンジンの刷新 (packages/web)
- **レイアウト適用ロジック**: `applyPlayLayout.ts` を実装。PixiJS コンテナに対して座標、可視性、透明度、カスタムオプションを一括適用。
- **UiLayoutContainer**: 全 UI 部品を管理する親コンテナを導入。`PlayLayout` を受け取って子要素を再配置する責務を持つ。
- **UI 部品のリファクタリングと新規作成**:
    - `TextWindow`: 名前欄とクリック待ちアイコンを内部から分離し、`resize` メソッドを実装。
    - `NameBox`: 名前表示専用のコンポーネントを新規作成。
    - `ClickWaitIcon`: 汎用的なクリック待ちインジケータを新規作成。
    - `ChoiceOverlay`: レイアウトに応じたリサイズに対応。
    - `QuickMenuBar / QuickButton`: 将来の機能拡張に向けたボタン群の基盤を作成。

### 2.3 システム統合
- **WebOpHandler**: `UiLayoutContainer` を統合し、デフォルトで `novelStandard` プリセットを適用するように変更。
- **メインエントリ (main.ts)**: UI 部品の個別追加を廃止し、レイアウトエンジンによる一元管理へ移行。

---

## 3. 検証結果

- **型チェック**: `packages/core` および `packages/web` での整合性を確認済み。
- **ビルド検証**: `core` パッケージのビルドおよび `web` パッケージの型チェックをパス。

---

## 4. 次のステップ

1. **プリセット切り替えの実装**: シナリオ命令（例：`@layout name="rpg-classic"`）による動的なレイアウト変更。
2. **UI 部品の実装完了**: `GoldWindow`, `MiniMap` 等の RPG 拡張部品の描画ロジック実装。
3. **エディタ統合**: `apps/editor` に UI レイアウト編集用のビジュアルエディタを追加。

---
 「動くロジック」に「自由な見た目」が加わりました。
 これでツクール経験者の方にも「自分の理想の画面が作れる」と感じていただけるはずです！

Co-Authored-By: Gemini CLI <gemini-cli@google.com>
