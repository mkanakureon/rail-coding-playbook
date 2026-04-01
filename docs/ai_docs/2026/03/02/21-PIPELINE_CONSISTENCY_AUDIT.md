# リポジトリ全体における「5層パイプライン断裂」と「サイレント失敗」の調査報告

## 1. 調査の背景
OVL（オーバーレイ）プレビュー実装における工数増大と不具合（docs/09_reports/2026/03/01/05-ovl-preview-implementation-retrospective.md）を受け、同様の構造的問題がリポジトリ内の他の機能でも発生していないか、全層（Compiler, Interpreter, Core, Web, Editor）を横断的に調査した。

## 2. 判明したパイプラインの断裂状況

調査の結果、複数の機能において「エンジン側には実装されているが、スクリプトやエディタから呼び出せない」断裂状態が確認された。

| 機能 | Core (Op) | Web (Renderer) | Compiler (.ks) | Interpreter (.ksc) | Editor (UI/Store) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **ch_move** (移動) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **overlay** (OVL) | ✅ | ✅ | ✅ | ❌ | ⚠️(一部漏れ) |
| **画面エフェクト** (flash等) | ✅ | ✅ | ✅ | ❌ | ✅ |
| **wait_voice_end** | ✅ | ✅ | ❌ | ❌ | ❌ |

### 詳細な断裂箇所:
- **ch_move**: `Op.ts` と `WebOpHandler.ts` には実装があるが、`lineClassifier.ts` の `KNOWN_COMMANDS` に未登録。かつ `Interpreter.ts` にも未実装。エディタにもブロックが存在しない。
- **overlay**: 
  - `Interpreter.ts` の `executeBuiltin` および `isBuiltinFunction` に `overlay`, `overlay_hide` が存在しない（KSCファイルから使用不能）。
  - `useEditorStore.ts` の `buildPreviewScript` に `case 'overlay'` が欠落しており、全ページプレビューで反映されない。
- **画面エフェクト (flash, fade_black等)**: `Interpreter.ts` でサポートされておらず、KSC形式では実行できない。

## 3. サイレント失敗を誘発する設計上の罠

### A. KNOWN_COMMANDS ホワイトリスト (Compiler)
`packages/compiler/src/tokenizer/lineClassifier.ts` において、`KNOWN_COMMANDS` に登録されていない `@コマンド` は、エラーを出すことなく `TEXT`（地の文）として分類される。
- **影響**: 新しいコマンドを追加した際、ここへの登録を忘れると「スクリプトには書いてあるのに、実行時に何も起きない（かつエラーも出ない）」という、極めてデバッグ困難な状態に陥る。

### B. ID/アセットのガード漏れ (Script Builder)
エディタ側（`useEditorStore.ts`）および API側（`preview.ts`）において、アセットが未選択の状態に対する考慮が不足している箇所がある。
- **bg ブロック**: `assetId` が未指定の場合、`@bg undefined` という不正なコマンドを生成し、実行時に画像読み込みエラーを引き起こす。
- **battle ブロック**: 各種ページIDが未指定の場合、不完全な引数でコマンドを生成してしまう。

## 4. レンダリング層の不整合

### 背景遷移（bg_new）のレイヤー配置
`WebOpHandler.ts` の `show()` メソッドにおいて、背景遷移用の一時スプライト `bg_new` が `characterLayer`（キャラ層）に配置されている。
- **不具合**: 背景のフェードやスライド中に、新しい背景がキャラクターを覆い隠してしまう。
- **正解**: `bg_new` も `backgroundLayer` に配置し、旧背景の上に重ねるべき。

## 5. 提言と対策

1. **パイプライン・チェックリストの導入**: 新機能追加時、本報告書の表にある 5 層すべてを更新したか確認する自動テスト、あるいは厳格なドキュメント確認を必須とする。
2. **ホワイトリスト方式の廃止または警告**: `lineClassifier.ts` において、未知の `@コマンド` を検出した場合はコンパイルエラーまたは警告ログを出すように変更し、サイレント失敗を撲滅する。
3. **KNF Interpreter の同期**: `packages/interpreter` を `packages/core` の Op 定義と常に同期させ、エンジンが持つ機能をスクリプトから 100% 引き出せるようにする。
4. **エディタ・バリデーションの強化**: スクリプト書き出し前に `assetId` 等の必須項目をチェックし、`undefined` がスクリプトに混入するのを未然に防ぐ。
