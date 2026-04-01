# KSC コマンドリファレンス文書の作成

## 背景

エディタに KSC スクリプトブロックを追加したことを受け、スクリプトを手動で記述するにあたって正確な構文が必要になった。
既存の `docs/ks-spec.md` は旧コンパイラ形式（`.ks`）の仕様書であり、現行インタープリタ形式（`.ksc`）との対応が不明確だった。
また「KSC だよ、KS ではない」という指摘があったように、両フォーマットの混同が起きやすい状況だった。

## 方針

- `packages/interpreter/src/core/Interpreter.ts` の `executeBuiltin()` を参照し、実装済みコマンドを正確に把握する
- `packages/interpreter/src/engine/IEngineAPI.ts` でパラメータの型・意味を確認する
- 既存の `.ksc` サンプルファイル（`packages/web/public/scenarios/`、`packages/interpreter/examples/`）から実際の書き方を確認する
- KS と KSC の対応表を中心に据え、両フォーマットを並べて比較できる文書を作成する

## 変更ファイル一覧

| # | ファイル | 変更 |
|---|---------|------|
| 1 | `docs/ksc-command-reference.md` | 新規作成 |

## 文書の構成

`docs/ksc-command-reference.md` に以下のセクションを作成した。

### KS と KSC の対応表

主要な違い：

| 観点 | KS | KSC |
|------|----|------|
| コメント | `;` | `//` |
| コマンド構文 | `@command param1 param2` | `command("arg1", "arg2")` |
| セリフブロック | `#名前` → テキスト（閉じなし） | `#キャラID` ～ `#`（閉じ必要） |
| wait 単位 | 秒（`@wait 0.5`） | ミリ秒（`wait(500)`） |
| ページ制御 | `@l` / `@p` / `@r` | ダイアローグブロックで自動制御 |

### 実装済み組み込みコマンド

`Interpreter.ts` の `isBuiltinFunction()` および `executeBuiltin()` から確認した全コマンド：

```
bg, ch, ch_anim, ch_hide, ch_clear,
bgm, bgm_stop, se, voice,
wait, waitclick,
timeline, timeline_play,
battle,
jump, call, ret
```

### KSC 固有機能

- 変数（代入・複合代入）
- 条件分岐（if / else if / else）
- 選択肢（choice、条件付き選択肢）
- 関数定義（`def`：戻り値あり）
- サブルーチン定義（`sub`：戻り値なし）
- 変数補間（ダイアローグ内の `{varName}`）

## 教訓

- `.ks`（コンパイラ）と `.ksc`（インタープリタ）は別物。両形式は共存しており作者が選択して使用する。文書上でも明確に区別する必要がある
- KS の `@wait` は秒、KSC の `wait()` はミリ秒という単位違いはバグの原因になりやすい
- KSC のダイアローグブロックは `#` で閉じる必要がある（KS の `#キャラ名` は閉じなし）
- `ch_move` は `IEngineAPI` に定義されているが `executeBuiltin()` に実装がないため、KSC コマンドとしては使用不可
