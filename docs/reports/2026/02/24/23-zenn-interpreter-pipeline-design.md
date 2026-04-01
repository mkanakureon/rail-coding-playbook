---
title: "インタプリタのパイプライン設計 — テキスト→行分類→パース→評価の 4 段階"
emoji: "⚙"
type: "tech"
topics: ["claudecode", "typescript", "パーサー", "設計"]
published: false
---

## はじめに

スクリプト言語のインタプリタを設計するとき、最初に決めるのは「処理をどの粒度で分割するか」だ。

kaedevn の KSC インタプリタは、テキスト入力から最終的なエンジン呼び出しまでを **4 段階のパイプライン** で処理する。この記事では、各段階の設計意図と実装の詳細を解説する。

## 全体アーキテクチャ

```
.ksc テキスト
    |
    v
[1] Interpreter.run() — テキストを行分割 + ラベルマップ構築
    |
    v
[2] Parser.classifyLine() — 行を 6 種別に分類
    |
    v
[3] Tokenizer.tokenize() — 式をトークン列に分解
    |
    v
[4] Evaluator.parseExpression() — 再帰下降で式を評価
    |
    v
IEngineAPI — プラットフォーム操作（bg, ch, bgm, ...）
```

## モジュール構成

```
src/
├── core/
│   ├── Interpreter.ts  # メインクラス（実行制御）
│   ├── Parser.ts       # 構文解析（行分類、ブロック検出）
│   ├── Evaluator.ts    # 式評価（再帰下降パーサー）
│   ├── Tokenizer.ts    # 字句解析（トークン分解）
│   └── GameState.ts    # 状態管理（変数、スタック）
├── engine/
│   └── IEngineAPI.ts   # エンジン抽象インターフェース
├── debug/
│   ├── Debugger.ts     # デバッグ機能
│   └── ErrorHandler.ts # エラー処理
└── types/
    ├── LineType.ts     # 行種別 enum
    ├── Token.ts        # トークン型
    ├── CallFrame.ts    # コールフレーム型
    ├── Choice.ts       # 選択肢ノード型
    └── Error.ts        # エラー型
```

### 依存方向の原則

依存関係は厳密に管理している。

```
Interpreter
├── Parser           （行分類、構造検出）
├── Evaluator        （式評価、代入実行）
│   └── Tokenizer    （字句解析）
├── GameState        （状態管理）
├── IEngineAPI       （プラットフォーム操作）
├── Debugger         （デバッグ機能）
└── ErrorHandler     （エラー処理）
```

- `core/` は `types/`, `engine/`, `debug/` に依存できる
- `engine/` は他モジュールへの依存なし（純粋なインターフェース定義）
- `types/` は他モジュールへの依存なし（純粋な型定義）
- `debug/` は `types/` への依存のみ

この方向性を守ることで、各モジュールを独立してテストできる。特に `Tokenizer` と `Parser` はステートレスなため、単体テストが書きやすい。

## 段階 1: テキスト → 行分割 + 前処理

`Interpreter.run()` がテキストを受け取り、最初に行う処理は 3 つだ。

```typescript
async run(script: string): Promise<void> {
  this.script = script;
  this.lines = script.split("\n");
  this.pc = 0;
  this.running = true;

  // 1. ラベルマップ構築
  this.state.labelMap = this.parser.buildLabelMap(this.lines);

  // 2. 関数/サブルーチン定義のインデックス化
  this.indexFunctions();

  // 3. メインループ開始
  await this.mainLoop();
}
```

### ラベルマップ構築

`Parser.buildLabelMap()` は全行をスキャンして、ラベル名と行番号の対応表を作る。

```typescript
buildLabelMap(lines: string[]): Map<string, number> {
  const labelMap = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (this.classifyLine(line) === LineType.Label) {
      const labelName = this.extractLabelName(line);
      labelMap.set(labelName, i);
    }
  }
  return labelMap;
}
```

これを **実行前に一括構築する** 理由は、`jump()` コマンドの実行時にラベルを線形探索したくないからだ。ラベルマップがあれば O(1) でジャンプ先を特定できる。

### 関数インデックス化

`indexFunctions()` は `def`/`sub` 定義をスキャンし、関数名・引数リスト・本体の開始行/終了行を記録する。

```typescript
interface FunctionDef {
  name: string;
  params: string[];
  bodyStart: number;
  bodyEnd: number;
}
```

ここで重要なのは、**関数の本体を事前にパースしない**ことだ。記録するのは行番号の範囲だけで、実際のパースと評価は呼び出し時に行う。これにより、前処理のコストを最小限に抑えている。

## 段階 2: Parser — 行分類

`Parser.classifyLine()` は、トリム済みの行を 6 種別に分類する。

```typescript
enum LineType {
  DialogueStart = "DialogueStart",  // #キャラ名
  DialogueEnd   = "DialogueEnd",    // #（単体）
  Label         = "Label",          // *ラベル名
  Comment       = "Comment",        // // ...
  Empty         = "Empty",          // 空行
  Expression    = "Expression",     // それ以外
}
```

実装は極めてシンプルだ。

```typescript
classifyLine(line: string): LineType {
  if (line === "") return LineType.Empty;

  const firstChar = line[0];

  if (firstChar === "#") {
    return line.length === 1
      ? LineType.DialogueEnd
      : LineType.DialogueStart;
  }

  if (firstChar === "*") return LineType.Label;
  if (line.startsWith("//")) return LineType.Comment;

  return LineType.Expression;
}
```

### なぜ 6 種別なのか

最初は `Dialogue`, `Label`, `Comment`, `Expression` の 4 種別で設計していた。しかし `Dialogue` を `DialogueStart` と `DialogueEnd` に分離した方が、セリフブロックの処理が明確になることに気づいた。

`Empty` も当初は `Comment` と同じ扱いだったが、デバッグ時に「この行は空行でスキップされた」と「この行はコメントでスキップされた」を区別したかったため、分離した。

### Parser がステートレスである理由

Parser は内部状態を持たない。`classifyLine()` は純粋関数であり、同じ入力に対して常に同じ出力を返す。

これは意図的な設計だ。Parser に状態を持たせると、テスト時にリセット処理が必要になる。また、Interpreter の `step()` メソッドが Parser を繰り返し呼び出す際に、前回の呼び出しの影響を受けないことが保証される。

## 段階 3: Tokenizer — 字句解析

式文（`LineType.Expression`）が見つかると、`Evaluator` が内部で `Tokenizer` を使ってトークン列に分解する。

```typescript
interface Token {
  type: TokenType;
  value: string;
  position: number;
}

enum TokenType {
  Number      // 数値: 42, 3.14
  String      // 文字列: "hello"
  Boolean     // 真偽値: true, false
  Identifier  // 識別子: score, name
  Keyword     // キーワード: if, def, return
  Operator    // 演算子: +, -, ==, &&
  Assign      // 代入: =, +=, -=
  LeftParen   // (
  RightParen  // )
  LeftBrace   // {
  RightBrace  // }
  Comma       // ,
}
```

Tokenizer の実装で特筆すべき点は以下の 3 つだ。

### 1. エスケープシーケンス処理

文字列リテラル内のエスケープシーケンスを処理する。

```typescript
private readString(quote: string): Token {
  this.position++; // 開始クォートをスキップ
  let value = "";

  while (this.position < this.input.length) {
    const char = this.input[this.position];
    if (char === quote) {
      this.position++;
      break;
    }
    if (char === "\\") {
      this.position++;
      const escaped = this.input[this.position];
      switch (escaped) {
        case "n": value += "\n"; break;
        case "t": value += "\t"; break;
        case "\\": value += "\\"; break;
        case '"': value += '"'; break;
        case "'": value += "'"; break;
        default: value += escaped;
      }
      this.position++;
    } else {
      value += char;
      this.position++;
    }
  }

  return { type: TokenType.String, value, position: start };
}
```

### 2. 2 文字演算子の先読み

`==`, `!=`, `>=`, `<=`, `&&`, `||`, `+=`, `-=`, `*=`, `/=` といった 2 文字演算子を正しく認識するために、1 文字先読みを行う。

```typescript
private readOperatorOrSymbol(): Token {
  const char = this.input[this.position];

  if (this.position + 1 < this.input.length) {
    const twoChar = char + this.input[this.position + 1];

    if (["+=", "-=", "*=", "/="].includes(twoChar)) {
      this.position += 2;
      return { type: TokenType.Assign, value: twoChar, position: start };
    }

    if (["==", "!=", ">=", "<="].includes(twoChar)) {
      this.position += 2;
      return { type: TokenType.Operator, value: twoChar, position: start };
    }

    if (["&&", "||"].includes(twoChar)) {
      this.position += 2;
      return { type: TokenType.Operator, value: twoChar, position: start };
    }
  }

  // 1文字演算子の処理...
}
```

### 3. キーワード vs 識別子の判定

`true`, `false`, `if`, `def` などのキーワードと、ユーザー定義の識別子は同じルール（英字で始まる英数字+アンダースコア）でトークン化される。判定は文字列マッチングで行う。

```typescript
private readIdentifier(): Token {
  // ...文字列を読み取り...

  const keywords = [
    "true", "false", "if", "else",
    "while", "def", "sub", "return", "choice"
  ];
  const type = keywords.includes(value)
    ? TokenType.Keyword
    : TokenType.Identifier;

  if (value === "true" || value === "false") {
    return { type: TokenType.Boolean, value, position: start };
  }

  return { type, value, position: start };
}
```

`true`/`false` は `TokenType.Boolean` として特別扱いしている。これにより Evaluator 側での判定が簡潔になる。

## 段階 4: Evaluator — 再帰下降パーサー

トークン列を受け取り、再帰下降パーサーで式を評価する。

```
parseExpression()
  └── parseLogicOr()
       └── parseLogicAnd()
            └── parseEquality()
                 └── parseComparison()
                      └── parseAddition()
                           └── parseMultiplication()
                                └── parseUnary()
                                     └── parsePrimary()
```

この構造は **演算子の優先順位テーブルをそのまま関数の呼び出し階層に反映** したものだ。優先度が低い演算子ほど上位の関数で処理される。

### なぜ再帰下降を選んだか

代替として Pratt パーサー（優先度登り法）も検討した。Pratt パーサーは優先度テーブルをデータとして持ち、ループで処理するため、新しい演算子の追加が容易だ。

しかし KSC の演算子は **凍結済み** であり、今後大幅に増える予定がない。再帰下降パーサーの方がコードの流れが直感的で、デバッグしやすいという利点を優先した。

### 非同期評価

Evaluator のすべてのパースメソッドは `async` だ。

```typescript
async evaluate(expr: string, state: GameState): Promise<unknown> {
  this.tokens = this.tokenizer.tokenize(expr);
  this.currentIndex = 0;
  if (this.tokens.length === 0) return null;
  return await this.parseExpression(state);
}
```

これは式の中で**ユーザー定義関数を呼び出せる**ためだ。ユーザー定義関数はエンジンの非同期メソッド（`showDialogue`, `wait` など）を呼ぶ可能性がある。

```ksc
// この式の評価中に mood() が呼ばれ、mood() 内で showDialogue が呼ばれる可能性がある
ch("heroine", mood(affection), "center")
```

当初は同期評価で設計していたが、Phase 5（関数呼び出し対応）で非同期化が必要になり、全メソッドを `async` に変更した。

### 関数呼び出しハンドラー

Evaluator は関数呼び出しの実装を知らない。代わりに **FunctionCallHandler** コールバックを Interpreter から注入する。

```typescript
export type FunctionCallHandler = (
  name: string,
  args: unknown[]
) => Promise<unknown>;

// Interpreter のコンストラクタで注入
this.evaluator.setFunctionCallHandler(async (name, args) => {
  if (this.state.functions.has(name) || this.state.subroutines.has(name)) {
    return await this.executeUserFunction(name, args);
  }
  if (this.isBuiltinFunction(name)) {
    throw new Error(`組み込み関数 '${name}' は式の中では使用できません`);
  }
  throw new Error(`未定義の関数: ${name}`);
});
```

この設計により、Evaluator は Interpreter に依存しない。テスト時にモックハンドラーを注入すれば、Evaluator 単体でテストできる。

## step() の処理フロー

Interpreter のメインループは `step()` を繰り返し呼ぶ。`step()` の内部フローは以下の通り。

```typescript
private async step(): Promise<void> {
  // デバッグ: ブレークポイントチェック
  if (this.debugger.isEnabled()) {
    const shouldBreak = await this.debugger.shouldBreak(/*...*/);
    if (shouldBreak) this.debugger.pause();
  }

  const line = this.lines[this.pc].trim();

  // 空行/コメント → スキップ
  if (line === "" || line.startsWith("//")) {
    this.pc++;
    return;
  }

  // def/sub 定義 → ブロック末尾までスキップ
  if (line.startsWith("def ") || line.startsWith("sub ")) {
    const blockEnd = this.parser.findBlockEnd(this.lines, this.pc);
    this.pc = blockEnd + 1;
    return;
  }

  const lineType = this.parser.classifyLine(line);

  switch (lineType) {
    case LineType.DialogueStart:
      await this.handleDialogue(line);
      break;
    case LineType.DialogueEnd:
      this.pc++;
      break;
    case LineType.Label:
      this.pc++;
      break;
    case LineType.Expression:
      await this.handleExpression(line);
      break;
    default:
      this.pc++;
  }
}
```

### PC 制御の分離

`jump`, `call`, `ret` のようなフロー制御コマンドは `executeBuiltin()` の戻り値で PC の制御方法を分岐する。

```typescript
const shouldIncrementPc = await this.executeBuiltin(funcName, args);
if (shouldIncrementPc) {
  this.pc++;
}
```

`jump` は `this.pc` を直接書き換えるため、`false` を返して自動インクリメントを抑制する。通常のコマンド（`bg`, `ch` など）は `true` を返し、PC が 1 つ進む。

## GameState: 実行状態の管理

```typescript
class GameState {
  variables: Map<string, unknown> = new Map();      // グローバル変数
  localScopes: Map<string, unknown>[] = [];          // ローカルスコープスタック
  callStack: CallFrame[] = [];                       // 呼び出しスタック
  labelMap: Map<string, number> = new Map();          // ラベルマップ
  functions: Map<string, FunctionDef> = new Map();    // 関数定義
  subroutines: Map<string, FunctionDef> = new Map();  // サブルーチン定義
}
```

変数の参照は **ローカルスコープを内側から外側に検索し、最後にグローバル** を見る。

```typescript
getVar(name: string): unknown {
  // ローカルスコープを逆順で検索（最も内側から）
  for (let i = this.localScopes.length - 1; i >= 0; i--) {
    if (this.localScopes[i].has(name)) {
      return this.localScopes[i].get(name);
    }
  }
  // グローバルスコープから取得
  return this.variables.get(name);
}
```

このスコープチェーンは JavaScript のレキシカルスコープとは異なり、**動的スコープ**に近い。KSC は関数のネストが浅い（最大再帰深度 16）ため、動的スコープの問題が顕在化しにくいという判断で採用した。

## 拡張ポイント

パイプラインの各段階は独立しているため、拡張箇所が明確だ。

| 拡張内容 | 変更箇所 | 影響範囲 |
|---------|---------|---------|
| 新コマンド追加 | `executeBuiltin()` に case 追加 + `IEngineAPI` にメソッド追加 | Interpreter + IEngineAPI |
| 新構文追加 | `handleExpression()` に分岐追加 | Interpreter |
| 新演算子追加 | Tokenizer に認識ルール + Evaluator にパースメソッド | Tokenizer + Evaluator |
| デバッグ拡張 | Debugger に新機能追加 | Debugger のみ |

例えば新しい組み込みコマンド `shake()` を追加する場合、`executeBuiltin()` に `case "shake"` を追加し、`IEngineAPI` に `shake()` メソッドを追加するだけだ。パーサーやトークナイザーには一切変更が不要。

## まとめ

KSC インタプリタの 4 段階パイプラインは、以下の原則で設計されている。

1. **各段階の責務が明確**: テキスト分割、行分類、字句解析、式評価がそれぞれ独立
2. **依存方向は一方向**: Tokenizer は Evaluator を知らない、Parser は Interpreter を知らない
3. **ステートレスな解析器**: Parser と Tokenizer は内部状態を持たず、テストが容易
4. **非同期対応**: 式評価中のエンジン呼び出しに対応するため、全パースメソッドが async

---

4 段階のパイプライン設計を解説した。特に Parser のステートレス設計と Evaluator の非同期化が、後の機能追加（関数呼び出し、デバッグ機能）を容易にした。再帰下降パーサーは教科書的なアプローチだが、演算子セットが凍結済みの言語には最適な選択だったと考えている。

　　　　　　　　　　Claude Opus 4.6
