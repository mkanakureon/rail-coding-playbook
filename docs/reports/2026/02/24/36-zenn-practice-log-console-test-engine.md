---
title: "実践ログ — ConsoleEngine + TestEngine を 1 セッションで実装・テスト・ドキュメント"
emoji: "🧪"
type: "idea"
topics: ["claudecode", "typescript", "テスト"]
published: false
---

## はじめに

kaedevn ビジュアルノベルエンジンの `packages/interpreter` には、ゲームエンジンの抽象インターフェース `IEngineAPI` がある。Web 版では PixiJS を使った `WebEngine` が実装されているが、OSS 公開にあたって 2 つの問題があった。

1. PixiJS に依存しない **コンソール実装** がない（`npm run demo` が動かない）
2. テストで使える **状態管理つきモック** がない（テストが書きにくい）

この 2 つを、Claude Code との 1 セッションで実装した記録だ。

## IEngineAPI のインターフェース

まず、実装対象のインターフェースを確認する。

```typescript
export interface IEngineAPI {
  // セリフ
  showDialogue(speaker: string, lines: string[]): Promise<void>;

  // 背景
  setBg(name: string, effect?: string): Promise<void>;

  // キャラクター
  showChar(name: string, pose: string, position?: string, fadeMs?: number): Promise<void>;
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

全 17 メソッド。セリフ表示からバトル処理まで、ビジュアルノベルに必要な全操作をカバーしている。

## セッション 1: ConsoleEngine の実装

### 14:00 — 方針決定

```
ユーザー: IEngineAPI のコンソール実装を作って。
         OSS の公式リファレンス実装として使う。
```

ConsoleEngine の設計方針は明確だった。

- 全 17 メソッドを実装する
- PixiJS には一切依存しない
- 標準出力に `[背景] school_day` のような形式でログを出す
- 選択肢は自動選択（デフォルト: 最初の選択肢）
- オプションで挙動をカスタマイズ可能にする

### 14:15 — ConsoleEngine 完成

```typescript
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
```

オプションが 4 つ。特に `output` が重要だ。デフォルトは `console.log` だが、テスト時にはカスタム関数を渡せる。

各メソッドの実装は直感的だ。

```typescript
async showDialogue(speaker: string, lines: string[]): Promise<void> {
  const name = speaker || "ナレーション";
  const text = lines.map((l) => `  ${l}`).join("\n");
  this.out(`\n【${name}】\n${text}`);
}
```

セリフ表示は `【キャラ名】` の形式。speaker が空文字列なら「ナレーション」になる。

```typescript
async showChoice(options: ChoiceOption[]): Promise<number> {
  const lines = options.map((opt, i) => `  ${i + 1}. ${opt.text}`);
  this.out(
    `=== 選択肢 ===\n${lines.join("\n")}\n→ 自動選択: ${this.defaultChoice + 1}`,
  );
  return this.defaultChoice;
}
```

選択肢は一覧を表示してから、`defaultChoice` を自動的に返す。コンソールでは対話入力がないので、自動選択が妥当だ。

```typescript
async wait(ms: number): Promise<void> {
  this.out(`[待機] ${ms}ms`);
  if (this.realTime) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

`wait()` はデフォルトでは即座に返る。`realTime: true` にすると実際に待つ。デモ実行時に「間」を作りたいときに使う。

全体で 146 行。小さいが、17 メソッドすべてを漏れなく実装している。

### 14:30 — テスト 31 件

ConsoleEngine のテストは 284 行。全 31 テストケース。

```typescript
// テストでの使い方
const logs: string[] = [];
const engine = new ConsoleEngine({
  output: (msg) => logs.push(msg),
});

await engine.showDialogue("hero", ["こんにちは"]);
expect(logs[0]).toContain("【hero】");
expect(logs[0]).toContain("こんにちは");
```

`output` にカスタム関数を渡すことで、標準出力をキャプチャせずにテストできる。これが `output` オプションの真の目的だ。

コミットメッセージ:

```
feat: IEngineAPI の OSS コンソール実装（ConsoleEngine）を追加

- ConsoleEngine: 全17メソッドの標準出力実装
- ConsoleEngineOptions: 自動選択、バトル結果、realTime、出力先の設定
- index.ts: ConsoleEngine / ConsoleEngineOptions をエクスポート
- テスト31件追加（全165件パス）
```

## セッション 2: TestEngine の実装

### 15:00 — なぜ TestEngine が必要か

ConsoleEngine はログを出すだけだ。ゲームの状態（どのキャラが表示中か、BGM は何か）を管理しない。

テストでは「`showChar("hero", "smile", "center")` の後に `hero` が `center` にいることを確認したい」というケースがある。そのためには、状態を管理する実装が必要だ。

### 15:15 — TestEngine の設計

```typescript
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
```

状態は 6 種類。すべて `public` なので、テストから直接アクセスできる。

テスト制御として `choiceQueue` と `battleQueue` がある。これが TestEngine の核心だ。

### 選択肢のテスト制御

```typescript
async showChoice(options: ChoiceOption[]): Promise<number> {
  const selected = this.choiceQueue.shift() ?? 0;
  this.choices.push({ options: options.map((o) => o.text), selected });
  return selected;
}
```

`choiceQueue` にインデックスを事前に入れておくと、選択肢が出るたびにキューから取り出す。キューが空なら 0（最初の選択肢）を返す。

テストでの使い方:

```typescript
const engine = new TestEngine();
engine.choiceQueue = [1, 0, 2]; // 2番目 → 1番目 → 3番目を選択

// スクリプト実行
// 1回目の選択肢 → インデックス 1 を返す
// 2回目の選択肢 → インデックス 0 を返す
// 3回目の選択肢 → インデックス 2 を返す
```

バトルも同様。

```typescript
engine.battleQueue = ["win", "lose"]; // 1回目勝ち、2回目負け
```

### 問い合わせ API

```typescript
/** キャラクターが表示中か */
isCharVisible(name: string): boolean {
  return this.characters.has(name);
}

/** キャラクターの現在ポーズ */
getCharPose(name: string): string | null {
  return this.characters.get(name)?.pose ?? null;
}

/** キャラクターの現在位置 */
getCharPosition(name: string): string | null {
  return this.characters.get(name)?.position ?? null;
}

/** BGM が再生中か */
get isBgmPlaying(): boolean {
  return this.currentBgm !== null;
}

/** 最後のセリフを取得 */
get lastDialogue() {
  return this.dialogues[this.dialogues.length - 1] ?? null;
}
```

テストから「今、hero は表示中？」「ポーズは何？」と聞ける。

### 15:30 — 状態管理の実装

各メソッドの実装は状態を更新する。

```typescript
async showChar(
  name: string,
  pose: string,
  position?: string,
  fadeMs?: number,
): Promise<void> {
  this.characters.set(name, {
    pose,
    position: position ?? "center",
    anim: false,
  });
}

async hideChar(name: string, fadeMs?: number): Promise<void> {
  this.characters.delete(name);
}

async moveChar(name: string, position: string, time: number): Promise<void> {
  const ch = this.characters.get(name);
  if (ch) ch.position = position;
}
```

`showChar` は Map に追加、`hideChar` は Map から削除、`moveChar` は位置だけ更新。シンプルだが、ゲームの状態遷移を正確に追跡できる。

### リセット

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

テスト間で状態をリセットできる。`beforeEach` で呼ぶ想定だ。

### 15:45 — テスト 28 件

```
feat: 状態管理する TestEngine を追加

- TestEngine: IEngineAPI の全メソッドで実際にゲーム状態を管理
- 問い合わせ API: isCharVisible, getCharPose, getCharPosition, isBgmPlaying, lastDialogue
- テスト制御: choiceQueue, battleQueue で分岐を制御
- テスト28件追加（全193件パス）
```

TestEngine のテストは 315 行。28 テストケース。

## セッション 3: ドキュメント更新

### 16:00 — 6 ファイル更新

ConsoleEngine と TestEngine ができたら、ドキュメントを更新する必要がある。

```
docs: ConsoleEngine ガイド追加・関連ドキュメント更新

- guide-console-engine.md: 動作原理、拡張パターン、テスト活用例
- guide-getting-started.md: 手書き実装を公式 ConsoleEngine に差し替え
- guide-engine-implementation.md: MockEngine → TestEngine に改名、全面書き直し
- api-reference.md: ConsoleEngine / ConsoleEngineOptions を追加
- spec-engine-api.md: 公式コンソール実装セクション追加
```

6 ファイル変更、530 行追加。

特に `guide-getting-started.md` の変更が重要だ。以前は「自分で MockEngine を書いてください」という説明だったが、公式の ConsoleEngine ができたので差し替えた。OSS の利用者は `import { ConsoleEngine } from '@kaedevn/interpreter'` だけで使い始められる。

## 成果の整理

| 項目 | 数値 |
|------|------|
| 新規ファイル | 2（ConsoleEngine.ts, TestEngine.ts） |
| テストファイル | 2（ConsoleEngine.test.ts, TestEngine.test.ts） |
| テストケース | 59（31 + 28） |
| ドキュメント更新 | 6 ファイル |
| コード行数 | ConsoleEngine: 146行, TestEngine: 167行 |
| テスト行数 | 599行 |
| ドキュメント行数 | 530行追加 |

コードよりテストとドキュメントの方が多い。これは OSS として公開するパッケージとしては健全な比率だ。

## 設計判断の振り返り

### ConsoleEngine と TestEngine を分けた理由

1 つのクラスに統合することもできたが、分けた。理由は明確だ。

- **ConsoleEngine** は「出力」が目的。ログを人間が読む。
- **TestEngine** は「検証」が目的。状態をプログラムが読む。

用途が違うものを 1 クラスに混ぜると、どちらの責務も中途半端になる。

### public フィールドにした理由

TestEngine の状態フィールドはすべて `public` だ。TypeScript のベストプラクティスとしては `private` + getter が良いとされるが、テスト専用のクラスでは `public` の方が使いやすい。

```typescript
// public だからこう書ける
expect(engine.currentBg).toBe("classroom");
expect(engine.characters.size).toBe(2);

// private + getter だとこうなる
expect(engine.getCurrentBg()).toBe("classroom");
expect(engine.getCharacterCount()).toBe(2);
```

テストコードの可読性を優先した。

### ChoiceOption の text のみ記録

```typescript
this.choices.push({ options: options.map((o) => o.text), selected });
```

`ChoiceOption` には `text` と `condition` があるが、TestEngine は `text` だけ記録している。`condition` はインタプリタが評価するもので、エンジン層では見えない。

## まとめ

1 セッションで以下を完了した。

1. ConsoleEngine（146 行）+ テスト 31 件
2. TestEngine（167 行）+ テスト 28 件
3. ドキュメント 6 ファイル更新

Claude Code との協働では、インターフェースが明確であればあるほど実装が速い。`IEngineAPI` の 17 メソッドがきちんと定義されていたおかげで、2 つの実装を迷いなく作れた。

---

ConsoleEngine と TestEngine、設計としてはシンプルだけど、OSS として「最初に触る部分」をきちんと整えるのは地味に大事な仕事だった。テストが 59 件というのは少なく見えるが、17 メソッド x 各パターンをカバーしているので密度はそこそこある。

　　　　　　　　　　Claude Opus 4.6
