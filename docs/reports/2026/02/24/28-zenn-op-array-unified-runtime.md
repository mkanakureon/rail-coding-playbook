---
title: "Op[] 統一ランタイム設計 — ScriptCommand 形式を完全廃止した理由"
emoji: "🔄"
type: "tech"
topics: ["claudecode", "typescript", "設計", "リファクタリング"]
published: false
---

## はじめに

ビジュアルノベルエンジンを開発していると、「スクリプトをどのような中間表現で実行するか」という設計判断に直面します。当初、私たちのエンジンには 2 つの異なるランタイム形式が共存していました。

1. **KSC インタプリタ**: `.ksc` スクリプトを行単位で逐次解釈し、`IEngineAPI` を直接呼び出す
2. **コンパイラ出力**: `.ks` ファイルをコンパイルし、`ScriptCommand[]` 形式の JSON を生成する

この 2 系統が並立していたことで、バグの温床になり、エンジン側の実装も二重に必要でした。本記事では、この問題を `Op[]` 統一ランタイムで解決した設計を解説します。

## 旧体制: 2 つのランタイム形式

### KSC インタプリタ

KSC（Kaede Script）は `.ksc` 拡張子のスクリプト言語です。行単位で解釈され、Parser が行を分類し、Evaluator が式を評価し、結果を `IEngineAPI` に渡します。

```
// .ksc スクリプト例
*opening
bg("forest_evening")
#hero
こんにちは、世界。
#
waitclick()
```

インタプリタの実行フローは以下の通りです。

```
.ksc テキスト
  → Parser.classifyLine()  行分類
  → Evaluator.evaluate()   式評価
  → IEngineAPI.setBg() etc. エンジン呼び出し
```

```typescript
// Interpreter.ts（抜粋）
private async executeBuiltin(name: string, args: unknown[]): Promise<boolean> {
  switch (name) {
    case "bg":
      await this.engine.setBg(String(args[0]), args[1] as string | undefined);
      return true;
    case "ch":
      await this.engine.showChar(
        String(args[0]), String(args[1]),
        args[2] as string | undefined,
        args[3] !== undefined ? Number(args[3]) : undefined
      );
      return true;
    case "bgm":
      this.engine.playBgm(String(args[0]), ...);
      return true;
    // ... 17 個の組み込みコマンド
  }
}
```

### コンパイラ出力（旧 ScriptCommand 形式）

一方、`.ks`（TyranoScript 風）ファイルからコンパイルした結果は、JSON の命令配列として出力されていました。この形式はインタプリタとは全く異なるデータ構造で、実行エンジンも別物が必要でした。

## 問題点

| 問題 | 影響 |
|------|------|
| エンジン実装が 2 つ必要 | `IEngineAPI` と `IOpHandler` の 2 インターフェースを両方実装する必要がある |
| バグ修正が 2 箇所 | 同じ機能のバグを 2 つのランタイムで別々に修正 |
| テストが 2 倍 | 同じシナリオを 2 つの形式でテスト |
| セーブ/ロードが非統一 | 各ランタイムで独自のセーブ形式 |
| Switch 移植時のリスク | 2 つのランタイムを C++ に移植する作業量 |

## Op[]: 統一中間表現の設計

### 設計原則

Op 配列は以下の原則で設計しました。

1. **フラットな命令列**: ネストなし。プログラムカウンタ（PC）が 0 から順に進む
2. **各 Op は 1 つのアクション**: `TEXT_APPEND` はテキスト追加のみ、`BG_SET` は背景設定のみ
3. **ジャンプは PC 値で表現**: ラベルではなく配列インデックスを直接指定
4. **型安全**: TypeScript の discriminated union で全 Op を網羅

### Op 型定義

```typescript
// packages/core/src/types/Op.ts
export type Op =
  // テキスト
  | { op: "TEXT_APPEND"; who?: string; text: string }
  | { op: "TEXT_NL" }

  // 待機
  | { op: "WAIT_CLICK" }
  | { op: "PAGE" }
  | { op: "WAIT_MS"; ms: number }

  // 背景
  | { op: "BG_SET"; id: string; fadeMs?: number }
  | { op: "BG_CLEAR"; fadeMs?: number }

  // キャラ
  | { op: "CH_SET"; name: string; pose: string;
      pos: "left" | "center" | "right"; fadeMs?: number }
  | { op: "CH_HIDE"; name: string; fadeMs?: number }
  | { op: "CH_CLEAR"; fadeMs?: number }
  | { op: "CH_ANIM"; name: string; src: string; frames: number;
      fps: number; pos: "left" | "center" | "right"; loop?: boolean }

  // 音声
  | { op: "BGM_PLAY"; id: string; vol?: number; fadeMs?: number }
  | { op: "BGM_STOP"; fadeMs?: number }
  | { op: "SE_PLAY"; id: string; vol?: number }
  | { op: "VOICE_PLAY"; id: string }
  | { op: "WAIT_VOICE_END" }

  // 変数
  | { op: "VAR_SET"; name: string; value: number }
  | { op: "VAR_ADD"; name: string; value: number }
  | { op: "VAR_SUB"; name: string; value: number }

  // 選択肢
  | { op: "CHOICE"; options: Array<{ label: string; jump: number }> }

  // ジャンプ・分岐
  | { op: "JUMP"; pc: number }
  | { op: "JUMP_IF"; condition: string; pc: number }

  // バトル
  | { op: "BATTLE_START"; troopId: string; onWin: string; onLose: string }

  // タイムライン
  | { op: "TIMELINE_PLAY"; timelineId: string };
```

重要な設計判断がいくつかあります。

### 判断 1: JUMP は配列インデックス

ラベル名ではなく PC 値（配列インデックス）で指定します。コンパイル時にラベルを解決するため、実行時のラベルルックアップが不要になります。

```typescript
// コンパイル結果のイメージ
[
  { op: "BG_SET", id: "forest" },          // pc=0
  { op: "TEXT_APPEND", who: "hero", text: "こんにちは" },  // pc=1
  { op: "WAIT_CLICK" },                     // pc=2
  { op: "CHOICE", options: [
    { label: "はい", jump: 4 },
    { label: "いいえ", jump: 7 },
  ]},                                        // pc=3
  { op: "TEXT_APPEND", text: "よかった" },   // pc=4 ("はい"の分岐先)
  { op: "WAIT_CLICK" },                     // pc=5
  { op: "JUMP", pc: 9 },                    // pc=6 (合流点へ)
  { op: "TEXT_APPEND", text: "残念" },       // pc=7 ("いいえ"の分岐先)
  { op: "WAIT_CLICK" },                     // pc=8
  // pc=9: 合流点                            // pc=9
]
```

### 判断 2: CHOICE の jump は PC 値

選択肢は `{ label: string; jump: number }` の配列です。ユーザーが選択すると、`OpRunner` は `jump` 値を返して PC を直接変更します。

```typescript
// OpRunner.ts
case "CHOICE": {
  const jumpPc = await h.choice(op.options);
  this.pc = jumpPc;
  break;
}
```

### 判断 3: JUMP_IF の条件式は文字列

```typescript
{ op: "JUMP_IF"; condition: string; pc: number }
```

条件式を文字列として保持するのは妥協点です。理想的にはコンパイル時に条件式もバイトコード化すべきですが、ビジュアルノベルの条件分岐はシンプル（`affection >= 5` 程度）なので、実行時に文字列パースしても性能問題は発生しません。

## OpRunner: 統一実行エンジン

`OpRunner` は `Op[]` を順番に実行する単純な VM です。

```typescript
// packages/core/src/engine/OpRunner.ts
export class OpRunner {
  private ops: Op[] = [];
  private pc = 0;
  private vars: Record<string, unknown> = {};
  private running = false;

  async start(scenario: CompiledScenario, handler: IOpHandler): Promise<void> {
    this.ops = scenario.ops;
    this.pc = 0;
    this.running = true;
    await this.run();
  }

  private async run(): Promise<void> {
    while (this.running && this.pc < this.ops.length) {
      await this.execute(this.ops[this.pc]);
    }
  }

  private async execute(op: Op): Promise<void> {
    switch (op.op) {
      case "TEXT_APPEND":
        this.read[this.pc] = true;
        await h.textAppend(op.who, op.text);
        this.pc++;
        break;
      case "BG_SET":
        await h.bgSet(op.id, op.fadeMs);
        this.pc++;
        break;
      case "JUMP":
        this.pc = op.pc;
        break;
      case "JUMP_IF": {
        const conditionMet = this.evaluateCondition(op.condition);
        if (conditionMet) this.pc = op.pc;
        else this.pc++;
        break;
      }
      // ... 他の Op
    }
  }
}
```

### セーブ/ロード

OpRunner の状態は非常にシンプルです。

```typescript
getState(): {
  scenarioId: string;
  pc: number;
  vars: Record<string, unknown>;
  read: Record<number, boolean>;
}
```

`pc`（現在位置）と `vars`（変数マップ）と `read`（既読フラグ）だけで完全に再現できます。これは `resume()` メソッドで復元されます。

```typescript
async resume(
  scenario: CompiledScenario,
  handler: IOpHandler,
  pc: number,
  vars: Record<string, unknown>,
  read: Record<number, boolean>,
): Promise<void> {
  this.pc = pc;
  this.vars = { ...vars };
  this.read = { ...read };
  this.running = true;
  await this.run();
}
```

## コンパイラ: .ks → Op[] の変換パイプライン

コンパイラは 4 段階のパイプラインで `.ks` を `Op[]` に変換します。

```typescript
// packages/compiler/src/compiler/Compiler.ts
export class Compiler {
  public compile(source: string, options: CompilerOptions = {}): CompiledScenario {
    // 1. Tokenize: テキスト → トークン列
    const tokens = this.tokenizer.tokenize(source);

    // 2. Parse: トークン列 → Op[]（初期変換）
    let ops = this.parser.parse(tokens);

    // 3. Transform: 埋め込みコマンドの分解
    ops = this.transformer.transform(ops);

    // 4. Finalize: 末尾 @p の挿入
    ops = this.finalizer.finalize(ops);

    // 5. Validate: ID 形式チェック
    if (validate) this.validator.validate(ops);

    return { id: scenarioId, ops };
  }
}
```

各段階の責務は以下の通りです。

| 段階 | クラス | 責務 |
|------|--------|------|
| Tokenize | `Tokenizer` | テキストをトークンに分割。コマンド行、テキスト行、ラベルを識別 |
| Parse | `Parser` | トークンを Op に変換。ラベルの PC 解決もここで行う |
| Transform | `Transformer` | テキスト行内の埋め込みコマンドを分解。`text@l` → `TEXT_APPEND` + `TEXT_NL` |
| Finalize | `Finalizer` | テキスト末尾の自動 `WAIT_CLICK` 挿入 |
| Validate | `Validator` | ID の形式チェック、参照整合性の検証 |

## KSC インタプリタとの共存

旧 KSC インタプリタは現在も存在します。これは `.ksc` という独自スクリプト言語を実行するもので、以下の場面で使われます。

- エディタの「KSC ブロック」: ユーザーが直接 `.ksc` を書いてテスト
- デバッグ: 変数ウォッチ、ブレークポイント、ステップ実行

ただし、プロダクション実行は Op[] 経由で行います。

```
[開発時]
.ksc → KSC Interpreter → IEngineAPI → 描画

[プロダクション]
.ks → Compiler → Op[] → OpRunner → IOpHandler → 描画
```

将来的には `.ksc` もコンパイラ経由で `Op[]` に変換し、KSC インタプリタを廃止する計画です。

## CompiledScenario: パッケージの境界

`Op` と `CompiledScenario` は `@kaedevn/core` パッケージで定義されています。

```typescript
// packages/core/src/types/Op.ts
export interface CompiledScenario {
  id: string;
  ops: Op[];
}
```

コンパイラ (`@kaedevn/compiler`) は `Op[]` を生成し、ランタイム (`@kaedevn/core`) は `Op[]` を実行します。`CompiledScenario` はこの 2 つのパッケージの契約（contract）です。

```
@kaedevn/compiler       @kaedevn/core
  Compiler.compile()  →   CompiledScenario  →  OpRunner.start()
  出力: Op[]              中間表現            入力: Op[]
```

## 移植性: Switch への道

Op[] 統一ランタイムの最大の利点は移植性です。

1. **Op 型は JSON シリアライズ可能**: C++ でも同じ構造体で表現できる
2. **OpRunner は単純な switch-case**: C++ への移植が容易
3. **IOpHandler は薄いインターフェース**: プラットフォーム固有コードはここだけ

```cpp
// C++ 移植のイメージ
void OpRunner::execute(const Op& op) {
  switch (op.type) {
    case OpType::TEXT_APPEND:
      handler->textAppend(op.who, op.text);
      pc++;
      break;
    case OpType::BG_SET:
      handler->bgSet(op.id, op.fadeMs);
      pc++;
      break;
    case OpType::JUMP:
      pc = op.pc;
      break;
    // ...
  }
}
```

## まとめ

| 旧体制 | 新体制（Op[] 統一） |
|--------|-------------------|
| 2 つのランタイム形式 | Op[] のみ |
| 2 つのエンジンインターフェース | IOpHandler のみ |
| ラベル名でジャンプ | PC 値（配列インデックス）でジャンプ |
| セーブ形式が非統一 | pc + vars + read で完結 |
| Switch 移植で 2 系統の作業 | OpRunner の 1 系統のみ |

Op[] への統一は、コードベースの複雑さを大幅に削減し、移植性を確保し、セーブ/ロードをシンプルにしました。ビジュアルノベルエンジンに限らず、「DSL → 中間表現 → VM」というパイプラインは、クロスプラットフォーム開発において強力なパターンです。

---

旧 KSC インタプリタと旧 ScriptCommand 形式が並立していた時期は、バグ修正のたびに 2 箇所を直す必要がありました。Op[] 統一ランタイムへの移行は、コンパイラとインタプリタの両方を深く理解したうえで、「何を残し、何を捨てるか」を判断する必要がありました。discriminated union と switch-case の素朴な組み合わせが最も移植性の高い設計になるという結論は、ある意味で原点回帰だったと思います。

　　　　　　　　　　Claude Opus 4.6
