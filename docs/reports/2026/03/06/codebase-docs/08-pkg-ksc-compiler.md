# packages/ksc-compiler - KSC コンパイラ + VM

## 概要

KSC (TypeScript 風スクリプト言語) のフルコンパイラと仮想マシン。Lexer → Parser → Checker (型チェック) → Emitter (IR 生成) → VM (実行) のパイプラインで処理する。プリミティブ型、オブジェクト、配列、関数、条件式をサポートする型システムを持つ。

## ディレクトリ構成

```
packages/ksc-compiler/
├── src/
│   ├── lexer.ts                # トークン化 (300+行)
│   ├── parser.ts               # AST 生成 (500+行)
│   ├── checker.ts              # 型チェック・スコープ解析 (400+行)
│   ├── emitter.ts              # IR コード生成
│   ├── vm.ts                   # 仮想マシン実行 (1000+行)
│   ├── types/
│   │   ├── token.ts            # トークン型
│   │   ├── ast.ts              # AST ノード型
│   │   ├── ksc-type.ts         # 型システム
│   │   ├── ir.ts               # 中間表現
│   │   ├── value.ts            # ランタイム値
│   │   ├── restrictions.ts     # 制約
│   │   └── index.ts            # 型エクスポート
│   ├── checker/
│   │   ├── builtins.ts         # 組み込み関数
│   │   ├── scope.ts            # シンボルテーブル
│   │   └── errors.ts           # 型エラー
│   └── index.ts                # 公開 API (11行)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## コンパイルパイプライン

```
.ksc ソースコード
    ↓
[Lexer] → Token[]
    ↓
[Parser] → AST (抽象構文木)
    ↓
[Checker] → 型チェック + スコープ解析
    ↓
[Emitter] → IR (中間表現)
    ↓
[VM] → 実行 (HostAPI 経由でエンジン操作)
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| vm.ts | 1000+ | 仮想マシン。IR 実行、async/await サポート、HostAPI コールバック |
| parser.ts | 500+ | 再帰下降パーサー。式、文、関数定義、制御フロー |
| checker.ts | 400+ | 型チェッカー。スコープ解析、型推論、エラーレポート |
| lexer.ts | 300+ | 字句解析。キーワード、演算子、文字列リテラル、コメント |
| emitter.ts | — | AST → IR 変換 |

## 型システム

KSC は以下の型をサポート:

- **プリミティブ**: `number`, `string`, `boolean`, `null`
- **オブジェクト**: `{ key: type }` 形式
- **配列**: `type[]` 形式
- **関数**: `(params) => return_type`
- **条件式**: `if/else` 式
- **ユニオン型**: `type1 | type2`

## VM (仮想マシン)

- **IR 実行**: スタックベースの命令実行
- **HostAPI**: エンジン操作のコールバックインターフェース
  - `showText(speaker, body)` — テキスト表示
  - `showChoice(options)` — 選択肢表示
  - `setBg(assetId)` — 背景設定
  - `showCh(characterId, expressionId, position)` — キャラクター表示
  - `playBgm(assetId)` / `playSe(assetId)` — 音声再生
  - `wait(mode, ms)` — 待機
  - etc.
- **async/await**: 非同期操作（ユーザー入力待ち、アニメーション完了待ち）をサポート
- **変数**: グローバル/ローカルスコープの変数管理

## 組み込み関数

- `print(value)` — デバッグ出力
- `random(min, max)` — 乱数生成
- `toString(value)` — 文字列変換
- `len(array)` — 配列長
- etc.

## 依存関係

- **内部**: なし
- **外部**: なし
- **被依存**: packages/web (KscRunner, KscHostAdapter)

## .ks との違い

| 項目 | .ks (compiler) | .ksc (ksc-compiler) |
|------|---------------|---------------------|
| 構文 | TyranoScript 風 (`@command`) | TypeScript 風 |
| 型システム | なし | あり (型チェック) |
| 制御フロー | @if/@choice | if/else, for, while |
| 関数 | なし | ユーザー定義関数 |
| 出力 | Op[] (直接) | IR → VM 実行 |
| 用途 | シンプルなスクリプト | 高度なロジック |
