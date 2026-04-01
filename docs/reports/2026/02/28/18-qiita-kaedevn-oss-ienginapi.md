---
title: "ビジュアルノベルエンジンをOSSで公開した：IEngineAPI 17メソッドでWeb/Console/Switchを統一する設計"
tags:
  - TypeScript
  - ゲーム開発
  - ClaudeCode
  - OSS
  - 設計パターン
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

## はじめに

ビジュアルノベルエンジン **[kaedevn](https://github.com/mkanakureon/kaedevn)** を OSS として公開した。

`.ksc`（Kaede Script）で書いたシナリオを、**Web（PixiJS）でもコンソールでも Nintendo Switch でも同じように動かす**——それを可能にするのが `IEngineAPI` というプラットフォーム抽象化インターフェースだ。

この記事では、リポジトリの構成、IEngineAPI の設計判断、そして「なぜ17メソッドなのか」を解説する。

## リポジトリ概要

| 項目 | 内容 |
|------|------|
| リポジトリ | [mkanakureon/kaedevn](https://github.com/mkanakureon/kaedevn) |
| 言語 | TypeScript |
| パッケージ | `@kaedevn/interpreter`（インタプリタ） |
| テスト | 193 テスト |
| ライセンス | MIT |
| ドキュメント | 8 ページ（Getting Started〜API Reference） |

```bash
# クイックスタート
git clone https://github.com/mkanakureon/kaedevn.git
cd kaedevn
npm install
npm run build
npm run demo   # コンソールでサンプル実行
```

## .ksc スクリプトとは

ノベルゲーム用のスクリプト言語。背景・立ち絵・BGM・選択肢・変数・条件分岐をサポートする。

```ksc
bg("school_day")
ch("hero", "smile", "center")

#hero
おはよう！今日もいい天気だね。
#

choice {
  "一緒に帰ろう" {
    affection += 2
    jump("go_home")
  }
  "図書室に行こう" if (affection >= 3) {
    jump("library")
  }
}
```

関数定義 `def`、サブルーチン `sub`、条件付き選択肢 `if (条件)`——ノベルゲームに必要な機能はひととおり揃えた。

## なぜプラットフォーム抽象化が必要か

同じ `.ksc` スクリプトを複数のプラットフォームで動かしたい：

| プラットフォーム | 描画 | 音声 | 入力 |
|----------------|------|------|------|
| Web | PixiJS + WebGL | Web Audio API | Pointer / Keyboard |
| Console | `console.log` | なし | 自動選択 |
| Test | なし（状態記録のみ） | なし | キュー |
| Switch（将来） | NVN SDK | nn::audio | コントローラー |

スクリプトのパース・評価ロジックは共通。**描画・音声・入力の部分だけ差し替えたい。**

## IEngineAPI — 17メソッドの全容

```typescript
export interface IEngineAPI {
  // ダイアログ（async — プレイヤー入力を待つ）
  showDialogue(speaker: string | null, lines: string[]): Promise<void>;
  showChoice(options: string[]): Promise<number>;
  waitForClick(): Promise<void>;
  wait(ms: number): Promise<void>;

  // 背景（async — トランジション完了を待つ）
  setBg(name: string, effect?: string): Promise<void>;

  // キャラクター（async — アニメーション完了を待つ）
  showChar(name: string, pose: string, position?: string, fadeMs?: number): Promise<void>;
  hideChar(name: string, fadeMs?: number): Promise<void>;
  clearChars(fadeMs?: number): Promise<void>;
  showCharAnim(name: string, pose: string, position: string): Promise<void>;
  moveChar(name: string, position: string, time: number): Promise<void>;

  // 音声（sync — fire-and-forget）
  playBgm(name: string, vol?: number, fadeMs?: number): void;
  stopBgm(): void;
  fadeBgm(time: number): Promise<void>;
  playSe(name: string, vol?: number): void;
  playVoice(name: string): void;

  // 演出
  playTimeline(name: string): Promise<void>;
  battleStart(troopId: string): Promise<'win' | 'lose'>;
}
```

## 設計のポイント3つ

### 1. async と sync を明確に分離

**async にしたもの**（完了を待つ必要がある）:

- `showDialogue` — プレイヤーのクリックを待つ
- `showChoice` — 選択結果の番号を返す
- `setBg` / `showChar` — トランジション完了を待つ
- `battleStart` — win/lose の結果を返す

**sync にしたもの**（fire-and-forget）:

- `playBgm` / `playSe` / `playVoice` — 再生開始すれば十分

```typescript
// 使う側はシンプル
await engine.showDialogue("hero", ["おはよう！"]);
await engine.setBg("school_day");
engine.playBgm("morning_theme");  // await 不要
```

### 2. 最小実装はたった2メソッド

17メソッドあるが、必須はたった2つ。残りは no-op でも動く。

```typescript
class MinimalEngine implements IEngineAPI {
  async showDialogue(speaker: string | null, lines: string[]) {
    console.log(lines.join('\n'));
  }
  async showChoice(options: string[]) {
    return 0; // 常に最初の選択肢
  }
  // 残り15メソッドは no-op
  async setBg() {}
  async showChar() {}
  playBgm() {}
  // ...
}
```

新しいプラットフォームに移植するとき、**まず2メソッド実装すればスクリプトが動く。** 背景・音声は後から追加すればいい。

### 3. テスト用の実装を標準提供

`TestEngine` は全呼び出しを記録し、テストコードから状態を検証できる。

```typescript
const engine = new TestEngine();
engine.choiceQueue = [1, 0]; // 選択肢の回答をキューで制御

const interpreter = new Interpreter(engine);
await interpreter.run(script);

expect(engine.bg).toBe('school_day');
expect(engine.chars.get('hero')?.pose).toBe('smile');
expect(engine.dialogues).toHaveLength(3);
```

`choiceQueue` と `battleQueue` に事前にキューを詰めておけば、テスト中の分岐を自在に制御できる。

## 4つの実装の比較

| 実装 | 用途 | 行数 | 特徴 |
|------|------|------|------|
| **ConsoleEngine** | CLIデモ・デバッグ | 80行 | 人間が読めるテキスト出力 |
| **TestEngine** | ユニットテスト | 120行 | 全呼び出し記録・状態検証 |
| **WebEngine** | ブラウザ実行 | 384行 | PixiJS描画・アニメーション |
| **(SwitchEngine)** | Switch実行 | 未実装 | NVN SDK（将来） |

ConsoleEngine の出力例:

```
[背景: school_day]
♪ BGM: morning_theme
【hero】
　おはよう！今日もいい天気だね。
--- 選択肢 ---
→ 1. 一緒に帰ろう
　 2. 図書室に行こう
```

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [Getting Started](https://github.com/mkanakureon/kaedevn/blob/main/packages/interpreter/docs/guide-getting-started.md) | インストール〜最初の実行 |
| [Scripting Guide](https://github.com/mkanakureon/kaedevn/blob/main/packages/interpreter/docs/guide-scripting.md) | .ksc の書き方 |
| [Engine Implementation](https://github.com/mkanakureon/kaedevn/blob/main/packages/interpreter/docs/guide-engine-implementation.md) | IEngineAPI の実装方法 |
| [KSC Language Spec](https://github.com/mkanakureon/kaedevn/blob/main/packages/interpreter/docs/spec-ksc-language.md) | 言語仕様 |
| [API Reference](https://github.com/mkanakureon/kaedevn/blob/main/packages/interpreter/docs/api-reference.md) | 全メソッド一覧 |

サンプルスクリプトは [`packages/interpreter/examples/`](https://github.com/mkanakureon/kaedevn/tree/main/packages/interpreter/examples) に8本。

## 公開してみて

### よかった点

- **IEngineAPI の設計が先にあった**おかげで、公開用に切り出すのが楽だった。インタプリタ + IEngineAPI + ConsoleEngine + TestEngine がきれいに独立している
- **ドキュメント8ページ**はClaude Codeに書かせた。コードから自動生成ではなく、読んで理解して書いた形のドキュメント。正直、人間が書くより網羅的
- **193テストがあるので公開時の不安が少ない**。「動かない」「バグがある」をテストが保証してくれる

### 正直な課題

- **コンパイラ（.ks → .ksc 変換）はまだ非公開**。これがないと TyranoScript 風のスクリプトが書けない
- **WebEngine も非公開**。描画部分のコードはモノレポ内にあるが、アセット管理と密結合しているため切り出しに時間がかかる
- **npm publish はまだしていない**。GitHub からの clone のみ

## まとめ

- [mkanakureon/kaedevn](https://github.com/mkanakureon/kaedevn) — ビジュアルノベルエンジンを OSS 公開
- **IEngineAPI**: 17メソッドのプラットフォーム抽象化インターフェース
- async/sync 分離、最小2メソッド実装、テスト用エンジン標準提供
- 193テスト、ドキュメント8ページ、サンプルスクリプト8本
- Fork して使ってください。Issue・PR も歓迎

---
インタプリタを切り出し、ドキュメントを整え、テストを確認した。
「公開する」というのはコードを置くことではなく、
誰かが clone して動かせる状態にすることだった。

　　　　　　　　　　Claude Opus 4.6
