---
title: "ConsoleEngine + TestEngine — OSS 利用者向け IEngineAPI 実装 2 種"
emoji: "🧪"
type: "tech"
topics: ["claudecode", "typescript", "テスト", "OSS"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のインタプリタパッケージ（`@kaedevn/interpreter`）には、`IEngineAPI` というプラットフォーム抽象化インターフェースがある。Web ブラウザ上では PixiJS で実装し、Switch では専用の実装を作る想定だ。

OSS として公開するにあたり、ブラウザやゲーム機がなくてもスクリプトを動作確認できる実装が必要になった。そこで `ConsoleEngine`（コンソール出力）と `TestEngine`（状態管理テスト用）の 2 つのリファレンス実装を作った。

## IEngineAPI：プラットフォーム抽象化インターフェース

まず、2 つの実装が準拠するインターフェースを確認する。

```typescript
// packages/interpreter/src/engine/IEngineAPI.ts
export interface IEngineAPI {
  // セリフ
  showDialogue(speaker: string, lines: string[]): Promise<void>;

  // 背景
  setBg(name: string, effect?: string): Promise<void>;

  // キャラクター
  showChar(name: string, pose: string, position?: string,
    fadeMs?: number): Promise<void>;
  showCharAnim(name: string, pose: string, position: string): Promise<void>;
  hideChar(name: string, fadeMs?: number): Promise<void>;
  clearChars(fadeMs?: number): Promise<void>;
  moveChar(name: string, position: string, time: number): Promise<void>;

  // オーディオ
  playBgm(name: string, vol?: number, fadeMs?: number): void;
  stopBgm(): void;
  fadeBgm(time: number): Promise<void>;
  playSe(name: string, vol?: number): void;
  playVoice(name: string): void;

  // タイムライン
  playTimeline(name: string): Promise<void>;

  // バトル
  battleStart(troopId: string): Promise<'win' | 'lose'>;

  // UI
  showChoice(options: ChoiceOption[]): Promise<number>;
  waitForClick(): Promise<void>;
  wait(ms: number): Promise<void>;
}
```

セリフ、背景、キャラクター、オーディオ、タイムライン、バトル、UI の 7 カテゴリ、計 16 メソッド。すべてのプラットフォーム実装はこのインターフェースに従う。

## ConsoleEngine：コンソール出力実装

`ConsoleEngine` はすべてのエンジン操作を標準出力にテキストとして表示する。

```typescript
// packages/interpreter/src/engine/ConsoleEngine.ts
export interface ConsoleEngineOptions {
  /** 選択肢の自動選択インデックス（デフォルト: 0） */
  defaultChoice?: number;
  /** バトルの自動結果（デフォルト: "win"） */
  defaultBattleResult?: "win" | "lose";
  /** wait() を実際に待つか（デフォルト: false） */
  realTime?: boolean;
  /** 出力先（デフォルト: console.log） */
  output?: (message: string) => void;
}

export class ConsoleEngine implements IEngineAPI {
  private out: (message: string) => void;
  private defaultChoice: number;
  private defaultBattleResult: "win" | "lose";
  private realTime: boolean;

  constructor(options?: ConsoleEngineOptions) {
    this.out = options?.output ?? console.log;
    this.defaultChoice = options?.defaultChoice ?? 0;
    this.defaultBattleResult = options?.defaultBattleResult ?? "win";
    this.realTime = options?.realTime ?? false;
  }
}
```

### オプション設計

ConsoleEngine には 4 つのオプションがある。

| オプション | デフォルト | 用途 |
|-----------|----------|------|
| `defaultChoice` | `0` | 選択肢を自動的にどれを選ぶか |
| `defaultBattleResult` | `"win"` | バトルの結果を固定 |
| `realTime` | `false` | `wait()` で実際に待つか |
| `output` | `console.log` | 出力先の関数 |

`output` を差し替え可能にしたのは、テストやログファイル出力で使えるようにするためだ。

### 各メソッドの実装

セリフの表示。

```typescript
async showDialogue(speaker: string, lines: string[]): Promise<void> {
  const name = speaker || "ナレーション";
  const text = lines.map((l) => `  ${l}`).join("\n");
  this.out(`\n【${name}】\n${text}`);
}
```

出力例:

```
【花子】
  おはようございます。
  今日もいい天気ですね。
```

キャラクターの表示。

```typescript
async showChar(
  name: string, pose: string, position?: string, fadeMs?: number,
): Promise<void> {
  const parts = [name, pose];
  if (position) parts.push(position);
  if (fadeMs !== undefined) parts.push(`${fadeMs}ms`);
  this.out(`[キャラ表示] ${parts.join(" ")}`);
}
```

出力例:

```
[キャラ表示] hanako smile center 500ms
```

選択肢の表示。

```typescript
async showChoice(options: ChoiceOption[]): Promise<number> {
  const lines = options.map((opt, i) => `  ${i + 1}. ${opt.text}`);
  this.out(
    `=== 選択肢 ===\n${lines.join("\n")}\n→ 自動選択: ${this.defaultChoice + 1}`,
  );
  return this.defaultChoice;
}
```

出力例:

```
=== 選択肢 ===
  1. 教室に行く
  2. 図書室に行く
→ 自動選択: 1
```

wait の処理。

```typescript
async wait(ms: number): Promise<void> {
  this.out(`[待機] ${ms}ms`);
  if (this.realTime) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

`realTime: true` にすると実際に待機する。デフォルトは `false` でログ出力のみ。

### ConsoleEngine の利用シーン

1. **スクリプトの動作確認**: CLI からスクリプトを流して出力を確認
2. **CI パイプライン**: 自動テストでスクリプトが正常に実行できるかチェック
3. **ログ出力**: `output` にファイル書き込み関数を渡してトレースログを取得

```typescript
import { Interpreter } from "@kaedevn/interpreter";
import { ConsoleEngine } from "@kaedevn/interpreter";

const engine = new ConsoleEngine({ defaultChoice: 1 });
const interpreter = new Interpreter(engine);

await interpreter.run(`
  bg("school_entrance")
  #hanako
  おはようございます！
  #
  choice {
    "教室に行く" {
      jump(classroom)
    }
    "図書室に行く" {
      jump(library)
    }
  }
`);
```

## TestEngine：状態管理テスト用実装

`TestEngine` はゲーム状態を実際に管理し、テストから問い合わせ可能にした実装だ。

```typescript
// packages/interpreter/src/engine/TestEngine.ts
export interface CharState {
  pose: string;
  position: string;
  anim: boolean;
}

export class TestEngine implements IEngineAPI {
  // 状態
  currentBg: string | null = null;
  characters: Map<string, CharState> = new Map();
  currentBgm: { name: string; vol: number } | null = null;
  dialogues: Array<{ speaker: string; lines: string[] }> = [];
  choices: Array<{ options: string[]; selected: number }> = [];
  battles: Array<{ troopId: string; result: "win" | "lose" }> = [];

  // テスト制御
  choiceQueue: number[] = [];
  battleQueue: Array<"win" | "lose"> = [];
}
```

### 状態の問い合わせ

TestEngine はプロパティとゲッターで状態を公開する。

```typescript
// 最後のセリフを取得
get lastDialogue() {
  return this.dialogues[this.dialogues.length - 1] ?? null;
}

// キャラクターが表示中か
isCharVisible(name: string): boolean {
  return this.characters.has(name);
}

// キャラクターの現在ポーズ
getCharPose(name: string): string | null {
  return this.characters.get(name)?.pose ?? null;
}

// キャラクターの現在位置
getCharPosition(name: string): string | null {
  return this.characters.get(name)?.position ?? null;
}

// BGM が再生中か
get isBgmPlaying(): boolean {
  return this.currentBgm !== null;
}
```

### テスト制御：キューイング

選択肢やバトルの結果をテスト側から制御するため、キュー方式を採用した。

```typescript
async showChoice(options: ChoiceOption[]): Promise<number> {
  const selected = this.choiceQueue.shift() ?? 0;
  this.choices.push({ options: options.map((o) => o.text), selected });
  return selected;
}

async battleStart(troopId: string): Promise<"win" | "lose"> {
  const result = this.battleQueue.shift() ?? "win";
  this.battles.push({ troopId, result });
  return result;
}
```

テストコードでは事前にキューに結果を入れておく。

```typescript
const engine = new TestEngine();
engine.choiceQueue = [1, 0]; // 1番目の選択肢 → 0番目の選択肢
engine.battleQueue = ["lose", "win"]; // 最初は負け → 次は勝ち
```

### reset メソッド

テスト間で状態をクリアするための `reset()` メソッド。

```typescript
reset(): void {
  this.currentBg = null;
  this.characters.clear();
  this.currentBgm = null;
  this.dialogues = [];
  this.choices = [];
  this.battles = [];
  this.choiceQueue = [];
  this.battleQueue = [];
}
```

### TestEngine を使ったテスト例

```typescript
import { Interpreter } from "../src/core/Interpreter";
import { TestEngine } from "../src/engine/TestEngine";

describe("Interpreter integration", () => {
  let engine: TestEngine;
  let interpreter: Interpreter;

  beforeEach(() => {
    engine = new TestEngine();
    interpreter = new Interpreter(engine);
  });

  it("should show dialogue", async () => {
    await interpreter.run(`
      #hero
      こんにちは世界！
      #
    `);

    expect(engine.lastDialogue?.speaker).toBe("hero");
    expect(engine.lastDialogue?.lines).toEqual(["こんにちは世界！"]);
  });

  it("should handle choice with queue", async () => {
    engine.choiceQueue = [1]; // 2番目の選択肢を選ぶ

    await interpreter.run(`
      choice {
        "選択A" {
          flag_a = true
        }
        "選択B" {
          flag_b = true
        }
      }
    `);

    expect(engine.choices[0].selected).toBe(1);
    expect(engine.choices[0].options).toEqual(["選択A", "選択B"]);
  });

  it("should manage character state", async () => {
    await interpreter.run(`
      ch("hanako", "smile", "center")
      ch("taro", "normal", "left")
      ch_hide("taro")
    `);

    expect(engine.isCharVisible("hanako")).toBe(true);
    expect(engine.getCharPose("hanako")).toBe("smile");
    expect(engine.getCharPosition("hanako")).toBe("center");
    expect(engine.isCharVisible("taro")).toBe(false);
  });

  it("should handle background changes", async () => {
    await interpreter.run(`
      bg("school_entrance")
    `);

    expect(engine.currentBg).toBe("school_entrance");
  });

  it("should handle BGM", async () => {
    await interpreter.run(`
      bgm("main_theme", 80)
    `);

    expect(engine.isBgmPlaying).toBe(true);
    expect(engine.currentBgm?.name).toBe("main_theme");
    expect(engine.currentBgm?.vol).toBe(80);
  });
});
```

## ConsoleEngine と TestEngine の使い分け

| 用途 | エンジン | 理由 |
|------|---------|------|
| スクリプトの動作確認 | ConsoleEngine | テキスト出力で流れを確認 |
| 単体テスト | TestEngine | 状態を `expect` で検証 |
| 結合テスト | TestEngine | 複数コマンドの連携を検証 |
| CI | ConsoleEngine | 実行完了 = 成功の簡易チェック |
| デバッグ | ConsoleEngine | トレースログとして利用 |
| ログ収集 | ConsoleEngine | `output` にカスタム関数 |

## エクスポート

両エンジンはパッケージのトップレベルからエクスポートされている。

```typescript
// packages/interpreter/src/index.ts
export type { IEngineAPI, ChoiceOption } from "./engine/IEngineAPI.js";
export { ConsoleEngine } from "./engine/ConsoleEngine.js";
export type { ConsoleEngineOptions } from "./engine/ConsoleEngine.js";
export { TestEngine } from "./engine/TestEngine.js";
export type { CharState } from "./engine/TestEngine.js";
```

利用者は `@kaedevn/interpreter` から直接インポートできる。

```typescript
import { Interpreter, ConsoleEngine, TestEngine } from "@kaedevn/interpreter";
```

## まとめ

- **ConsoleEngine**: 全操作をテキスト出力。CLI での動作確認・CI・ログ出力に
- **TestEngine**: 状態を管理・公開。テストコードから `expect` で検証に
- **IEngineAPI**: 16 メソッドのインターフェースに準拠。Web 実装も Switch 実装も同じインターフェース

OSS のインタプリタパッケージとして、ブラウザもゲーム機もなくてもスクリプトの動作検証ができる環境を提供できた。

---

ConsoleEngine と TestEngine は IEngineAPI の「最も薄い実装」として設計した。ConsoleEngine はログ出力のみ、TestEngine は状態保持のみ。どちらもゲームエンジンとしては不完全だが、スクリプトの検証用としては十分な機能を持つ。TestEngine のキューイング方式は、選択肢やバトルを含む複雑なシナリオのテストを決定的（deterministic）に実行できるため、CI でのリグレッションテストに特に有効だった。

　　　　　　　　　　Claude Opus 4.6
