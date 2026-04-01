---
title: "IEngineAPI — 17 メソッドのプラットフォーム抽象化層を設計した理由"
emoji: "🔌"
type: "tech"
topics: ["claudecode", "typescript", "設計", "ゲーム開発"]
published: false
---

## この記事で得られるもの

ビジュアルノベルエンジンのプラットフォーム抽象化層（IEngineAPI）を設計した過程。17 メソッドの async/sync 分離、最小実装と完全実装の設計、ConsoleEngine・TestEngine の実装例。

## 問題: 同じスクリプトを複数プラットフォームで動かしたい

[kaedevn](https://github.com/mkanakureon/kaedevn) はビジュアルノベルエンジンだ。`.ksc` というスクリプト言語でシナリオを書き、それを実行する。

```ksc
bg("school_day")
ch("hero", "smile", "center")

#hero
おはよう！今日もいい天気だね。
#

choice {
  "一緒に帰ろう" { jump("go_home") }
  "図書室に行こう" { jump("library") }
}
```

このスクリプトを:

- **ブラウザ** で動かしたい（PixiJS + WebGL）
- **コンソール** で動かしたい（テスト・デバッグ用）
- **テストコード** で動かしたい（状態検証用）
- 将来は **Nintendo Switch** でも動かしたい

プラットフォームごとに実行エンジンを全部書き直すのは現実的ではない。スクリプトのパース・評価ロジックは共通で、**描画・音声・入力の部分だけ差し替えたい。**

## 解決策: IEngineAPI インターフェース

全プラットフォーム共通のインターフェースを 1 つ定義し、プラットフォームごとに実装する。

```typescript
export interface IEngineAPI {
  // ダイアログ
  showDialogue(speaker: string | null, lines: string[]): Promise<void>;
  showChoice(options: string[]): Promise<number>;
  waitForClick(): Promise<void>;
  wait(ms: number): Promise<void>;

  // 背景
  setBg(name: string, effect?: string): Promise<void>;

  // キャラクター
  showChar(name: string, pose: string, position?: string, fadeMs?: number): Promise<void>;
  hideChar(name: string, fadeMs?: number): Promise<void>;
  clearChars(fadeMs?: number): Promise<void>;
  showCharAnim(name: string, pose: string, position: string): Promise<void>;
  moveChar(name: string, position: string, time: number): Promise<void>;

  // 音声
  playBgm(name: string, vol?: number, fadeMs?: number): void;
  stopBgm(): void;
  fadeBgm(time: number): Promise<void>;
  playSe(name: string, vol?: number): void;
  playVoice(name: string): void;

  // 演出・バトル
  playTimeline(name: string): Promise<void>;
  battleStart(troopId: string): Promise<'win' | 'lose'>;
}
```

17 メソッド。これがエンジンの全インターフェースだ。

## 設計判断 1: async と sync の分離

17 メソッドのうち、async（`Promise` を返す）と sync（`void` を返す）を明確に分けた。

### async にしたもの（完了を待つ必要がある）

| メソッド | 理由 |
|---|---|
| `showDialogue` | プレイヤーのクリックを待つ |
| `showChoice` | 選択結果を返す必要がある |
| `setBg` | トランジション完了を待つ |
| `showChar` / `hideChar` | フェードイン・アウト完了を待つ |
| `wait` / `waitForClick` | 待機そのものが目的 |
| `battleStart` | バトル結果（win/lose）を返す |

### sync にしたもの（fire-and-forget）

| メソッド | 理由 |
|---|---|
| `playBgm` | 再生開始すれば十分。完了を待つ必要なし |
| `playSe` | 効果音は一瞬。待たない |
| `playVoice` | ボイス再生開始後、次の処理に進む |
| `stopBgm` | 即座に停止 |

この分離により、インタプリタ側の実装がシンプルになる:

```typescript
// async メソッド — await で完了を待つ
await engine.showDialogue("hero", ["おはよう！"]);
await engine.setBg("school_day");

// sync メソッド — await 不要、即座に次へ
engine.playBgm("morning_theme");
engine.playSe("door_open");
```

もし全メソッドを async にすると、`playSe` のような一瞬の処理にも `await` が必要になり冗長になる。逆に全部 sync にすると、選択肢の結果を受け取れない。

## 設計判断 2: 最小実装と完全実装

IEngineAPI は 17 メソッドあるが、**全部を真面目に実装する必要はない。**

最小実装（必須はたった 2 メソッド）:

```typescript
// これだけあればスクリプトは実行できる
showDialogue(speaker, lines): Promise<void>  // セリフ表示
showChoice(options): Promise<number>          // 選択肢
```

残り 15 メソッドは no-op（何もしない）でも動く。

```typescript
class MinimalEngine implements IEngineAPI {
  async showDialogue(speaker: string | null, lines: string[]) {
    console.log(lines.join('\n'));
  }
  async showChoice(options: string[]) {
    return 0; // 常に最初の選択肢
  }
  // 残りは全て no-op
  async setBg() {}
  async showChar() {}
  playBgm() {}
  // ...
}
```

なぜこうしたか:

- **参入障壁を下げる。** 新しいプラットフォームに移植するとき、まず 2 メソッドだけ実装すればスクリプトが動く
- **段階的に機能追加できる。** 背景表示 → キャラ表示 → 音声 → バトルの順に実装を進められる
- **テスト用途では最小実装で十分。** スクリプトのロジック検証に背景表示は不要

## ConsoleEngine — 参考実装

コンソールに出力する参考実装を `ConsoleEngine` として提供している。

```typescript
export class ConsoleEngine implements IEngineAPI {
  private options: ConsoleEngineOptions;

  constructor(options: Partial<ConsoleEngineOptions> = {}) {
    this.options = {
      defaultChoice: 0,
      defaultBattleResult: 'win',
      realTimeWait: false,
      output: console.log,
      ...options,
    };
  }

  async showDialogue(speaker: string | null, lines: string[]) {
    const name = speaker ?? 'ナレーション';
    this.options.output(`【${name}】`);
    for (const line of lines) {
      this.options.output(`　${line}`);
    }
  }

  async showChoice(options: string[]) {
    this.options.output('--- 選択肢 ---');
    options.forEach((opt, i) => {
      const marker = i === this.options.defaultChoice ? '→' : '　';
      this.options.output(`${marker} ${i + 1}. ${opt}`);
    });
    return this.options.defaultChoice;
  }

  async setBg(name: string, effect?: string) {
    const fx = effect ? ` [${effect}]` : '';
    this.options.output(`[背景: ${name}${fx}]`);
  }

  playBgm(name: string, vol?: number) {
    this.options.output(
      `♪ BGM: ${name}${vol !== undefined ? ` (vol: ${vol})` : ''}`
    );
  }
}
```

ConsoleEngine の設計判断:

- **`defaultChoice` で選択肢を自動選択。** コンソールではユーザー入力を受け付けず、デフォルトのインデックスを返す
- **`realTimeWait` オプション。** `true` にすると `wait(1000)` で実際に 1 秒待つ。`false`（デフォルト）では即座に返る
- **`output` 関数の差し替え。** テスト時に `console.log` の代わりにバッファに溜める関数を渡せる

## TestEngine — テスト専用の状態追跡

テストコードでは「正しいメソッドが正しい引数で呼ばれたか」を検証したい。TestEngine は全ての呼び出しを記録する。

```typescript
export class TestEngine implements IEngineAPI {
  bg: string | null = null;
  chars: Map<string, { pose: string; position: string; anim: boolean }> = new Map();
  bgm: string | null = null;
  isBgmPlaying = false;
  dialogues: { speaker: string | null; lines: string[] }[] = [];
  choiceQueue: number[] = [];
  battleQueue: Array<'win' | 'lose'> = [];

  async setBg(name: string) {
    this.bg = name;
  }

  async showChoice(options: string[]) {
    if (this.choiceQueue.length > 0) {
      return this.choiceQueue.shift()!;
    }
    return 0;
  }

  async battleStart(troopId: string) {
    if (this.battleQueue.length > 0) {
      return this.battleQueue.shift()!;
    }
    return 'win';
  }

  reset() {
    this.bg = null;
    this.chars.clear();
    this.bgm = null;
    this.dialogues = [];
    this.choiceQueue = [];
    this.battleQueue = [];
  }
}
```

テストでの使い方:

```typescript
const engine = new TestEngine();
engine.choiceQueue = [1, 0]; // 1番目 → 0番目の順で選択

const interpreter = new Interpreter(engine);
await interpreter.run(script);

// 状態を検証
expect(engine.bg).toBe('school_day');
expect(engine.chars.get('hero')?.pose).toBe('smile');
expect(engine.dialogues).toHaveLength(3);
```

`choiceQueue` と `battleQueue` に事前にキューを詰めておくことで、テスト中の選択肢とバトル結果を制御できる。

## 4 つの実装の比較

| 実装 | 用途 | 実装量 | 特徴 |
|---|---|---|---|
| ConsoleEngine | CLI デモ・デバッグ | 80 行 | 人間が読めるテキスト出力 |
| TestEngine | ユニットテスト | 120 行 | 全呼び出しを記録・検証可能 |
| WebEngine | ブラウザ実行 | 384 行 | PixiJS による描画・アニメーション |
| (Switch) | Switch 実行 | 未実装 | NVN SDK による描画 |

同じ `.ksc` スクリプトが、IEngineAPI の実装を差し替えるだけで全く異なる環境で動く。

## 学んだこと

1. **インターフェースは小さく始める。** 最初は 5 メソッドだった。機能が増えるたびにメソッドを追加して 17 になった。最初から 17 個設計しようとしたら破綻していた
2. **async/sync の判断は早めにする。** 後から変えると全実装に影響する。「完了を待つ必要があるか？」という基準で最初に決める
3. **テスト用の実装を最初に作る。** ConsoleEngine と TestEngine があることで、インタプリタ本体の 193 テストが IEngineAPI の全メソッドを間接的にテストしている

## まとめ

- IEngineAPI: 17 メソッドのプラットフォーム抽象化インターフェース
- async/sync を明確に分離し、実装とインタプリタの両方をシンプルに
- 最小実装は 2 メソッド。段階的に機能追加可能
- ConsoleEngine（デモ用）と TestEngine（テスト用）を参考実装として提供
- 同じスクリプトが Web・コンソール・テストで動く

---

17 メソッド。多いようで、実は足りないくらいだ。
画面遷移、セーブ UI、コンフィグ画面。
まだ抽象化が必要なものは増えていくだろう。

　　　　　　　　　　Claude Opus 4.6
