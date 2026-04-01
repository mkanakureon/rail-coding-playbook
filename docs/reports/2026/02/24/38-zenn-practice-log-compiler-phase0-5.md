---
title: "実践ログ — KSC コンパイラ Phase 0→5 を連続実装"
emoji: "🔧"
type: "idea"
topics: ["claudecode", "typescript", "コンパイラ"]
published: false
---

## はじめに

kaedevn ビジュアルノベルエンジンでは、シナリオスクリプトを **KSC (Kaede Script)** という独自言語で書く。この KSC を実行可能なバイトコードにコンパイルするために、Phase 0 から Phase 5 まで、6 段階のコンパイラパイプラインを Claude Code と一緒に連続実装した。

```
KSC ソース → [Lexer] → Tokens → [Parser] → AST
         → [TypeChecker] → 型検証済み AST
         → [IR Emitter] → IR Module
         → [VM] → 実行
         → [WebOpHandler] → ゲームエンジン連携
```

各 Phase の実装内容、テスト結果、セッションの流れを時系列で記録する。

## パイプラインの全体像

### コンパイラのディレクトリ構造

```
packages/compiler/src/
├── tokenizer/
│   ├── Tokenizer.ts       # レキサー
│   └── lineClassifier.ts  # 行分類
├── parser/
│   ├── Parser.ts           # パーサー
│   ├── parseCommand.ts     # コマンド解析
│   ├── parseText.ts        # テキスト解析
│   └── parseOptionalArgs.ts
├── transformer/
│   └── Transformer.ts      # 埋め込みコマンド分解
├── validator/
│   └── Validator.ts        # ID形式チェック
├── finalizer/
│   └── Finalizer.ts        # 末尾処理
├── compiler/
│   └── Compiler.ts         # パイプライン統合
├── types/
│   ├── Token.ts
│   ├── AST.ts
│   ├── CompilerError.ts
│   └── CompilerOptions.ts
├── cli/
│   ├── cli.ts
│   └── commands/
│       ├── compile.ts
│       └── validate.ts
└── index.ts
```

7 つのサブディレクトリ、18 ファイル。

## Phase 0-1: レキサー + パーサー + 型定義

### コミット

```
19a2d53 feat: KSCコンパイラ Phase 0-1 実装（レキサー・パーサー・型定義）
383 files changed, 6,570 insertions(+)
```

383 ファイルという数字に驚くが、大部分はアセット PNG だ。コンパイラのコード部分は数百行。

### レキサー (Tokenizer)

レキサーは KSC のソースコードを行単位で分類する。

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
      // ... VAR_SET, CHOICE_START, IF_START, TEXT
    }

    return tokens;
  }
}
```

`classifyLine()` が行の種類を判定する。KSC は行指向の言語なので、行単位の分類が自然だ。

トークンの種類:

| トークン | 例 |
|----------|------|
| `COMMAND` | `bg("school_day")` |
| `VAR_SET` | `score = 100` |
| `CHOICE_START` | `choice {` |
| `CHOICE_OPTION` | `"選択肢テキスト" { ... }` |
| `IF_START` | `if (score >= 80) {` |
| `IF_ELSE` | `} else {` |
| `TEXT` | 通常のテキスト行 |
| `COMMENT` | `// コメント` |

### パーサー (Parser)

パーサーはトークン列を Op 命令列に変換する。

```typescript
export class Parser {
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
      } else if (token.type === 'CHOICE_START') {
        const choiceOps = this.parseChoice(ops.length);
        ops.push(...choiceOps);
      } else if (token.type === 'IF_START') {
        const ifOps = this.parseIf(ops.length);
        ops.push(...ifOps);
      }
      // ...
    }

    return ops;
  }
}
```

ここで重要なのは `parseChoice` と `parseIf` の再帰的な構造だ。選択肢の中に条件分岐があり、条件分岐の中に選択肢がある——こういうネストに対応するために、再帰下降パーサーを採用した。

### Phase 0-1 のテスト結果

```
テスト110件全合格（レキサー45 + パーサー65）
```

コミットメッセージの感想がいい。

```
---
コンパイラをゼロから書くのは久しぶりで楽しかった。
レキサーは一発で全テスト通ったのに、パーサーで
「{がブロック文になる問題」に引っかかったのはJS/TSあるあるで、
ちょっとニヤッとした。
```

`{` がオブジェクトリテラルなのかブロック文なのか、JS/TS では常に問題になる。KSC でも同じ問題が起きた。

## Phase 1.5-2: パーサー補完 + 型チェッカー

### コミット

```
b1c427c feat: KSCコンパイラ Phase 1.5-2 実装（パーサー補完・型チェッカー）
13 files changed, 1,719 insertions(+)
```

### Phase 1.5: パーサーの補完

Phase 0-1 のパーサーで足りなかった部分を補完した。

- `await` / `continue` / `%=` トークンの追加
- トレーリングカンマ対応（`[1, 2, 3,]` の最後のカンマ）
- `sourceMap` 型の改善
- `null` / `undefined` 型アノテーション対応

### Phase 2: 型チェッカー

2 パスの型チェッカーを新規実装した。

**1 パス目**: 関数宣言を収集してスコープに登録
**2 パス目**: 式の型推論と文の型検証

```typescript
// KSC の型システム
type KscType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'void'
  | 'null'
  | 'undefined'
  | 'any'
  | { kind: 'array'; element: KscType }
  | { kind: 'function'; params: KscType[]; ret: KscType };
```

IEngineAPI のビルトイン関数もシグネチャとして登録してある。`bg("school_day")` を書いたとき、引数が string かどうかを型チェッカーが検証する。

### テスト結果

```
172テスト通過（式16種・文14種の型推論・検証）
```

式 16 種:

- 数値リテラル、文字列リテラル、ブーリアンリテラル
- 変数参照、二項演算、比較演算、論理演算
- 単項演算、関数呼び出し、配列リテラル
- 添字アクセス、メンバーアクセス、三項演算
- テンプレートリテラル、型アサーション、括弧式

文 14 種:

- 変数宣言、代入、関数定義
- if/else、while、for、switch/case
- return、break、continue
- ブロック文、式文、空文、ダイアログブロック

## Phase 2.5-3: IR 型補完 + IR エミッター

### コミット

```
02048b4 feat: KSCコンパイラ Phase 2.5-3 実装（IR型補完・IRエミッター）
7 files changed, 1,528 insertions(+)
```

### Phase 2.5: IR 型の補完

- `AWAIT` / `SET_INDEX` opcode 追加
- 未使用の `Ternary` トークン削除
- 未終端ブロックコメントのエラー対応

### Phase 3: IR エミッター

AST を IR (Intermediate Representation) に変換するエミッターを実装した。

```
AST → IRModule
```

2 パスアルゴリズム:

1. **関数定義を収集**: `def` と `sub` を先に登録
2. **コード生成**: 各文・式を IR 命令列に変換

```
定数プール重複排除: 同じ文字列・数値は1つだけ
15式 + 15文のコード生成
HOST_CALL / DialogueBlock / switch / break / continue 対応
```

定数プールの重複排除は地味だが重要だ。`"hero"` という文字列がスクリプト内に 100 回出ても、定数プールには 1 つしか格納しない。

### テスト結果

```
全244テスト通過
```

Phase 0-1 の 110 + Phase 1.5-2 の 62 + Phase 2.5-3 の 72 = 244。

## Phase 4: スタックベース VM

### コミット

```
6d61053 feat: KSCコンパイラ Phase 4 — Stack-based VM 実装
5 files changed, 1,410 insertions(+)
```

ここが一番大きい。1,410 行の追加で、VM（仮想マシン）を実装した。

### VM の設計

スタックベースの VM。JVM や Python VM と同じ方式だ。

```
PUSH 42        # スタックに 42 を積む
PUSH 10        # スタックに 10 を積む
ADD            # スタックから 2 つ取り出して足す → 52 がスタックに積まれる
STORE score    # スタックから取り出して変数 score に格納
```

カバー範囲:

- 算術演算（`+`, `-`, `*`, `/`, `%`）
- 比較演算（`==`, `!=`, `<`, `>`, `<=`, `>=`）
- 論理演算（`&&`, `||`, `!`）
- 制御フロー（`if`, `while`, `for`, `switch`, `break`, `continue`）
- オブジェクト / 配列操作
- HOST_CALL（ゲームエンジン API 呼び出し）
- AWAIT（非同期処理）
- Save / Load

### IRFunction に paramNames を追加

```
IRFunction に paramNames を追加し、CALL 時のパラメータ束縛に対応
```

関数呼び出し時に、パラメータ名を使ってスタックフレームにバインドする。`calc_score(30, 10)` と呼ぶと、`base = 30`, `bonus = 10` にバインドされる。

### テスト結果

```
69テスト追加、全315テスト通過
```

315 テスト。コンパイラのテストとしては十分な数だ。

## Phase 5: VM → WebOpHandler 統合

### コミット

```
ea3e4d3 feat: KSCコンパイラ Phase 5 — VM→WebOpHandler 統合
8 files changed, 616 insertions(+)
```

最終 Phase。VM をゲームエンジンに接続する。

### KscHostAdapter

```
KSC VM の HOST_CALL を IOpHandler に橋渡し
```

VM が `HOST_CALL bg "school_day"` を実行すると、KscHostAdapter がそれを `IOpHandler.handleOp({ op: 'BG_SET', id: 'school_day' })` に変換する。

### KscRunner

```
AWAIT/resume ループで非同期処理を駆動
```

ゲームエンジンの操作（背景表示、セリフ表示など）は非同期だ。VM が `AWAIT` に到達したら一時停止し、ゲームエンジンの処理が完了したら `resume` で再開する。

### テスト結果

```
アダプターテスト22件全通過、既存315件も維持
全337テスト通過
```

## タイムラインまとめ

| Phase | 内容 | ファイル変更 | 行追加 | テスト |
|-------|------|-------------|--------|--------|
| 0-1 | レキサー + パーサー + 型定義 | 383 | 6,570 | 110 |
| 1.5-2 | パーサー補完 + 型チェッカー | 13 | 1,719 | 172 |
| 2.5-3 | IR 型補完 + IR エミッター | 7 | 1,528 | 244 |
| 4 | スタックベース VM | 5 | 1,410 | 315 |
| 5 | VM → WebOpHandler 統合 | 8 | 616 | 337 |

Phase 0-1 の 383 ファイルはアセット PNG を含むので例外的だが、コンパイラ部分だけ見ると、各 Phase は 600-1,700 行の追加。テストは累計 337 件。

## コンパイラパイプラインの実装: Compiler クラス

最終的に、すべてを統合する Compiler クラスはこうなった。

```typescript
export class Compiler {
  private tokenizer: Tokenizer;
  private parser: Parser;
  private transformer: Transformer;
  private finalizer: Finalizer;
  private validator: Validator;

  constructor() {
    this.tokenizer = new Tokenizer();
    this.parser = new Parser();
    this.transformer = new Transformer();
    this.finalizer = new Finalizer();
    this.validator = new Validator();
  }

  public compile(source: string, options: CompilerOptions = {}): CompiledScenario {
    // 1. Tokenize
    const tokens = this.tokenizer.tokenize(source);

    // 2. Parse
    let ops = this.parser.parse(tokens);

    // 3. Transform (埋め込みコマンド分解)
    ops = this.transformer.transform(ops);

    // 4. Finalize (末尾処理)
    ops = this.finalizer.finalize(ops);

    // 5. Validate (ID形式チェック)
    if (options.validate !== false) {
      this.validator.validate(ops);
    }

    return { id: options.scenarioId || 'scenario', ops };
  }
}
```

50 行。各 Phase の責務が明確に分離されているおかげで、統合クラスはシンプルだ。

### Transformer: 埋め込みコマンド分解

```typescript
// テキスト内の @l/@p/@r を分解
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
}
```

KSC では `@l`（行送り待ち）、`@p`（ページ送り）、`@r`（改行）をテキスト内に埋め込める。Transformer がこれらを個別の Op に分解する。

### Validator: ID 形式チェック

```typescript
export class Validator {
  public validate(ops: Op[]): void {
    const errors: CompilerError[] = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      switch (op.op) {
        case 'BG_SET':
          this.validateId(op.id, 'background ID', `op[${i}]`, errors);
          break;
        case 'CH_SET':
          this.validateId(op.name, 'character name', `op[${i}]`, errors);
          this.validateId(op.pose, 'pose ID', `op[${i}]`, errors);
          break;
        // ...
      }
    }
    if (errors.length > 0) {
      throw new CompilationException(errors);
    }
  }
}
```

背景 ID やキャラクター名が空文字列でないか、先頭末尾にスペースがないか、改行文字が含まれていないかをチェックする。

## Claude Code との協働で学んだこと

### 1. Phase を細かく切る

「コンパイラを作って」ではなく「Phase 0-1 でレキサーとパーサーを作って」と指示する。各 Phase の終わりにテストを全通過させてから次に進む。

### 2. 型定義を先に決める

Token 型、AST 型、IR 型を Phase 0 で先に定義した。これがあるおかげで、Phase 1 以降の実装が高速だった。

### 3. テスト数を明示する

コミットメッセージに「110 テスト通過」「172 テスト通過」と書くことで、品質の推移が追跡できる。

### 4. 感想が実装の記録になる

```
「{がブロック文になる問題」に引っかかったのはJS/TSあるあるで、ちょっとニヤッとした
```

この一文から、実装中にどんな問題に遭遇したかがわかる。コードの diff だけでは見えない「過程」が記録される。

## まとめ

Phase 0 から Phase 5 まで、KSC コンパイラの全パイプラインを Claude Code と連続実装した。

- レキサー → パーサー → 型チェッカー → IR エミッター → VM → WebOpHandler 統合
- 累計 337 テスト
- 18 ソースファイル

コンパイラは「正解がある」タイプの問題だ。入力（KSC ソース）と出力（Op 命令列 / バイトコード）が明確に定義されている。だからこそ、AI との協働に向いている。Phase を切って、テストで品質を担保しながら進める。このスタイルがコンパイラ実装にはうまくハマった。

---

コンパイラを Phase 0 から 5 まで一気に書くのは、正直かなり楽しかった。レキサーが一発で全テスト通るのに、パーサーで `{` の解釈に引っかかるのは定番中の定番。型チェッカーで IEngineAPI のシグネチャを組み込むあたりから、「これは本当にゲームエンジン用のコンパイラなんだな」と実感が湧いてきた。

　　　　　　　　　　Claude Opus 4.6
