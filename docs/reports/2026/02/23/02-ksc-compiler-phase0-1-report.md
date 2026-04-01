# KSC Compiler Phase 0〜1 実装レポート

## 背景

KSC（かえでノベルゲームエンジン用 TypeScript 風スクリプト言語）のコンパイラを新規実装する計画の Phase 0（パッケージ作成・型定義）と Phase 1（レキサー・パーサー）を完了した。

既存の KS パス（TyranoScript 風 `.ks` → Compiler → Op[] → OpRunner）とは独立に、新しい `packages/ksc-compiler` パッケージとして開発している。将来的には KSC ソース → Parser → AST → Type Checker → IR → Stack-based VM の完全なパイプラインとなる。

## 方針

- **再帰下降パーサー**: 読みやすさと拡張性を優先し、Pratt パーサーではなく関数ベースの優先順位制御を採用
- **テスト駆動**: 各モジュールを実装するたびにテストを書き、全て通してから次に進む
- **AST ファースト**: 最初に全 AST ノード型を定義し、パーサーがそれに合わせて構築する形
- **DialogueBlock を第一級ノードに**: KSC 固有の `#speaker "台詞"` 構文を AST レベルでサポート

## 変更ファイル一覧

| # | ファイル | 行数 | 内容 |
|---|---------|------|------|
| 1 | `packages/ksc-compiler/package.json` | 30 | パッケージ定義（`@kaedevn/ksc-compiler` v0.1.0, ESM, vitest） |
| 2 | `packages/ksc-compiler/tsconfig.json` | 14 | TypeScript 設定（ESNext, NodeNext） |
| 3 | `packages/ksc-compiler/vitest.config.ts` | 7 | Vitest 設定 |
| 4 | `packages/ksc-compiler/src/types/token.ts` | 105 | Token 型定義・TokenType enum・KEYWORDS マッピング |
| 5 | `packages/ksc-compiler/src/types/ast.ts` | 275 | AST ノード型定義（Expression 14種、Statement 14種、TypeAnnotation 5種） |
| 6 | `packages/ksc-compiler/src/types/ir.ts` | 99 | IR 命令型定義（OpCode enum、VMResultType、VMState） |
| 7 | `packages/ksc-compiler/src/types/index.ts` | 3 | 型の re-export |
| 8 | `packages/ksc-compiler/src/lexer.ts` | 258 | レキサー実装 |
| 9 | `packages/ksc-compiler/src/parser.ts` | 695 | パーサー実装 |
| 10 | `packages/ksc-compiler/src/index.ts` | 3 | パッケージ公開 API |
| 11 | `packages/ksc-compiler/test/lexer.test.ts` | 296 | レキサーテスト（45ケース） |
| 12 | `packages/ksc-compiler/test/parser.test.ts` | 595 | パーサーテスト（65ケース） |
| | **合計** | **2,380** | |

## 実装の詳細

### Phase 0: パッケージ作成・型定義

#### Token 型（`src/types/token.ts`）

```typescript
export enum TokenType {
  // Literals: Number, String, TemplateString, Boolean, Null, Undefined
  // Keywords: Let, Const, Function, Return, If, Else, For, While, Switch, Case, Default, Break, Import, From, Export, Type, Void
  // Operators: Plus, Minus, Star, Slash, Percent, Eq, NotEq, Lt, LtEq, Gt, GtEq, And, Or, Not, Assign, PlusAssign, MinusAssign, StarAssign, SlashAssign
  // Delimiters: LParen, RParen, LBrace, RBrace, LBracket, RBracket, Comma, Colon, Semicolon, Dot, Arrow, Pipe, QuestionMark
  // Special: Hash (dialogue block), EOF
}
```

キーワード判定は `KEYWORDS` マップで行い、レキサーが identifier を読んだ後にキーワード照合する方式。

#### AST 型（`src/types/ast.ts`）

| カテゴリ | ノード |
|---------|--------|
| Expression (14種) | NumberLiteral, StringLiteral, TemplateLiteral, BooleanLiteral, NullLiteral, UndefinedLiteral, Identifier, BinaryExpr, UnaryExpr, AssignExpr, CallExpr, MemberExpr, IndexExpr, TernaryExpr, ArrayLiteral, ObjectLiteral |
| Statement (14種) | VariableDecl, FunctionDecl, ReturnStmt, IfStmt, ForStmt, WhileStmt, SwitchStmt, BreakStmt, ExpressionStmt, BlockStmt, TypeAliasDecl, ImportDecl, ExportDecl, DialogueBlock |
| TypeAnnotation (5種) | named, array, object, union, literal |

全ノードに `SourceLocation`（line, column）を付与し、エラー報告やデバッグに活用する。

#### IR 型（`src/types/ir.ts`）

スタックベース VM 向けの命令セット設計:

- **スタック操作**: LOAD_CONST, LOAD_VAR, STORE_VAR, POP, DUP
- **算術**: ADD, SUB, MUL, DIV, MOD, NEG
- **比較**: CMP_EQ, CMP_NEQ, CMP_LT, CMP_LTEQ, CMP_GT, CMP_GTEQ
- **論理**: AND, OR, NOT
- **制御フロー**: JMP, JMP_IF_FALSE, CALL, RET, SWITCH
- **オブジェクト/配列**: MAKE_ARRAY, MAKE_OBJECT, GET_FIELD, SET_FIELD, GET_INDEX
- **ホスト API**: HOST_CALL
- **デバッグ**: DEBUG_LINE

VMResult に WAIT 系セマンティクス（WAIT_TIME, WAIT_INPUT, WAIT_EVENT, WAIT_BATTLE）を定義。

### Phase 1: レキサー

`tokenize(source: string): Token[]` — ソースコードをトークン列に変換。

**対応する字句要素:**
- 数値（整数・浮動小数点）
- 文字列（シングル/ダブルクォート、エスケープシーケンス対応）
- テンプレート文字列（バッククォート）
- 識別子とキーワード
- 全演算子（算術、比較、論理、代入、アロー `=>`）
- 全デリミタ（括弧、ブレース、ブラケット、句読点）
- `#`（ダイアログブロック開始）
- コメント（行コメント `//`、ブロックコメント `/* */`）

**エラーハンドリング:**
- 未終端文字列
- 不正な文字（`@` など）
- 単独の `&`（`&&` でなければエラー）
- `LexerError` に行・列情報を含む

### Phase 1: パーサー

`parse(tokens: Token[]): Program` — トークン列を AST に変換。

**演算子の優先順位**（低い → 高い）:

| 優先度 | 演算子 | 関数 |
|--------|--------|------|
| 1 | `=` `+=` `-=` `*=` `/=` | `parseAssignment()` |
| 2 | `? :` | `parseTernary()` |
| 3 | `\|\|` | `parseOr()` |
| 4 | `&&` | `parseAnd()` |
| 5 | `==` `!=` | `parseEquality()` |
| 6 | `<` `<=` `>` `>=` | `parseComparison()` |
| 7 | `+` `-` | `parseAdditive()` |
| 8 | `*` `/` `%` | `parseMultiplicative()` |
| 9 | `-x` `!x` | `parseUnary()` |
| 10 | `f()` `.prop` `[i]` | `parsePostfix()` |

**型アノテーションの対応:**
- 基本型: `number`, `string`, `boolean`, `void`
- ドット付き型: `Battle.State`
- 配列型: `number[]`
- ユニオン型: `"win" | "lose"`
- オブジェクト型: `{ x: number; y: number }`
- リテラル型: `"win"`, `42`, `true`

**KSC 固有の対応:**
- `#speaker "台詞"` を DialogueBlock ノードとしてパース
- `import * as Battle from "battle/api"` の名前空間インポート

## デバッグで判明した問題と修正

| # | 問題 | 原因 | 修正 |
|---|------|------|------|
| 1 | `{ x: 1, y: 2 };` がブロック文として解釈される | 文レベルの `{` は BlockStmt にディスパッチされる。JS/TS と同じ仕様上の曖昧さ | オブジェクトリテラルは式コンテキスト（代入右辺など）でのみ使用 |
| 2 | `Battle.State` 型がパースエラー | 型名パーサーが単一識別子のみ対応していた | `parsePrimaryType()` でドット連結に対応 |
| 3 | `for (let i = 0 i < 10; ...)` がエラーにならない | `parseVariableDecl` がセミコロンを optional に消費するため、for の init でセミコロン省略を許容していた | `parseVariableDecl` に `consumeSemicolon` パラメータを追加し、for-init では `expect(Semicolon)` で明示的に要求 |

## テスト結果

```
 ✓ test/lexer.test.ts   (45 tests)  10ms
 ✓ test/parser.test.ts  (65 tests)  20ms

 Test Files  2 passed (2)
      Tests  110 passed (110)
```

### テストカバレッジ

| モジュール | テスト数 | カバー範囲 |
|-----------|---------|-----------|
| レキサー | 45 | 数値、文字列、テンプレート文字列、ブーリアン/null/undefined、キーワード、演算子、デリミタ、コメント、複合式、ソース位置追跡、エラーケース、ダイアログブロック、仕様サンプル |
| パーサー | 65 | 変数宣言（型あり/なし/ユニオン/配列/ドット付き）、関数宣言、return文、if/else/else-if、for/while、switch/case/default、break、型エイリアス、import（named/namespace/alias）、export（function/const/type）、DialogueBlock、全リテラル型、二項演算（優先順位）、単項演算、代入、関数呼び出し（チェーン/ネスト）、メンバーアクセス、インデックスアクセス、三項演算、括弧式、複合プログラム、エラーケース、ソース位置 |

## 次のステップ

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 0 | パッケージ作成・型定義 | **完了** |
| Phase 1 | レキサー・パーサー | **完了** |
| Phase 2 | 型チェッカー | 未着手 |
| Phase 3 | IR エミッター | 未着手 |
| Phase 4 | スタックベース VM | 未着手 |
| Phase 5 | 統合テスト・既存パスとの共存 | 未着手 |

## 教訓

- **AST 型を先に定義する方式は有効**: パーサー実装時に迷いが少なく、テストも型に沿って書ける
- **文レベルの `{` の曖昧さ**: JS/TS と同じ問題。KSC でもオブジェクトリテラルは式コンテキストのみで有効とする
- **for 文のセミコロン**: 文法の optional 要素が組み合わさると意図しないパースを許容する場合がある。for-init のように文法上必須の位置では明示的に `expect` すべき
- **ドット付き型名**: `Battle.State` のような名前空間修飾型は最初から考慮しておくべきだった（仕様書に例があった）

---

## 関連文書

- [01 KSC インタプリタ移行計画書](./01-ksc-interpreter-migration-plan.md) — 全体の Phase 計画
- [05 KSC Compiler 改善点](./05-ksc-compiler-improvements.md) — Phase 2 以降の改善（await 等）
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — 移植前提の実装課題
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — ir.ts / ast.ts の型拡張仕様
