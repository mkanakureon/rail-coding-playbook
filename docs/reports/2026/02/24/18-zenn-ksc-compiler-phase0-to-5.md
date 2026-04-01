---
title: "KSC コンパイラを Phase 0 から Phase 5 まで一気に実装した"
emoji: "🔧"
type: "tech"
topics: ["claudecode", "typescript", "コンパイラ", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」の .ksc（Kaede Script）ファイルをコンパイルするコンパイラを TypeScript で実装した。Tokenizer → Parser → Transformer → Finalizer → Validator の 5 段パイプラインで、テキストコマンド、変数操作、選択肢、IF 文をサポートする。この記事ではその全体構造と各フェーズの設計判断を解説する。

## コンパイラの全体像

コンパイラは `Compiler` クラスが各段をオーケストレーションする。

```typescript
// packages/compiler/src/compiler/Compiler.ts
export class Compiler {
  private tokenizer: Tokenizer;
  private parser: Parser;
  private transformer: Transformer;
  private finalizer: Finalizer;
  private validator: Validator;

  public compile(source: string, options: CompilerOptions = {}): CompiledScenario {
    // 1. Tokenize: ソースコードをトークン列に変換
    const tokens = this.tokenizer.tokenize(source);

    // 2. Parse: トークン列を Op 命令列に変換
    let ops = this.parser.parse(tokens);

    // 3. Transform: 埋め込みコマンドを分解
    ops = this.transformer.transform(ops);

    // 4. Finalize: 末尾の安全チェック
    ops = this.finalizer.finalize(ops);

    // 5. Validate: ID 形式・値範囲のバリデーション
    if (options.validate !== false) {
      this.validator.validate(ops);
    }

    return { id: options.scenarioId || 'scenario', ops };
  }
}
```

入力は `.ksc` のソースコード文字列、出力は `CompiledScenario`（Op 命令の配列）。

## Phase 0: トークン型の定義

まずトークンの型を定義する。.ksc 言語の構文要素を反映した 10 種類のトークン型を用意した。

```typescript
// packages/compiler/src/types/Token.ts
export type LineType =
  | 'COMMENT' | 'COMMAND' | 'TEXT' | 'VAR_SET'
  | 'CHOICE_START' | 'CHOICE_OPTION' | 'CHOICE_END'
  | 'IF_START' | 'IF_ELSE' | 'IF_END';

export interface CommandToken extends Token {
  type: 'COMMAND';
  command: string;
  args: string[];
}

export interface VarSetToken extends Token {
  type: 'VAR_SET';
  varName: string;
  operator: '=' | '+=' | '-=';
  value: string;
}

export interface ChoiceOptionToken extends Token {
  type: 'CHOICE_OPTION';
  text: string;
  condition?: string;
}

export interface IfStartToken extends Token {
  type: 'IF_START';
  condition: string;
}
```

## Phase 1: Tokenizer（字句解析）

Tokenizer は行単位でソースを分析し、各行をトークンに変換する。

```typescript
// packages/compiler/src/tokenizer/Tokenizer.ts
export class Tokenizer {
  public tokenize(source: string): TokenUnion[] {
    const lines = source.split('\n');
    const tokens: TokenUnion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      if (!line) continue;

      const type = classifyLine(line);

      if (type === 'COMMENT') continue;

      if (type === 'COMMAND') {
        tokens.push(this.parseCommand(line, lineNum));
        continue;
      }

      if (type === 'VAR_SET') {
        tokens.push(this.parseVarSet(line, lineNum));
        continue;
      }

      if (type === 'TEXT') {
        tokens.push(this.parseText(line, lineNum));
        continue;
      }

      // CHOICE_START, CHOICE_OPTION, CHOICE_END,
      // IF_START, IF_ELSE, IF_END も同様に分岐
    }

    return tokens;
  }
}
```

行の分類は `lineClassifier.ts` の `classifyLine()` 関数が担当する。先頭文字と正規表現で判定する。

- `@` で始まる → `COMMAND`
- `//` で始まる → `COMMENT`
- `if (` で始まる → `IF_START`
- `choice {` → `CHOICE_START`
- `"` で始まり `{` で終わる → `CHOICE_OPTION`
- 変数代入パターン (`\w+ [+\-]?= ...`) → `VAR_SET`
- その他 → `TEXT`

### コマンドのパース

`.ksc` のコマンドは TyranoScript スタイルで `@command arg1 arg2` の形式。

```typescript
private parseCommand(line: string, lineNum: number): CommandToken {
  const parts = line.substring(1).split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  return {
    type: 'COMMAND',
    line: lineNum,
    raw: line,
    command,
    args,
  };
}
```

### 変数代入のパース

```typescript
private parseVarSet(line: string, lineNum: number): VarSetToken {
  const match = line.match(/^\s*(\w+)\s*(=|\+=|-=)\s*(.+)/);
  if (!match) {
    throw new Error(`[Line ${lineNum}] Invalid variable assignment: ${line}`);
  }

  const [, varName, operator, value] = match;
  return {
    type: 'VAR_SET',
    line: lineNum,
    raw: line,
    varName: varName.trim(),
    operator: operator as '=' | '+=' | '-=',
    value: value.trim(),
  };
}
```

## Phase 2: Parser（構文解析 → Op 命令生成）

Parser はトークン列を受け取り、ゲームエンジンが実行できる Op 命令列を生成する。

```typescript
// packages/compiler/src/parser/Parser.ts
export class Parser {
  private tokens: TokenUnion[] = [];
  private current = 0;

  public parse(tokens: TokenUnion[]): Op[] {
    this.tokens = tokens;
    this.current = 0;
    return this.parseBlock();
  }

  private parseBlock(): Op[] {
    const ops: Op[] = [];

    while (this.current < this.tokens.length) {
      const token = this.tokens[this.current];

      if (token.type === 'COMMAND') {
        ops.push(parseCommand(token));
        this.current++;
      } else if (token.type === 'TEXT') {
        ops.push(parseText(token));
        this.current++;
      } else if (token.type === 'VAR_SET') {
        ops.push(this.parseVarSet(token));
        this.current++;
      } else if (token.type === 'CHOICE_START') {
        ops.push(...this.parseChoice(ops.length));
      } else if (token.type === 'IF_START') {
        ops.push(...this.parseIf(ops.length));
      } else if (token.type === 'CHOICE_END' ||
                 token.type === 'IF_END' ||
                 token.type === 'IF_ELSE') {
        break;
      } else {
        this.current++;
      }
    }

    return ops;
  }
}
```

### 変数操作の Op 変換

```typescript
private parseVarSet(token: VarSetToken): Op {
  const value = parseFloat(token.value);
  if (isNaN(value)) {
    throw new Error(`[Line ${token.line}] Invalid number: ${token.value}`);
  }

  switch (token.operator) {
    case '=':  return { op: 'VAR_SET', name: token.varName, value };
    case '+=': return { op: 'VAR_ADD', name: token.varName, value };
    case '-=': return { op: 'VAR_SUB', name: token.varName, value };
  }
}
```

### IF 文の Op 変換

IF 文は `JUMP_IF` と `JUMP` の組み合わせで実装する。

```typescript
private parseIf(pcOffset: number): Op[] {
  const ifToken = this.tokens[this.current];
  const condition = ifToken.condition;
  this.current++;

  // then ブロックと else ブロックをパース
  const thenOps: Op[] = [];
  // ... thenOps を収集 ...

  let elseOps: Op[] = [];
  if (this.tokens[this.current]?.type === 'IF_ELSE') {
    this.current++;
    // ... elseOps を収集 ...
  }

  // 命令列を構築
  const ops: Op[] = [];

  // JUMP_IF: 条件が真なら then へ
  ops.push({ op: 'JUMP_IF', condition, pc: 0 });

  // else ブロック（条件偽の場合）
  ops.push(...elseOps);

  // else の後は then をスキップ
  if (elseOps.length > 0) {
    ops.push({ op: 'JUMP', pc: 0 });
  }

  // then ブロック
  const thenStartIndex = ops.length;
  ops.push(...thenOps);

  // ジャンプ先を設定（絶対アドレス）
  (ops[0] as any).pc = pcOffset + thenStartIndex;
  // ...

  return ops;
}
```

IF 文の実装で最も注意が必要なのは **絶対アドレスの計算**だ。`pcOffset` はこの IF ブロックが命令列全体の何番目から始まるかを示し、内部のジャンプ先はすべて `pcOffset + 相対位置` で計算する。ネストされた IF 文でも `adjustPcOffsets` で再帰的にアドレスを補正する。

```typescript
private adjustPcOffsets(ops: Op[], offset: number): void {
  for (const op of ops) {
    if (op.op === 'JUMP') {
      op.pc += offset;
    } else if (op.op === 'JUMP_IF') {
      op.pc += offset;
    } else if (op.op === 'CHOICE') {
      for (const option of op.options) {
        option.jump += offset;
      }
    }
  }
}
```

### 選択肢の Op 変換

選択肢は `CHOICE` Op で表現し、各選択肢のジャンプ先を配列で持つ。

```
CHOICE { options: [{ label: "選択A", jump: 3 }, { label: "選択B", jump: 7 }] }
// jump=3: 選択A のブロック開始位置
// jump=7: 選択B のブロック開始位置
```

各選択肢のブロック末尾には `JUMP` を配置して、choice 終了後の位置にスキップする。

## Phase 3: Transformer（埋め込みコマンド分解）

.ksc のテキスト行には `@l`（クリック待ち）、`@p`（ページ送り）、`@r`（改行）を埋め込める。Transformer はこれらを個別の Op に分解する。

```typescript
// packages/compiler/src/transformer/Transformer.ts
export class Transformer {
  public transform(ops: Op[]): Op[] {
    const result: Op[] = [];

    for (const op of ops) {
      if (op.op === 'TEXT_APPEND') {
        const expanded = this.expandEmbeddedCommands(op);
        result.push(...expanded);
      } else {
        result.push(op);
      }
    }

    return result;
  }

  private expandEmbeddedCommands(textOp: Op & { op: 'TEXT_APPEND' }): Op[] {
    const { text, who } = textOp;
    const parts = text.split(/(@[lpr])/);

    const ops: Op[] = [];
    for (const part of parts) {
      if (part === '@l') {
        ops.push({ op: 'WAIT_CLICK' });
      } else if (part === '@p') {
        ops.push({ op: 'PAGE' });
      } else if (part === '@r') {
        ops.push({ op: 'TEXT_NL' });
      } else if (part) {
        const op: Op = { op: 'TEXT_APPEND', text: part };
        if (who) op.who = who;
        ops.push(op);
      }
    }

    return ops;
  }
}
```

例えば「こんにちは@lお元気ですか？」は以下の 3 つの Op に分解される。

1. `TEXT_APPEND { text: "こんにちは" }`
2. `WAIT_CLICK {}`
3. `TEXT_APPEND { text: "お元気ですか？" }`

## Phase 4: Finalizer（末尾安全チェック）

命令列の末尾が待機コマンドで終わっていない場合、自動的に `PAGE` を追加する。これにより「最後のテキストが表示された瞬間にゲームが終了する」事故を防ぐ。

```typescript
// packages/compiler/src/finalizer/Finalizer.ts
export class Finalizer {
  public finalize(ops: Op[]): Op[] {
    if (ops.length === 0) return ops;

    const last = ops[ops.length - 1];

    const needsPage =
      last.op !== 'WAIT_CLICK' &&
      last.op !== 'PAGE' &&
      last.op !== 'WAIT_MS';

    if (needsPage) {
      return [...ops, { op: 'PAGE' }];
    }

    return ops;
  }
}
```

シンプルだが、テスト中に「スクリプトの最後で止まらない」バグを何度も防いでくれた安全ネットだ。

## Phase 5: Validator（バリデーション）

Validator は Op 命令列を走査し、ID の形式、値の範囲、空文字列チェックを行う。

```typescript
// packages/compiler/src/validator/Validator.ts
export class Validator {
  public validate(ops: Op[]): void {
    const errors: CompilerError[] = [];

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      switch (op.op) {
        case 'BG_SET':
          this.validateId(op.id, 'background ID', `op[${i}]`, errors);
          this.validateFadeMs(op.fadeMs, `op[${i}]`, errors);
          break;

        case 'CH_SET':
          this.validateId(op.name, 'character name', `op[${i}]`, errors);
          this.validateId(op.pose, 'pose ID', `op[${i}]`, errors);
          break;

        case 'BGM_PLAY':
          this.validateId(op.id, 'BGM ID', `op[${i}]`, errors);
          this.validateVolume(op.vol, `op[${i}]`, errors);
          break;

        case 'TEXT_APPEND':
          if (op.text === '') {
            errors.push({
              code: 'INVALID_VALUE',
              message: 'Empty text in TEXT_APPEND',
              line: 0, source: `op[${i}]`,
            });
          }
          break;
      }
    }

    if (errors.length > 0) {
      throw new CompilationException(errors);
    }
  }
}
```

バリデーションルールの例。

- **ID 形式**: 空文字列禁止、先頭末尾スペース禁止、改行文字禁止
- **音量**: 0~100 の範囲
- **フェード時間**: 非負数
- **テキスト**: 空文字列禁止

## .ksc ソースの例と変換結果

```
// 入力
@bg school_entrance fade
こんにちは。私の名前は花子です。@l
choice {
  "教室に行く" {
    @bg classroom
  }
  "図書室に行く" {
    @bg library
  }
}
```

コンパイル後の Op 列:

```
BG_SET { id: "school_entrance", fadeMs: 300 }
TEXT_APPEND { text: "こんにちは。私の名前は花子です。" }
WAIT_CLICK {}
CHOICE { options: [
  { label: "教室に行く", jump: 3 },
  { label: "図書室に行く", jump: 5 }
]}
BG_SET { id: "classroom" }
JUMP { pc: 6 }
BG_SET { id: "library" }
PAGE {}  ← Finalizer が追加
```

## まとめ

| Phase | 担当 | 入力 | 出力 |
|-------|------|------|------|
| 0 | Token types | - | 型定義 |
| 1 | Tokenizer | ソースコード | TokenUnion[] |
| 2 | Parser | TokenUnion[] | Op[] |
| 3 | Transformer | Op[] | Op[]（埋め込み分解済み） |
| 4 | Finalizer | Op[] | Op[]（末尾安全チェック済み） |
| 5 | Validator | Op[] | void / throw |

各フェーズが明確な責務を持ち、パイプラインとして結合される。この構造により、新しいコマンドやバリデーションルールの追加が容易になっている。

---

Tokenizer から Validator まで 5 段パイプラインを一気通貫で実装した。最も苦労したのは IF 文と選択肢の絶対アドレス計算で、ネストされた構造を再帰的に処理しつつジャンプ先を正確に設定する部分は何度もテストを書き直した。Transformer と Finalizer は小さいクラスだが、「埋め込みコマンドの分解」と「末尾安全チェック」という明確な責務を持たせたことで、パイプラインの各段が独立してテスト可能になっている。

　　　　　　　　　　Claude Opus 4.6
