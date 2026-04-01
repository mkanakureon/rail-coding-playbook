# 重複実装の解消と軽微なリファクタリング提案書

## 1. 概要
「5層パイプライン」の調査において、複数のパッケージ間でロジックの重複が確認されました。これらはメンテナンスコストを増大させ、バグの温床となっています。本文書では、これらの重複を解消し、コードの再利用性と信頼性を高めるためのリファクタリングを提案します。

## 2. 最優先リファクタリング対象：スクリプト生成ロジック

### 現状の課題
エディタの「ブロック」を「KS/KSCスクリプト」に変換するロジックが、以下の4箇所に重複して存在します。
1. `apps/editor/src/store/useEditorStore.ts` 内の `buildPreviewScript`
2. 同ファイル内の `buildPageScript`
3. 同ファイル内の `buildSnapshotScript`
4. `apps/hono/src/routes/preview.ts` 内の `generateKSCScript`

**リスク**: 新しいブロック（例：OVL）を追加する際、これらすべての `switch-case` 文を個別に更新する必要があり、今回の調査でも `buildPreviewScript` への反映漏れが確認されました。

### 提案：`packages/script-builder` の新設
共通のスクリプト生成ロジックを共有パッケージへ切り出します。
- **タスク**: ブロック型から文字列コマンドへの変換を行う `CommandGenerator` クラスを作成。
- **メリット**: 一箇所の修正ですべてのプレビュー・書き出し機能が更新されるようになります。

---

## 3. コマンド・定義の「真実の単一ソース (Single Source of Truth)」化

### 現状の課題
「どのコマンドが有効か」という定義が、以下の場所に散在しています。
- `packages/compiler/src/tokenizer/lineClassifier.ts` (`KNOWN_COMMANDS`)
- `packages/compiler/src/registry/commandRegistry.ts`
- `packages/interpreter/src/core/Interpreter.ts` (`isBuiltinFunction`)
- `packages/core/src/types/Op.ts` (`Op` 型)

### 提案：レジストリ・ドリブンな設計
`packages/core` に全コマンドのメタ情報（名前、引数構成、実行レイヤー）を集約したレジストリを定義します。
- **タスク**: コンパイラとインタープリタが、このレジストリを参照して動作するように変更。
- **メリット**: 新機能追加時にレジストリを一行更新するだけで、トークナイズ、型定義、入力補完が自動的に同期されます。

---

## 4. レンダリング層（WebOpHandler）の整理

### 現状の課題
`WebOpHandler.ts` の `show()` メソッドが肥大化しており、背景・キャラ・オーバーレイの判定が複雑な `if` 文で行われています。
- **不具合例**: `bg_new` のレイヤー配置ミスは、この複雑な条件分岐から発生しました。

### 提案：コンテナ・プロバイダーパターンの導入
レイヤーへの追加ロジックをクラス化し、役割を分離します。
- **タスク**: `BackgroundManager`, `CharacterManager`, `OverlayManager` に処理を分散。
- **メリット**: 各マネージャーが自身のレイヤー順序（Z-index）とスケーリング規則を管理するため、配置ミスが物理的に発生しなくなります。

---

## 5. 小規模な改善項目

| 項目 | 現状 | 提案 |
| :--- | :--- | :--- |
| **定数の共通化** | 解像度(1280x720)等が各所にハードコード | `packages/core/constants` に集約 |
| **バリデーション** | アセットIDの空チェックが個別実装 | `packages/core/schemas` でZod等を用いて統一 |
| **位置の正規化** | "L/C/R" → "left/center/right" の変換が各所にある | ユーティリティ関数 `normalizePosition()` を作成 |

## 結論
これらのリファクタリングにより、現在の「5層を貫通させる苦労」は「1箇所の定義と各層の呼び出し」へと劇的に簡略化されます。特に OSS 化を控えた現在、外部の貢献者が「どこを直せばいいか一目でわかる」状態にすることは、プロジェクトの成功に不可欠です。
