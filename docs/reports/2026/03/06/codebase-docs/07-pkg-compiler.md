# packages/compiler - .ks コンパイラ

## 概要

TyranoScript 風の .ks スクリプトを Op[] (ランタイム命令配列) にコンパイルする。Tokenizer → Parser → Transformer → Finalizer のパイプラインで処理する。コマンドレジストリにより、新コマンドの追加が容易。

## ディレクトリ構成

```
packages/compiler/
├── src/
│   ├── compiler/
│   │   └── Compiler.ts              # メインパイプライン
│   ├── tokenizer/
│   │   ├── Tokenizer.ts             # トークン化
│   │   └── lineClassifier.ts        # 行タイプ判別 (64行)
│   ├── parser/
│   │   ├── Parser.ts                # AST 生成
│   │   ├── KsParser.ts              # KS フォーマットパーサー
│   │   ├── KsPrinter.ts             # AST プリティプリンタ
│   │   ├── KsScanner.ts             # KS トークナイザ
│   │   ├── parseCommand.ts          # コマンド解析
│   │   ├── parseText.ts             # テキスト解析
│   │   └── parseOptionalArgs.ts     # オプション引数解析
│   ├── transformer/
│   │   └── Transformer.ts           # AST 変換 (変数展開、最適化)
│   ├── finalizer/
│   │   └── Finalizer.ts             # Op[] 生成
│   ├── validator/
│   │   └── Validator.ts             # プリコンパイルチェック
│   ├── registry/
│   │   └── commandRegistry.ts       # コマンドパーサーレジストリ (300+行)
│   ├── types/
│   │   ├── AST.ts                   # AST ノード型
│   │   ├── KsAST.ts                 # KS 固有 AST
│   │   ├── Token.ts                 # トークン型
│   │   ├── CompilerError.ts         # コンパイルエラー型
│   │   └── CompilerOptions.ts       # オプション型
│   ├── cli/
│   │   ├── cli.ts                   # CLI エントリ
│   │   └── commands/
│   │       ├── compile.ts           # compile コマンド
│   │       └── validate.ts          # validate コマンド
│   └── index.ts                     # 公開 API (23行)
├── test/
│   ├── tokenizer.test.ts
│   ├── lineClassifier.test.ts
│   ├── phase2.test.ts
│   ├── phase3.test.ts
│   ├── phase5.test.ts
│   ├── command-sync.test.ts
│   ├── validator.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## コンパイルパイプライン

```
.ks ソースコード
    ↓
[lineClassifier] → 行タイプ判別 (TEXT, COMMAND, VAR_SET, CHOICE_START, IF_START, ...)
    ↓
[Tokenizer] → Token[]
    ↓
[Parser + commandRegistry] → AST
    ↓
[Transformer] → 最適化済み AST
    ↓
[Validator] → バリデーション
    ↓
[Finalizer] → Op[]
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| commandRegistry.ts | 300+ | 全コマンドのパーサー関数を `COMMAND_PARSERS` マップに登録 |
| lineClassifier.ts | 64 | `KNOWN_COMMANDS` ホワイトリストで行タイプを判別 |
| Compiler.ts | — | パイプライン統合 |
| Parser.ts | — | AST ノード生成 |
| Finalizer.ts | — | Op[] 出力 |

## コマンドレジストリ

`commandRegistry.ts` がすべてのコマンドの定義源。

### 登録済みコマンド

| コマンド | Op 型 | 説明 |
|---------|-------|------|
| @bg | BG_SET | 背景設定 |
| @ch | CH_SET | キャラクター表示 |
| @ch_hide | CH_HIDE | キャラクター非表示 |
| @ch_clear | CH_CLEAR | 全キャラクター非表示 |
| @overlay | OVL_SET | オーバーレイ表示 |
| @overlay_hide | OVL_HIDE | オーバーレイ非表示 |
| @bgm | BGM_PLAY | BGM 再生 |
| @bgm_stop | BGM_STOP | BGM 停止 |
| @se | SE_PLAY | SE 再生 |
| @voice | VOICE_PLAY | ボイス再生 |
| @wait | WAIT | 待機 (click/timeout/voiceend) |
| @jump | JUMP | ジャンプ |
| @show | SHOW | 表示 |
| @hide | HIDE | 非表示 |
| @move | MOVE | 移動アニメーション |
| @fade | FADE | フェードアニメーション |
| @choice | CHOICE | 選択肢 |
| @set | VAR_SET | 変数設定 |
| @if | IF | 条件分岐 |
| @screen_filter | SCREEN_FILTER | スクリーンフィルター |
| @l / @c / @r | (インラインコマンド) | テキスト位置制御 |

### 新コマンド追加手順

1. `commandRegistry.ts` にパーサー関数を追加
2. `lineClassifier.ts` の `KNOWN_COMMANDS` にコマンド名を追加
3. `packages/core/src/types/Op.ts` に Op 型を追加
4. `packages/web` の OpHandler/OpRunner に実装を追加
5. `npm test -w @kaedevn/compiler` で同期テスト確認

## 依存関係

### 内部パッケージ
- `@kaedevn/core` (Op 型)

### 外部ライブラリ
- `commander` (CLI)
- `ulid` (ID 生成)

## テスト

| ファイル | 内容 |
|---------|------|
| tokenizer.test.ts | トークン化テスト |
| lineClassifier.test.ts | 行タイプ判別テスト |
| phase2.test.ts | パーサーテスト |
| phase3.test.ts | トランスフォーマーテスト |
| phase5.test.ts | ファイナライザーテスト |
| command-sync.test.ts | レジストリと lineClassifier の同期確認 |
| validator.test.ts | バリデーションテスト |
| integration.test.ts | E2E コンパイルテスト |

## 既知の注意点

- `lineClassifier.ts` に `KNOWN_COMMANDS` ホワイトリストがあり、新コマンドはここに追加しないと TEXT として分類される
- テキストとコマンドが同じ行にある場合（例: `テキスト@l`）は別々のコマンドに分割される
- インラインコマンド (@l, @c, @r) はテキスト内に埋め込まれる特殊形式
