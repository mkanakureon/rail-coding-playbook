---
name: ks-editor
description: KSエディタ（Monacoベース）とブロックUIの同期、およびコンパイラを使用したスクリプトのリライトロジックを管理する。
---

# KS Editor Skill

Kaede Script (KS) を Single Source of Truth として、ブロックUIとテキストエディタを双方向に同期させる。

## コア・ロジック

### 1. 同期フロー (Text -> UI)
1.  **Parse**: `KsParser` を使用して KS テキストを AST (`KsAST`) に変換。
2.  **Convert**: `ksToBlocks(ast, assets, characters)` を使用してブロック配列 (`Block[]`) を生成。
3.  **Sync**: `useEditorStore.setBlocks(blocks)` で UI に反映。

### 2. 同期フロー (UI -> Text)
1.  **Generate**: `blocksToKs(blocks, assets, characters)` を使用してブロック配列から KS テキストを再生成。
2.  **Sync**: `KSEditor` の `value` を更新。

## リライトのルール

- **Slug 解決**: `@bg` や `@ch` の引数には、UUID ではなく必ず `Asset.slug` または `Character.slug` を使用する。
- **階層構造**: `@if` は必ず `@endif` で閉じ、ネストが深くなる場合はインデントを維持する。
- **テキスト形式**: 行頭が `@` でない場合は地の文として扱い、`ヒロ「セリフ」` の形式を推奨。

## 開発・デバッグ

### E2Eテストの実行
同期が正しく動作しているか確認するには、Playwright テストを実行する。

```bash
npm run test:e2e:dev -- tests/ks-editor-sync.spec.ts
```

### 構文チェック
`KsParser.parse(text)` を実行し、例外がスローされないか確認する。

## 関連ファイル

- **Parser/Printer**: `packages/compiler/src/parser/`
- **Converter**: `apps/editor/src/utils/ksConverter.ts`
- **Store**: `apps/editor/src/store/useEditorStore.ts`
- **UI**: `apps/editor/src/components/KSEditor/KSEditor.tsx`
