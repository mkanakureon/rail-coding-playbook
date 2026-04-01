# KNF インタプリタ仕様書（作成途中）

KNF（`.ksc`）スクリプトを実行するインタプリタの仕様書です。
Op 命令セット（JSON IR）とは別系統の、テキストベーススクリプトを直接実行するランタイムです。

> **ステータス:** Phase 7-3 まで実装済み（107テスト通過）。一部の再帰テスト・大規模ループテストは未解決。

## アーキテクチャ概要

```
.ksc スクリプト
  │
  ▼
┌───────────┐
│ Tokenizer │  式文字列をトークン列に分割
└───────────┘
  │
  ▼
┌───────────┐
│  Parser   │  行単位で分類・ブロック構造解析
└───────────┘
  │
  ▼
┌─────────────┐
│ Interpreter │  メインループで逐次実行
│  ├─ Evaluator   │  式の評価（再帰下降パーサー）
│  ├─ GameState   │  変数・スコープ・コールスタック管理
│  └─ Debugger    │  デバッグ機能
└─────────────┘
  │
  ▼
┌────────────┐
│ IEngineAPI │  プラットフォーム抽象化（描画・音声・UI）
└────────────┘
```

## コアモジュール

### Interpreter（1039行）

メインの実行エンジン。`.ksc` スクリプトを行単位で解析・実行します。

**主要メソッド:**

| メソッド | 説明 |
|---------|------|
| `run(script)` | スクリプト全体をパース・実行 |
| `stop()` | 実行を停止 |
| `jumpTo(label)` | 指定ラベルへジャンプ |
| `getState()` | 現在の PC・変数・コールスタック深度を返す |
| `getDebugger()` | デバッガインスタンスを取得 |

**内部実行フロー:**

1. `mainLoop()` が行単位で `step()` を呼び出し
2. `step()` が行の種別に応じてハンドラを振り分け
3. ダイアログ → `handleDialogue()`、式 → `handleExpression()`
4. ビルトインコマンドは `executeBuiltin()` で `IEngineAPI` に委譲

### Parser（218行）

行レベルの構文解析を行います。

**行タイプ分類:**

| LineType | パターン | 説明 |
|----------|---------|------|
| `DialogueStart` | `#speaker` | ダイアログブロック開始 |
| `DialogueEnd` | `#` | ダイアログブロック終了 |
| `Label` | `*label_name` | ラベル定義 |
| `Comment` | `// ...` | コメント |
| `Empty` | （空行） | 空行 |
| `Expression` | その他 | 式・コマンド |

**主要メソッド:**

| メソッド | 説明 |
|---------|------|
| `classifyLine(line)` | 行の種別を判定 |
| `buildLabelMap(lines)` | ラベル名→行番号のマップを構築 |
| `findBlockEnd(lines, start)` | `{` に対応する `}` を検索 |
| `findDialogueEnd(lines, start)` | ダイアログブロックの終端を検索 |
| `parseFunctionDef(lines, start)` | `def`/`sub` 定義をパース |
| `parseChoice(lines, start)` | `choice` ブロックをパース |

### Evaluator（495行）

式を評価する再帰下降パーサーです。

**対応演算:**

| 種別 | 演算子 |
|------|--------|
| 算術 | `+`, `-`, `*`, `/`, `%` |
| 比較 | `==`, `!=`, `>`, `>=`, `<`, `<=` |
| 論理 | `&&`, `\|\|`, `!` |
| 代入 | `=`, `+=`, `-=`, `*=`, `/=` |
| グループ | `(`, `)` |

**主要メソッド:**

| メソッド | 説明 |
|---------|------|
| `evaluate(expr, state)` | 式を評価して値を返す |
| `executeAssignment(expr, state)` | 代入文を実行 |
| `evaluateCondition(expr, state)` | 条件式を真偽値で評価 |
| `interpolate(text, state)` | `{expr}` パターンの文字列補間 |

**演算子優先順位（低→高）:**

1. `\|\|`（論理OR）
2. `&&`（論理AND）
3. `==`, `!=`（等値）
4. `>`, `>=`, `<`, `<=`（比較）
5. `+`, `-`（加減）
6. `*`, `/`, `%`（乗除）
7. `!`, `-`（単項）
8. リテラル・変数・関数呼び出し

### Tokenizer（332行）

式文字列をトークン列に分割するレキサーです。

**トークン型:**

| TokenType | 例 |
|-----------|-----|
| `Number` | `42`, `3.14` |
| `String` | `"hello"`, `'world'` |
| `Boolean` | `true`, `false` |
| `Identifier` | `count`, `playerName` |
| `Keyword` | `if`, `else`, `while`, `def`, `sub`, `return`, `choice` |
| `Operator` | `+`, `-`, `==`, `&&` |
| `Assign` | `=`, `+=`, `-=`, `*=`, `/=` |
| `LeftParen` / `RightParen` | `(`, `)` |
| `LeftBrace` / `RightBrace` | `{`, `}` |
| `Comma` | `,` |

### GameState（123行）

ランタイムの全状態を管理します。

**フィールド:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `variables` | `Map` | グローバル変数 |
| `localScopes` | `Map[]` | ローカルスコープのスタック |
| `callStack` | `CallFrame[]` | コールスタック |
| `labelMap` | `Map<string, number>` | ラベル→行番号マップ |
| `functions` | `Map<string, FunctionDef>` | `def` 定義（値を返す） |
| `subroutines` | `Map<string, FunctionDef>` | `sub` 定義（値を返さない） |

**スコープ解決:** `getVar` はローカルスコープ（後入れ優先）→ グローバルの順で検索。

## IEngineAPI

プラットフォーム非依存の描画・音声・UI インターフェースです。

| メソッド | 説明 |
|---------|------|
| `showDialogue(speaker, lines)` | ダイアログ表示 |
| `setBg(name, effect?)` | 背景設定 |
| `showChar(name, pose, position?)` | キャラクター表示 |
| `hideChar(name)` | キャラクター非表示 |
| `moveChar(name, position, time)` | キャラクター移動 |
| `playBgm(name)` | BGM 再生 |
| `stopBgm()` | BGM 停止 |
| `fadeBgm(time)` | BGM フェードアウト |
| `playSe(name)` | 効果音再生 |
| `playTimeline(name)` | タイムライン再生 |
| `showChoice(options)` | 選択肢表示（`Promise<number>` を返す） |
| `waitForClick()` | クリック待ち |
| `wait(ms)` | ミリ秒待機 |

## ビルトインコマンド

Interpreter が直接認識し、`IEngineAPI` に委譲するコマンドです。

| コマンド | 引数 | IEngineAPI メソッド |
|---------|------|-------------------|
| `bg(name)` | 背景名 | `setBg` |
| `ch(name, pose, pos?)` | キャラ名, ポーズ, 位置 | `showChar` |
| `ch_hide(name)` | キャラ名 | `hideChar` |
| `bgm(name)` | BGM名 | `playBgm` |
| `bgm_stop()` | ― | `stopBgm` |
| `se(name)` | SE名 | `playSe` |
| `wait(ms)` | ミリ秒 | `wait` |
| `waitclick()` | ― | `waitForClick` |
| `timeline(name)` | タイムライン名 | `playTimeline` |
| `jump(label)` | ラベル名 | PC を移動 |
| `call(label)` | ラベル名 | コールスタックに積んでジャンプ |
| `ret()` | ― | コールスタックから復帰 |

## スクリプト構文

### ダイアログ

```
#太郎
こんにちは！
今日はいい天気ですね。
#
```

`#speaker` で開始、`#` で終了。間の行がダイアログテキストとして表示されます。

### 条件分岐

```
if (flag == 1) {
  #太郎
  フラグが立っています。
  #
} else if (flag == 2) {
  #太郎
  フラグは2です。
  #
} else {
  #太郎
  フラグは立っていません。
  #
}
```

### 選択肢

```
choice {
  "はい" {
    yes_count += 1
  }
  "いいえ" {
    no_count += 1
  }
  "条件付き" if (flag == 1) {
    // flag が 1 の時のみ表示
  }
}
```

### ユーザー定義関数

**def（値を返す）:**

```
def add(a, b) {
  return a + b
}

result = add(3, 5)
```

**sub（値を返さない）:**

```
sub greet(name) {
  greeting = "Hello, " + name
}

greet("World")
```

- 再帰呼び出し対応（深度上限: 16）
- ローカルスコープで引数を管理

### 文字列補間

ダイアログ内で `{式}` を使い、変数や式の値を埋め込めます。

```
count = 42
#ナレーター
現在のカウントは{count}です。
計算結果: {count * 2 + 1}
#
```

## デバッグ機能

### 変数ウォッチ

```
debugger.watchVariable("hp")
// ... 実行 ...
debugger.getVariableHistory("hp")
// → [{ line: 5, oldValue: undefined, newValue: 100, timestamp: ... }, ...]
```

### ブレークポイント

```
debugger.addBreakpoint(10)                    // 行10で停止
debugger.addBreakpoint(20, "hp < 50")         // 条件付き
debugger.toggleBreakpoint(10)                 // 有効/無効切替
```

### トレースログ

```
debugger.enableTrace()
// ... 実行 ...
debugger.getTraceLog()
// → [{ type: "FunctionCall", line: 5, data: { name: "add", args: [3, 5] } }, ...]
```

### デバッグイベント

| DebugEventType | 発火タイミング |
|---------------|-------------|
| `VariableChanged` | 変数の値が変更された |
| `Breakpoint` | ブレークポイントに到達 |
| `StepComplete` | ステップ実行完了 |
| `FunctionCall` | 関数呼び出し |
| `FunctionReturn` | 関数からの復帰 |

## エラーハンドリング

### エラー種別

| ErrorType | 説明 |
|-----------|------|
| `SyntaxError` | 構文エラー |
| `ReferenceError` | 未定義の変数・関数への参照 |
| `TypeError` | 型の不一致 |
| `RuntimeError` | 実行時エラー（ゼロ除算など） |
| `StackOverflow` | 再帰深度超過（上限: 16） |
| `FileNotFound` | ファイルが見つからない |

### Levenshtein サジェスト

未定義の変数・関数を参照した際、編集距離3以内の候補を提案します。

```
Error: 変数 'coutn' は定義されていません
  もしかして: 'count' ?
```

### スタックトレース

関数呼び出しの履歴をスタックトレースとして表示します。

```
Error at line 15: ...
  at add() (line 10)
  at calculate() (line 5)
  at <main> (line 1)
```

## 実装フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | 基本実行（ダイアログ、ビルトインコマンド） | 完了 |
| Phase 2 | ラベル・ジャンプ・call/ret | 完了 |
| Phase 3 | 式評価（算術・比較・論理・代入） | 完了 |
| Phase 4 | if/else/choice | 完了 |
| Phase 5 | ユーザー定義関数 def/sub | 完了（再帰テスト一部未解決） |
| Phase 6 | 文字列補間 | 完了 |
| Phase 7-1 | エラーハンドリング | 完了 |
| Phase 7-2 | デバッグモード | 完了 |
| Phase 7-3 | 統合テスト | 完了（107テスト通過） |

## 既知の問題

- Phase 5 の再帰テスト（fibonacci 等の二重再帰呼び出し）がハングする
- 大規模ループ + 関数呼び出しのテストがタイムアウトする
- ダイアログ内の文字列補間統合テストが一部スキップ（TODO）
- `playTimeline()` は未実装
