---
title: ".ksc インタプリタを TypeScript で 7 フェーズに分けて実装した全記録"
emoji: "🎭"
type: "tech"
topics: ["claudecode", "typescript", "パーサー", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン kaedevn のスクリプト言語 `.ksc`（Kaede Script）のインタプリタを TypeScript で実装した。ゲーム用の独自言語ランタイムを一から設計・実装するのは簡単ではないが、7 つのフェーズに分けて段階的に機能を積み上げることで、193 テストがすべて通る堅牢なインタプリタが完成した。

この記事では Phase 1（Parser・セリフ処理）から Phase 7（デバッグ・統合テスト）まで、各フェーズの設計判断とコードの要所を振り返る。

## アーキテクチャ概要

インタプリタは以下のモジュール構成を取る。

```
src/
├── core/               # コアモジュール
│   ├── Interpreter.ts  # メインクラス（実行制御）
│   ├── Parser.ts       # 構文解析（行分類、ブロック検出）
│   ├── Evaluator.ts    # 式評価（再帰下降パーサー）
│   ├── Tokenizer.ts    # 字句解析（トークン分解）
│   └── GameState.ts    # 状態管理（変数、スタック）
├── engine/
│   └── IEngineAPI.ts   # エンジン抽象インターフェース
├── debug/
│   ├── Debugger.ts     # デバッグ機能
│   └── ErrorHandler.ts # エラー処理ユーティリティ
├── types/
│   ├── LineType.ts     # 行種別 enum
│   ├── Token.ts        # トークン型
│   ├── CallFrame.ts    # コールフレーム型
│   ├── Choice.ts       # 選択肢ノード型
│   └── Error.ts        # エラー型
└── index.ts            # 公開 API エクスポート
```

依存関係の方向に注目してほしい。

```
Interpreter
├── Parser           （行分類、構造検出）
├── Evaluator        （式評価、代入実行）
│   └── Tokenizer    （字句解析）
├── GameState        （状態管理）
├── IEngineAPI       （プラットフォーム操作）
├── Debugger         （デバッグ機能）
└── ErrorHandler     （エラー処理）

外部依存: なし（devDependencies のみ）
```

ランタイム依存ゼロという点が設計上のこだわりだ。ブラウザでも Node.js でも、将来的には Nintendo Switch の C++ ランタイムからも呼び出せるようにしている。

## Phase 1: Parser とセリフ処理

最初に取り組んだのは「行を読んで種類を判別する」という最も基本的な処理だ。

```typescript
export class Parser {
  classifyLine(line: string): LineType {
    if (line === "") {
      return LineType.Empty;
    }
    const firstChar = line[0];
    if (firstChar === "#") {
      return line.length === 1 ? LineType.DialogueEnd : LineType.DialogueStart;
    }
    if (firstChar === "*") {
      return LineType.Label;
    }
    if (line.startsWith("//")) {
      return LineType.Comment;
    }
    return LineType.Expression;
  }
}
```

`.ksc` では `#キャラ名` でセリフブロックを開始し、単独の `#` で閉じるという構文を採用している。この設計により、複数行にわたるセリフを自然に記述できる。

```
#hero
こんにちは、世界。
今日はいい天気だね。
#
```

Parser は行の分類だけを担い、状態を持たない。ステートレスな設計により、テストが書きやすく保守性も高い。

## Phase 2: ラベルとジャンプ

ビジュアルノベルの核心はシナリオの分岐だ。Phase 2 ではラベルマップの構築と `jump()` / `call()` / `ret()` を実装した。

```typescript
// スクリプト全体をスキャンしてラベルマップを構築
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

ラベルは `*ラベル名` の形式で定義し、実行前に全行をスキャンしてインデックスを作る。これにより `jump("オープニング")` が O(1) で解決できる。

`call()` はコールスタックにフレームを積み、`ret()` で呼び出し元に戻る仕組みだ。

```typescript
private executeCall(label: string): void {
  const lineNum = this.state.labelMap.get(label);
  if (lineNum === undefined) {
    throw new Error(`[KNF Error] 未定義のラベル: ${label}`);
  }
  this.state.pushFrame({
    returnPc: this.pc + 1,
    scopeDepth: this.state.localScopes.length,
    kind: "label",
    source: { line: this.pc, name: `call(${label})` },
  });
  this.pc = lineNum + 1;
}
```

## Phase 3: 式評価器（Evaluator）

Phase 3 では再帰下降パーサーによる式評価器を実装した。演算子の優先順位を正しく扱うため、以下の階層構造を採用している。

```
parseExpression()
└── parseLogicOr()        // ||
    └── parseLogicAnd()   // &&
        └── parseEquality()    // == !=
            └── parseComparison()  // > >= < <=
                └── parseAddition()    // + -
                    └── parseMultiplication()  // * / %
                        └── parseUnary()   // ! -
                            └── parsePrimary()  // リテラル, 変数, ()
```

各レベルの実装はパターンが統一されている。

```typescript
private async parseAddition(state: GameState): Promise<unknown> {
  let left = await this.parseMultiplication(state);

  while (this.match("+", "-")) {
    const operator = this.current().value;
    this.advance();
    const right = await this.parseMultiplication(state);

    if (operator === "+") {
      if (typeof left === "string" || typeof right === "string") {
        left = String(left) + String(right);
      } else {
        left = (left as number) + (right as number);
      }
    } else {
      left = (left as number) - (right as number);
    }
  }
  return left;
}
```

`+` 演算子の文字列結合対応のように、動的型付け言語としての型強制ルールもここで実装している。

## Phase 4: 制御構文（if / choice）

Phase 4 では `if` / `else if` / `else` と `choice` 構文を実装した。if 文の処理は複雑で、ブレース `{}` によるブロック管理と else チェーンの適切なスキップが必要になる。

```typescript
private async handleIf(line: string): Promise<void> {
  const conditionMatch = line.match(/if\s*\((.+)\)\s*\{/);
  const condition = conditionMatch[1];
  const result = await this.evaluator.evaluateCondition(condition, this.state);

  if (result) {
    this.pc++;
    const blockEndPc = await this.executeBlock();
    if (blockEndPc !== -1) {
      this.skipElseChain();  // 残りの else if/else をスキップ
    }
  } else {
    const blockEnd = this.parser.findBlockEnd(this.lines, this.pc);
    this.pc = blockEnd;
    await this.handleElseChain();  // else if/else を評価
  }
}
```

`choice` 構文はノベルゲーム特有の機能で、条件付き選択肢のフィルタリングにも対応している。

```
choice {
  "勇敢に戦う" {
    affection += 2
    jump("バトル")
  }
  "逃げる" if (escape_count < 3) {
    escape_count += 1
    jump("逃走")
  }
}
```

## Phase 5: 関数とサブルーチン

Phase 5 では `def`（戻り値あり）と `sub`（戻り値なし）の 2 種類のユーザー定義関数を実装した。

```typescript
private async executeUserFunction(name: string, args: unknown[]): Promise<unknown> {
  const funcDef = this.state.functions.get(name) || this.state.subroutines.get(name);

  // 再帰深度チェック (上限16)
  const currentDepth = this.state.callStack.filter(
    (f) => f.kind === "function" || f.kind === "subroutine"
  ).length;
  if (currentDepth >= 16) {
    throw new Error(`[KNF Error] 再帰呼び出しの深度が上限（16）を超えました`);
  }

  // ローカルスコープをプッシュ
  this.state.pushScope();

  // 引数を束縛
  for (let i = 0; i < funcDef.params.length; i++) {
    this.state.setLocalVar(funcDef.params[i], args[i]);
  }

  // 関数本体を実行
  this.pc = funcDef.bodyStart;
  let returnValue: unknown = undefined;
  // ... 実行ループ ...

  this.state.popFrame();
  this.state.popScope();
  this.pc = returnPc;

  return returnValue;
}
```

再帰深度を 16 に制限したのは、ノベルゲームのスクリプトで深い再帰が必要になるケースはまずないためだ。安全弁として機能する。

## Phase 6: 文字列補間

セリフブロック内で `{式}` 記法による文字列補間を実装した。

```typescript
async interpolate(text: string, state: GameState): Promise<string> {
  const pattern = /\{([^}]+)\}/g;
  let result = text;
  const matches: Array<{ expr: string; fullMatch: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({ expr: match[1], fullMatch: match[0] });
  }

  // 後ろから置換（インデックスがずれないように）
  for (let i = matches.length - 1; i >= 0; i--) {
    const value = await this.evaluate(matches[i].expr, state);
    const replacement = value == null ? "" : String(value);
    result = result.replace(matches[i].fullMatch, replacement);
  }
  return result;
}
```

「後ろから置換」のテクニックは、前から置換すると文字列長が変わってインデックスがずれる問題を回避している。

## Phase 7: エラーハンドリングとデバッグ

最終フェーズでは、開発者体験（DX）を大幅に向上させる機能を実装した。

### Levenshtein 距離による提案

未定義変数や未定義関数のエラー時に、類似した名前を提案する。

```typescript
static suggestSimilarVariables(varName: string, availableVars: string[]): string[] {
  const suggestions: Array<{ name: string; distance: number }> = [];
  for (const available of availableVars) {
    const distance = levenshteinDistance(varName, available);
    if (distance <= 3 && distance <= varName.length / 2) {
      suggestions.push({ name: available, distance });
    }
  }
  suggestions.sort((a, b) => a.distance - b.distance);
  return suggestions.slice(0, 3).map((s) => s.name);
}
```

エラーメッセージの例:

```
[KNF ReferenceError] Line 15: 未定義の変数: afection
  at <main> (line 15)
  at def calculate (line 3)

  13: affection += 2
  14: // 条件チェック
→ 15: if (afection >= 10) {

ヒント: 'affection' ではありませんか？
```

### デバッガー

ブレークポイント、変数ウォッチ、トレースログを備えたデバッガーも Phase 7 で追加した。

```typescript
const interp = new Interpreter(engine, { debug: true });
const dbg = interp.getDebugger();

// 変数ウォッチ
dbg.watchVariable("affection");

// ブレークポイント（条件付き）
dbg.addBreakpoint(15, "affection >= 10");

// トレースログ有効化
dbg.enableTrace();
```

## 実行パイプライン全体像

最終的な実行パイプラインは以下のようになった。

```
.ksc テキスト
    |
    v
Interpreter.run(script)
  1. テキスト → 行分割
  2. ラベルマップ構築 (Parser.buildLabelMap)
  3. 関数/サブルーチン定義インデックス化
  4. メインループ開始

  while (running && pc < lines.length)
    └── step()
          ├── ブレークポイントチェック (Phase 7)
          ├── 空行/コメント → スキップ
          ├── def/sub定義 → ブロック末尾までスキップ
          └── Parser.classifyLine(line) で分岐
               ├── DialogueStart → handleDialogue()
               ├── Label → スキップ
               └── Expression → handleExpression()
                     ├── return / if / choice → 専用ハンドラ
                     ├── 代入文 → Evaluator.executeAssignment()
                     ├── 関数呼び出し → executeBuiltin() or executeUserFunction()
                     └── その他 → Evaluator.evaluate()
```

## テスト結果

最終的に 193 テストが全パス。テストは以下のカテゴリに分かれている。

| カテゴリ | テスト数 | 対象 |
|---|---|---|
| Parser | 24 | 行分類、ラベルマップ |
| Evaluator | 48 | 算術、比較、論理演算、文字列補間 |
| Interpreter 基本 | 35 | セリフ、ジャンプ、call/ret |
| 制御構文 | 28 | if/else, choice, ネスト |
| 関数 | 22 | def/sub, 引数, 再帰 |
| デバッグ | 18 | ブレークポイント、ウォッチ、トレース |
| エラーハンドリング | 12 | 提案、スタックトレース、コンテキスト |
| 統合テスト | 6 | 完全なシナリオ実行 |

## 振り返り

7 フェーズの段階的実装が功を奏した。Phase 1 のテストが全部通ってから Phase 2 に進む、という規律を守ったことで、後のフェーズで前のフェーズのバグに悩まされることがほとんどなかった。

特に Phase 7 のエラーハンドリングは DX に直結する。Levenshtein 距離による提案やスタックトレースの表示は、スクリプト作者（= 非エンジニアの可能性もある）への配慮として重要だった。

---

.ksc インタプリタという、ニッチだが実装の奥が深いテーマに 7 フェーズで挑んだ記録をまとめた。再帰下降パーサー、スコープ管理、デバッガーと、言語処理系の基本が一通り詰まった実装になった。ゲームエンジン開発という文脈で、コンパイラ理論の知識が活きる場面は意外と多い。

　　　　　　　　　　Claude Opus 4.6
