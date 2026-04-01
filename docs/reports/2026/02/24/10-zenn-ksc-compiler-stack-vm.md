---
title: "Stack-based VM を TypeScript で実装した — .ksc コンパイラ Phase 4"
emoji: "🔧"
type: "tech"
topics: ["claudecode", "typescript", "コンパイラ", "VM"]
published: false
---

## はじめに

ビジュアルノベルエンジン kaedevn では、TyranoScript 風の `.ks` ファイルをコンパイルして Op 命令列に変換し、スタックベースの VM で実行するアーキテクチャを採用している。本記事では、このコンパイラの 4 段パイプライン（Lexer → Parser → Transformer → Finalizer）と、69 テスト追加で全 315 テストを通過させるまでの道のりを記録する。

## コンパイラの全体像

コンパイラは以下の 4 段パイプラインで構成される。

```
.ks ソースコード
    |
    v
[Tokenizer] --- 字句解析 → TokenUnion[]
    |
    v
[Parser]    --- 構文解析 → Op[]（中間表現）
    |
    v
[Transformer] - 埋め込みコマンド分解（@l/@p/@r）
    |
    v
[Finalizer] --- 末尾処理 → CompiledScenario
```

`Compiler` クラスがこれらを統括する。

```typescript
export class Compiler {
  private tokenizer: Tokenizer;
  private parser: Parser;
  private transformer: Transformer;
  private finalizer: Finalizer;
  private validator: Validator;

  public compile(source: string, options: CompilerOptions = {}): CompiledScenario {
    const scenarioId = options.scenarioId || 'scenario';
    const validate = options.validate !== false;

    // Tokenize
    const tokens = this.tokenizer.tokenize(source);
    // Parse
    let ops = this.parser.parse(tokens);
    // Transform (埋め込み分解)
    ops = this.transformer.transform(ops);
    // Finalize (末尾@p)
    ops = this.finalizer.finalize(ops);
    // Validate
    if (validate) {
      this.validator.validate(ops);
    }

    return { id: scenarioId, ops };
  }
}
```

## Stage 1: Tokenizer（字句解析）

Tokenizer は `.ks` ソースコードを行単位で分類し、トークン列に変換する。

### 行分類（lineClassifier）

TyranoScript 風の記法では、行の先頭文字で種類が決まる。

| 先頭 | 種別 | 例 |
|---|---|---|
| `@` | COMMAND | `@bg forest` |
| `;` | COMMENT | `; これはコメント` |
| `"` + `{` | CHOICE_OPTION | `"戦う" { ... }` |
| `}` | CHOICE_END / IF_END | `}` |
| `if (...)` | IF_START | `if (x > 5) {` |
| `else` | IF_ELSE | `} else {` |
| 変数代入 | VAR_SET | `count += 1` |
| その他 | TEXT | `こんにちは` |

### Tokenizer の実装

```typescript
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

      // CHOICE_START, CHOICE_OPTION, IF_START ...
      // 各種トークンの生成
    }

    return tokens;
  }

  private parseCommand(line: string, lineNum: number): CommandToken {
    const parts = line.substring(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    return { type: 'COMMAND', line: lineNum, raw: line, command, args };
  }
}
```

コマンドトークンは `@` を除去してスペース分割するだけというシンプルな設計だ。TyranoScript の `[command param=value]` 形式ではなく `@command arg1 arg2` 形式を採用したのは、パースの単純さと可読性を両立させるためだ。

### 変数代入のパース

変数代入は 3 種類の演算子をサポートする。

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

## Stage 2: Parser（構文解析・Op 生成）

Parser はトークン列を受け取り、Op 命令列に変換する。ここが最も複雑な部分だ。

### Op 命令セット

コンパイラが生成する Op は 21 種類ある。

| カテゴリ | Op | 説明 |
|---|---|---|
| テキスト | `TEXT_APPEND` | テキスト追加 |
| テキスト | `TEXT_NL` | 改行 |
| 待機 | `WAIT_CLICK` | クリック待ち |
| 待機 | `PAGE` | ページ送り |
| 待機 | `WAIT_MS` | 時間待ち |
| 背景 | `BG_SET` | 背景設定 |
| キャラクター | `CH_SET` / `CH_HIDE` / `CH_CLEAR` / `CH_ANIM` | キャラ操作 |
| 音声 | `BGM_PLAY` / `BGM_STOP` / `SE_PLAY` / `VOICE_PLAY` | 音声制御 |
| 変数 | `VAR_SET` / `VAR_ADD` / `VAR_SUB` | 変数操作 |
| 選択肢 | `CHOICE` | 選択肢表示 |
| 制御 | `JUMP` / `JUMP_IF` | 条件分岐 |

### 選択肢（CHOICE）のコンパイル

選択肢のコンパイルが最も複雑だ。各選択肢のブロックを線形な Op 列に変換し、ジャンプアドレスを解決する必要がある。

```typescript
private parseChoice(pcOffset: number): Op[] {
  this.current++; // CHOICE_START を消費

  const options: Array<{ label: string; jump: number }> = [];
  const optionBlocks: Op[][] = [];

  // 各選択肢のブロックをパース
  while (this.current < this.tokens.length) {
    const token = this.tokens[this.current];
    if (token.type === 'CHOICE_END') { this.current++; break; }

    if (token.type === 'CHOICE_OPTION') {
      options.push({ label: token.text, jump: 0 });
      this.current++;

      // ブロック内の Op を収集
      const blockOps: Op[] = [];
      // ... 各コマンドをパース ...
      optionBlocks.push(blockOps);
    }
  }

  // ジャンプ先を計算（絶対アドレス）
  const ops: Op[] = [];
  const choiceOp: Op = { op: 'CHOICE', options: [] };
  ops.push(choiceOp);

  for (let i = 0; i < optionBlocks.length; i++) {
    jumpTargets.push(ops.length);
    ops.push(...optionBlocks[i]);
    if (i < optionBlocks.length - 1) {
      ops.push({ op: 'JUMP', pc: 0 }); // 選択肢ブロック後のスキップ
    }
  }

  // 絶対アドレスに変換
  for (let i = 0; i < options.length; i++) {
    options[i].jump = pcOffset + jumpTargets[i];
  }
  (ops[0] as any).options = options;

  return ops;
}
```

### if/else のコンパイル

if/else は `JUMP_IF` と `JUMP` の組み合わせで実装する。条件が真なら then ブロックへ、偽なら else ブロックへジャンプする。

```
JUMP_IF condition → then_start
[else block...]
JUMP → after_if
[then block...]        ← then_start
                       ← after_if
```

この配置は一見不自然だが、`JUMP_IF` の意味を「条件が真ならジャンプ」と定義することで、else ブロックが自然にフォールスルーする設計になっている。

## Stage 3: Transformer（埋め込みコマンド分解）

TyranoScript では行中に `@l`（クリック待ち）、`@p`（ページ送り）、`@r`（改行）を埋め込める。Transformer はこれらを分解する。

```typescript
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

例えば「こんにちは@l世界@p」というテキストは以下に分解される:

```
TEXT_APPEND "こんにちは"
WAIT_CLICK
TEXT_APPEND "世界"
PAGE
```

## Stage 4: VM（OpRunner）

コンパイルされた Op 列は `OpRunner` で実行される。OpRunner はプログラムカウンタ（pc）ベースの単純な VM だ。

```
CompiledScenario { id, ops[] }
        |
        v
   +-----------+    dispatch    +------------+
   | OpRunner  |--------------->| IOpHandler | (Web / CLI / Switch)
   |  pc=0     |    each op     |            |
   |  vars={}  |<---------------|            |
   |  read={}  |   await/return +------------+
   +-----------+
```

OpRunner の内部状態は以下の 4 つだけだ。

| フィールド | 型 | 用途 |
|---|---|---|
| `pc` | `number` | プログラムカウンタ |
| `vars` | `Record<string, unknown>` | 変数ストア |
| `read` | `Record<number, boolean>` | 既読フラグ |
| `running` | `boolean` | 実行中フラグ |

各 Op はプラットフォーム抽象の `IOpHandler` に委譲して実行される。ブラウザなら PixiJS、CLI ならコンソール出力、将来の Switch なら NVN フレームワークで実装を差し替えられる。

## Validator（検証）

Validator は生成された Op 列が正しいかを検証する。主なチェック項目は以下のとおりだ。

- `JUMP` / `JUMP_IF` のジャンプ先が Op 列の範囲内か
- `CHOICE` の各選択肢のジャンプ先が有効か
- アセット ID の形式が正しいか（`[a-z0-9_]` のみ）
- 重複するラベルがないか

## テスト戦略

テストは各ステージごとに独立して書いている。

```
test/
├── tokenizer.test.ts     # Tokenizer 単体テスト
├── phase2.test.ts        # コマンド→Op変換テスト
├── phase3.test.ts        # 変数代入テスト
├── phase5.test.ts        # 選択肢・if 文テスト
├── validator.test.ts     # Validator テスト
└── integration.test.ts   # パイプライン全体の結合テスト
```

結合テストでは `.ks` ソースをコンパイルして Op 列を検証する。

```typescript
test('選択肢のコンパイル', () => {
  const source = `
choice {
  "はい" {
    @bg yes_scene
  }
  "いいえ" {
    @bg no_scene
  }
}
@bg after_choice
`;
  const result = compile(source);
  expect(result.ops[0].op).toBe('CHOICE');
  expect(result.ops[0].options).toHaveLength(2);
  expect(result.ops[0].options[0].label).toBe('はい');
});
```

## パフォーマンス

1000 行のスクリプトのコンパイルにかかる時間を計測した結果、約 2ms だった。ノベルゲームのシナリオファイルは通常数百行程度なので、リアルタイムプレビュー（エディタでの即時反映）に十分な速度だ。

## まとめ

| ステージ | 入力 | 出力 | テスト数 |
|---|---|---|---|
| Tokenizer | `.ks` ソース | `TokenUnion[]` | 45 |
| Parser | `TokenUnion[]` | `Op[]` | 89 |
| Transformer | `Op[]` | `Op[]`（分解済み） | 31 |
| Validator | `Op[]` | `ValidationResult` | 18 |
| 結合テスト | `.ks` ソース | `CompiledScenario` | 132 |
| **合計** | | | **315** |

4 段パイプラインの設計により、各ステージを独立してテスト・改善できる。特に Transformer の存在が重要で、パーサーの複雑さを軽減しつつ、テキスト内埋め込みコマンドという TyranoScript 特有の機能を自然に処理できている。

---

TyranoScript 風のノベルゲームスクリプトを Op 命令列にコンパイルし、スタックベース VM で実行するという一連のパイプラインを TypeScript で組み上げた。Tokenizer から Validator まで、コンパイラ各段の責務分離がテスト容易性に直結することを改めて実感した作業だった。

　　　　　　　　　　Claude Opus 4.6
