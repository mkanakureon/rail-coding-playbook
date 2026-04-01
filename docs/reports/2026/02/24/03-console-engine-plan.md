# IEngineAPI OSS コンソール実装 計画書

## 背景

`@kaedevn/interpreter` の OSS 公開にあたり、利用者がすぐに動作確認できる **公式コンソール実装（ConsoleEngine）** が必要。現状は test/demo.ts に DemoEngineAPI があるが、以下の問題がある:

- テストファイル内のローカルクラスで、npm パッケージに含まれない
- `showCharAnim`, `clearChars`, `playVoice`, `battleStart` が未実装（IEngineAPI を満たさない）
- 絵文字を使ったデモ出力で、OSS ライブラリの公式実装としては不適切

OSS ユーザーが `npm install @kaedevn/interpreter` 後、最小コードで .ksc スクリプトを実行できる公式 ConsoleEngine を提供する。

## 方針

### 追加するもの

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `src/engine/ConsoleEngine.ts` | IEngineAPI の完全実装（標準出力） |
| 2 | `src/engine/ConsoleEngine.test.ts` → `test/ConsoleEngine.test.ts` | ユニットテスト |
| 3 | `src/index.ts` | ConsoleEngine のエクスポート追加 |
| 4 | `packages/interpreter/docs/guide-console-engine.md` | ConsoleEngine 利用ガイド |
| 5 | `packages/interpreter/docs/README.md` | 索引にガイド追加 |

### ConsoleEngine の設計

```typescript
// src/engine/ConsoleEngine.ts
import type { IEngineAPI, ChoiceOption } from "./IEngineAPI.js";

export interface ConsoleEngineOptions {
  /** 選択肢の自動選択インデックス（デフォルト: 0） */
  defaultChoice?: number;
  /** バトルの自動結果（デフォルト: "win"） */
  defaultBattleResult?: "win" | "lose";
  /** wait() を実際に待つか（デフォルト: false — 即座に返す） */
  realTime?: boolean;
  /** 出力先（デフォルト: console.log） */
  output?: (message: string) => void;
}

export class ConsoleEngine implements IEngineAPI {
  private options: Required<ConsoleEngineOptions>;

  constructor(options?: ConsoleEngineOptions) { ... }

  // 全 17 メソッドを実装
}
```

### 各メソッドの出力フォーマット

```
[背景] school (fade)
[キャラ表示] hero smile center
[キャラアニメ] hero idle center
[キャラ非表示] hero
[キャラ全消去]
[キャラ移動] hero → right (500ms)
[BGM] daily vol=80 fade=1000ms
[BGM停止]
[BGMフェード] 2000ms
[SE] click vol=100
[ボイス] hero_001
[タイムライン] opening
[バトル] troop_001 → win
[待機] 1000ms
[クリック待ち]

【hero】
  こんにちは
  良い天気ですね

=== 選択肢 ===
  1. はい
  2. いいえ
→ 自動選択: 1
```

### 出力ルール

- セリフ: `【speaker】` + インデント付きテキスト。地の文（speaker が空）は `【ナレーション】`
- コマンド: `[カテゴリ]` プレフィックス + パラメータ
- 選択肢: `=== 選択肢 ===` + 番号付きリスト + `→ 自動選択: N`
- オプション引数は指定時のみ表示（`vol=80` など）
- 絵文字は使わない（ターミナル互換性のため）

### エクスポート変更

```typescript
// src/index.ts に追加
export { ConsoleEngine } from "./engine/ConsoleEngine.js";
export type { ConsoleEngineOptions } from "./engine/ConsoleEngine.js";
```

### テスト方針

```typescript
// test/ConsoleEngine.test.ts
// output オプションで出力を配列にキャプチャして検証
const logs: string[] = [];
const engine = new ConsoleEngine({
  output: (msg) => logs.push(msg),
});
```

テストケース:
- 全 17 メソッドの出力フォーマット検証
- オプション引数の有無による出力差分
- ConsoleEngineOptions の各オプション動作
- Interpreter と組み合わせた統合テスト（.ksc → ConsoleEngine → 出力検証）

### ドキュメント

`docs/guide-console-engine.md` に以下を記載:
- ConsoleEngine の概要と用途
- インストール・基本的な使い方
- ConsoleEngineOptions の全オプション解説
- 出力フォーマット一覧
- カスタマイズ例（出力先変更、ファイル出力）
- テスト用途での活用（output キャプチャ）

## 作業順序

```
1. ConsoleEngine.ts 作成（IEngineAPI 全メソッド実装）
2. index.ts にエクスポート追加
3. ConsoleEngine.test.ts 作成・テスト実行
4. guide-console-engine.md 作成
5. docs/README.md 索引更新
6. ビルド確認（tsc）
7. 既存テスト全パス確認
```

## 既存コードへの影響

- 既存ファイルの変更は `src/index.ts`（エクスポート追加）と `docs/README.md`（索引追加）のみ
- test/demo.ts の DemoEngineAPI は変更しない（テスト用途で残す）
- test/Interpreter.test.ts の MockEngineAPI も変更しない
- 破壊的変更なし
