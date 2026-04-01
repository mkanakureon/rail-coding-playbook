# VSCode 拡張機能設計: KS/KSC Language Support

**日時:** 2026-02-27
**対象:** `.ks` (TyranoScript 風) / `.ksc` (TypeScript 風スクリプト)

---

## 1. 概要

kaedevn ビジュアルノベルエンジン用のスクリプト言語 (KS / KSC) に対して、VSCode 上でシンタックスハイライト、スニペット、自動補完、ホバーヘルプ等を提供する拡張機能を設計する。

### 拡張機能 ID

`kaedevn.ks-ksc-language`

### ファイル関連付け

| 拡張子 | Language ID | 説明 |
|--------|------------|------|
| `.ks`  | `ks`       | TyranoScript 風コマンドベーススクリプト |
| `.ksc` | `ksc`      | TypeScript 風プログラマブルスクリプト |

---

## 2. KS シンタックスハイライト (TextMate Grammar)

### 2.1 スコープ一覧

| 構文要素 | パターン | TextMate スコープ |
|---------|---------|------------------|
| 行コメント (`//`) | `^//.*$` | `comment.line.double-slash.ks` |
| 行コメント (`;`) | `^;.*$` | `comment.line.semicolon.ks` |
| ラベル | `^\*[\w]+` | `entity.name.label.ks` |
| @コマンド名 | `@(bg\|ch\|ch_anim\|ch_hide\|ch_clear\|bgm\|bgm_stop\|se\|voice\|wait\|battle\|timeline_play\|jump\|l\|p\|r)` | `keyword.command.ks` |
| コマンド引数キーワード | `(fade\|vol\|target\|onWin\|onLose\|slide_left\|slide_right)` | `variable.parameter.ks` |
| 話者名 + `：` | `^[^\s@*;/][^：]*(?=：)` | `entity.name.speaker.ks` |
| 全角コロン `：` | `：` | `punctuation.separator.speaker.ks` |
| 制御キーワード | `\b(choice\|if\|else)\b` | `keyword.control.ks` |
| 文字列 (選択肢) | `"[^"]*"` | `string.quoted.double.ks` |
| 変数名 (代入左辺) | `^[\w]+(?=\s*[\+\-]?=)` | `variable.other.ks` |
| 代入演算子 | `(\+=\|-=\|=)` | `keyword.operator.assignment.ks` |
| 比較演算子 | `(>=\|<=\|>\|<\|==\|!=)` | `keyword.operator.comparison.ks` |
| 論理演算子 | `(&&\|\|\|\|!\|!)` | `keyword.operator.logical.ks` |
| 数値リテラル | `\b\d+(\.\d+)?\b` | `constant.numeric.ks` |
| ブレース | `[{}]` | `punctuation.section.block.ks` |
| 括弧 | `[()]` | `punctuation.section.parens.ks` |
| テキスト (その他) | (default) | `string.unquoted.text.ks` |

### 2.2 テーマカラー推奨

```
コマンド (@bg, @ch...)    → 紫/マゼンタ (keyword)
話者名                    → オレンジ (entity.name)
ラベル (*start)           → 黄 (entity.name.label)
制御キーワード (choice/if) → 青 (keyword.control)
テキスト本文              → 緑 (string)
コメント                  → グレー (comment)
変数                      → 水色 (variable)
数値                      → 橙 (constant.numeric)
```

### 2.3 TextMate Grammar 構造 (ks.tmLanguage.json)

```jsonc
{
  "scopeName": "source.ks",
  "patterns": [
    { "include": "#comment-double-slash" },
    { "include": "#comment-semicolon" },
    { "include": "#label" },
    { "include": "#command" },
    { "include": "#control-flow" },
    { "include": "#variable-assignment" },
    { "include": "#speaker-line" },
    { "include": "#choice-string" },
    { "include": "#text-content" }
  ],
  "repository": {
    "comment-double-slash": {
      "match": "//.*$",
      "name": "comment.line.double-slash.ks"
    },
    "comment-semicolon": {
      "match": "^;.*$",
      "name": "comment.line.semicolon.ks"
    },
    "label": {
      "match": "^\\*[\\w]+",
      "name": "entity.name.label.ks"
    },
    "command": {
      "match": "@(bg|ch_anim|ch_hide|ch_clear|ch|bgm_stop|bgm|se|voice|wait|battle|timeline_play|jump|l|p|r)\\b",
      "captures": {
        "0": { "name": "keyword.command.ks" }
      },
      "patterns": [
        { "include": "#command-params" }
      ]
    },
    "command-params": {
      "match": "\\b(fade|vol|target|onWin|onLose|slide_left|slide_right)\\b",
      "name": "variable.parameter.ks"
    },
    "control-flow": {
      "match": "\\b(choice|if|else)\\b",
      "name": "keyword.control.ks"
    },
    "variable-assignment": {
      "match": "^(\\w+)\\s*(\\+=|-=|=)\\s*(.+)$",
      "captures": {
        "1": { "name": "variable.other.ks" },
        "2": { "name": "keyword.operator.assignment.ks" }
      }
    },
    "speaker-line": {
      "match": "^([^\\s@*;/][^：]*)(：)(.*)$",
      "captures": {
        "1": { "name": "entity.name.speaker.ks" },
        "2": { "name": "punctuation.separator.speaker.ks" },
        "3": { "name": "string.unquoted.dialogue.ks" }
      }
    },
    "choice-string": {
      "match": "\"[^\"]*\"",
      "name": "string.quoted.double.ks"
    }
  }
}
```

---

## 3. KSC シンタックスハイライト (TextMate Grammar)

### 3.1 スコープ一覧

| 構文要素 | パターン | TextMate スコープ |
|---------|---------|------------------|
| 行コメント | `//.*$` | `comment.line.double-slash.ksc` |
| ブロックコメント | `/\*...\*/` | `comment.block.ksc` |
| ラベル | `^\*[\w]+` | `entity.name.label.ksc` |
| 話者ブロック開始 | `^#(\w+)` | `entity.name.speaker.ksc` |
| 話者ブロック終了 | `^#\s*$` | `punctuation.definition.speaker.end.ksc` |
| 話者ブロック内テキスト | (between `#name` and `#`) | `string.unquoted.dialogue.ksc` |
| 制御キーワード | `if\|else\|for\|while\|switch\|case\|default\|break\|continue\|return\|choice` | `keyword.control.ksc` |
| 宣言キーワード | `let\|const\|function\|def\|sub\|type\|import\|from\|export\|await\|void` | `keyword.other.ksc` |
| リテラルキーワード | `true\|false\|null\|undefined` | `constant.language.ksc` |
| エンジンコマンド (組み込み関数) | `bg\|ch\|ch_anim\|ch_hide\|ch_clear\|bgm\|bgm_stop\|se\|voice\|wait\|waitclick\|jump\|call\|ret\|timeline\|timeline_play\|battle` | `support.function.engine.ksc` |
| エンジン API | `showDialogue\|setBg\|showChar\|showCharAnim\|hideChar\|clearChars\|moveChar\|playBgm\|stopBgm\|fadeBgm\|playSe\|playVoice\|playTimeline\|battleStart\|showChoice\|waitForClick\|setFlag\|getFlag\|giveItem\|takeItem\|hasItem\|screenFilter\|screenFilterClear\|shake` | `support.function.api.ksc` |
| 型名 | `number\|string\|boolean` | `support.type.primitive.ksc` |
| 文字列 (ダブルクォート) | `"[^"]*"` | `string.quoted.double.ksc` |
| 文字列 (シングルクォート) | `'[^']*'` | `string.quoted.single.ksc` |
| テンプレートリテラル | `` `...${expr}...` `` | `string.template.ksc` |
| テンプレート補間 | `\${...}` | `meta.template.expression.ksc` |
| 数値 | `\b\d+(\.\d+)?\b` | `constant.numeric.ksc` |
| 関数呼び出し | `\w+(?=\()` | `entity.name.function.ksc` |
| 変数 (代入左辺) | `(?<=let\|const)\s+\w+` | `variable.other.readwrite.ksc` |
| 演算子 | `+=\|-=\|*=\|/=\|%=\|==\|!=\|>=\|<=\|&&\|\|\|\|=>\|[+\-*/%<>=!?|]` | `keyword.operator.ksc` |
| ブレース/括弧 | `[{}()\[\]]` | `punctuation.*.ksc` |
| 型注釈コロン | `:(?=\s*(number\|string\|boolean))` | `punctuation.type-annotation.ksc` |

### 3.2 話者ブロック (特殊スコープ)

KSC の話者ブロック (`#name ... #`) は TextMate の begin/end ルールで実装する。

```jsonc
{
  "begin": "^(#)(\\w+)\\s*$",
  "beginCaptures": {
    "1": { "name": "punctuation.definition.speaker.begin.ksc" },
    "2": { "name": "entity.name.speaker.ksc" }
  },
  "end": "^#\\s*$",
  "endCaptures": {
    "0": { "name": "punctuation.definition.speaker.end.ksc" }
  },
  "contentName": "string.unquoted.dialogue.ksc",
  "patterns": [
    {
      "match": "\\{([^}]+)\\}",
      "captures": {
        "0": { "name": "meta.interpolation.ksc" },
        "1": { "name": "meta.embedded.expression.ksc" }
      }
    }
  ]
}
```

### 3.3 テーマカラー推奨 (KSC)

```
制御キーワード (if, for, while)      → 紫 (keyword.control)
宣言キーワード (let, function, def)  → 青 (keyword.other)
エンジンコマンド (bg, ch, bgm...)    → シアン (support.function.engine)
エンジン API (showDialogue...)       → シアン (support.function.api)
話者名 (#hero)                       → オレンジ (entity.name.speaker)
ラベル (*start)                      → 黄 (entity.name.label)
対話テキスト                         → 緑 (string)
テンプレート補間 ${...}              → 赤 (meta.template.expression)
型名                                 → 青緑 (support.type)
コメント                             → グレー (comment)
数値                                 → 橙 (constant.numeric)
```

---

## 4. スニペット

### 4.1 KS スニペット

| プレフィックス | 展開 | 説明 |
|--------------|------|------|
| `@bg` | `@bg ${1:id} fade ${2:500}` | 背景設定 |
| `@ch` | `@ch ${1:name} ${2:normal} ${3:center} fade ${4:300}` | キャラクター表示 |
| `@chh` | `@ch_hide ${1:name} fade ${2:300}` | キャラクター非表示 |
| `@bgm` | `@bgm ${1:id} vol ${2:80}` | BGM 再生 |
| `@se` | `@se ${1:id}` | SE 再生 |
| `@voice` | `@voice ${1:id}` | ボイス再生 |
| `@wait` | `@wait ${1:0.5}` | ウェイト |
| `@battle` | `@battle ${1:troopId} onWin=${2:win_label} onLose=${3:lose_label}` | バトル開始 |
| `choice` | 選択肢ブロックテンプレート | choice ブロック |
| `ifthen` | if/else テンプレート | 条件分岐 |
| `scene` | シーンテンプレート (label + bg + text) | 新規シーン |
| `dlg` | `${1:キャラ名}：${2:セリフ}@l` | セリフ行 |

#### choice スニペット詳細

```json
{
  "KS Choice Block": {
    "prefix": "choice",
    "body": [
      "choice {",
      "  \"${1:選択肢1}\" {",
      "    ${2:// 処理}",
      "    @l",
      "  }",
      "  \"${3:選択肢2}\" {",
      "    ${4:// 処理}",
      "    @l",
      "  }",
      "}"
    ]
  }
}
```

#### scene スニペット詳細

```json
{
  "KS New Scene": {
    "prefix": "scene",
    "body": [
      "*${1:scene_name}",
      "@bg ${2:background_id} fade 500",
      "",
      "${3:ナレーション}@l",
      ""
    ]
  }
}
```

### 4.2 KSC スニペット

| プレフィックス | 展開 | 説明 |
|--------------|------|------|
| `bg` | `bg("${1:id}", "${2:fade}")` | 背景設定 |
| `ch` | `ch("${1:name}", "${2:normal}", "${3:center}", ${4:300})` | キャラクター表示 |
| `chh` | `ch_hide("${1:name}", ${2:300})` | キャラクター非表示 |
| `bgm` | `bgm("${1:id}", ${2:0.8}, ${3:500})` | BGM 再生 |
| `se` | `se("${1:id}")` | SE 再生 |
| `voice` | `voice("${1:id}")` | ボイス再生 |
| `dlg` | 話者ブロックテンプレート | セリフブロック |
| `choice` | 選択肢ブロックテンプレート | choice ブロック |
| `def` | `def` 関数テンプレート | 関数定義 (interpreter) |
| `sub` | `sub` サブルーチンテンプレート | サブルーチン (interpreter) |
| `fn` | `function` テンプレート | 関数定義 (compiler) |
| `ife` | if/else テンプレート | 条件分岐 |
| `forl` | for ループテンプレート | for ループ |
| `scene` | シーンテンプレート | 新規シーン |
| `battle` | バトル + 結果分岐テンプレート | バトルシーン |
| `imp` | `import { $1 } from "$2"` | インポート |

#### dlg スニペット詳細

```json
{
  "KSC Dialogue Block": {
    "prefix": "dlg",
    "body": [
      "#${1:speaker}",
      "${2:台詞の内容}",
      "#"
    ]
  }
}
```

#### battle スニペット詳細

```json
{
  "KSC Battle Scene": {
    "prefix": "battle",
    "body": [
      "let result = await battleStart(\"${1:troopId}\")",
      "if (result == \"win\") {",
      "  ${2:// 勝利時処理}",
      "} else {",
      "  ${3:// 敗北時処理}",
      "}"
    ]
  }
}
```

---

## 5. 自動補完 (IntelliSense)

### 5.1 コマンド補完

**KS:** `@` 入力時にコマンド一覧をサジェスト。各候補にパラメータヒントを付与。

```
@bg   → 背景設定 (id [fade ms] [slide_left ms] [slide_right ms])
@ch   → キャラクター表示 (name pose position [fade ms])
@bgm  → BGM再生 (id [vol 0-100] [fade ms])
...
```

**KSC:** 関数名入力時にエンジンコマンド一覧をサジェスト。シグネチャ情報付き。

```
bg(id, effect?)         → 背景設定
ch(id, pose, pos?, ms?) → キャラクター表示
showDialogue(speaker, lines) → ダイアログ表示
...
```

### 5.2 パラメータ値補完

| コンテキスト | 補完候補 |
|------------|---------|
| `@ch ... <position>` | `left`, `center`, `right`, `L`, `C`, `R` |
| `@bg ... <effect>` | `fade`, `slide_left`, `slide_right` |
| `ch("name", "pose", <pos>)` | `"left"`, `"center"`, `"right"` |
| `bg("id", <effect>)` | `"fade"`, `"slide_left"`, `"slide_right"` |

### 5.3 アセット ID 補完 (将来拡張)

プロジェクトの `assets/` ディレクトリまたは manifest ファイルを読み取り、bg / se / bgm のアセット ID をサジェスト。

```
@bg <TAB> → room_day, room_night, school_gate, ...
@bgm <TAB> → main_theme, battle_bgm, sad_piano, ...
```

### 5.4 ラベル補完

同一ファイル内の `*label` 定義を収集し、`@jump target=` や `jump("` の入力時にサジェスト。

```
@jump target=<TAB> → start, chapter1, ending, ...
jump("<TAB>")      → start, chapter1, ending, ...
```

### 5.5 キャラクター / 表情補完 (将来拡張)

プロジェクトのキャラクター定義から、`@ch` / `ch()` の名前・ポーズ引数を補完。

---

## 6. ホバー情報 (Hover Provider)

### 6.1 コマンドホバー

`@bg` にホバーすると:

```
@bg — 背景を設定します

パラメータ:
  id       (必須) 背景アセット ID
  fade     (任意) フェード時間 (ms)
  slide_left  (任意) 左スライド (ms)
  slide_right (任意) 右スライド (ms)

例: @bg room_day fade 500
```

### 6.2 エンジン API ホバー (KSC)

`battleStart` にホバーすると:

```
battleStart(troopId: string): Promise<"win" | "lose">

指定した敵グループとバトルを開始します。
結果は "win" または "lose" で返ります。

例:
  let result = await battleStart("boss_01")
  if (result == "win") { ... }
```

### 6.3 キーワードホバー

`choice` にホバーすると:

```
choice — 選択肢ブロック

プレイヤーに選択肢を提示します。
各選択肢に条件を付けることができます。

KS: choice { "テキスト" { ... } }
KSC: choice { "テキスト" { ... } }
```

---

## 7. 診断 (Diagnostics / Linting)

### 7.1 基本チェック (リアルタイム)

| チェック | レベル | 説明 |
|--------|--------|------|
| 未知の @コマンド | Warning | 定義済みコマンド一覧にないコマンド |
| 必須引数の欠如 | Error | `@ch` にキャラ名がない等 |
| 未定義ラベル参照 | Warning | `@jump target=xxx` の xxx が同ファイルにない |
| 重複ラベル | Error | 同一ファイル内に同名ラベルが 2 つ以上 |
| 空の choice ブロック | Warning | 選択肢が 0 個 |
| 未閉じブレース | Error | `{` と `}` の対応が取れない |
| 未閉じ話者ブロック | Error | `#name` があるが対応する `#` がない (KSC) |

### 7.2 高度なチェック (保存時)

| チェック | レベル | 説明 |
|--------|--------|------|
| 未使用ラベル | Hint | 定義されたが参照されていないラベル |
| 到達不能コード | Hint | `@jump` の直後のコード |
| 型不一致 (KSC) | Error | `let x: number = "hello"` |
| 未使用変数 (KSC) | Warning | 代入されたが参照されない変数 |

---

## 8. その他の便利機能

### 8.1 ブラケットペアリング

KS/KSC 両方で `{}` `()` `[]` のペアリングと自動閉じ。

### 8.2 コメントトグル

- KS: `Ctrl+/` → `// ` を行頭に追加/削除
- KSC: `Ctrl+/` → `// `、`Shift+Alt+A` → `/* */`

### 8.3 折りたたみ (Folding)

| 折りたたみ対象 | KS | KSC |
|--------------|----|----|
| choice ブロック | `choice { ... }` | `choice { ... }` |
| if/else ブロック | `if (...) { ... }` | `if (...) { ... }` |
| 話者ブロック | — | `#name ... #` |
| 関数定義 | — | `function/def/sub ... { ... }` |
| ラベルセクション | `*label ... *next_label` | `*label ... *next_label` |
| コメント | 連続コメント行 | `/* ... */` |

### 8.4 アウトライン (Document Symbols)

ファイル内の構造を Outline パネルに表示:

**KS:**
```
├── *start                    (Label)
│   ├── @bg room_day          (Command)
│   ├── 主人公：セリフ...      (Dialogue)
│   └── choice { ... }        (Choice)
├── *chapter2                 (Label)
└── *ending                   (Label)
```

**KSC:**
```
├── import { ... }            (Import)
├── *start                    (Label)
├── function calcDamage(...)  (Function)
├── def mood(aff)             (Function)
├── sub greeting()            (Function)
├── *battle_scene             (Label)
└── #hero                     (Dialogue)
```

### 8.5 定義へ移動 (Go to Definition)

| コンテキスト | ジャンプ先 |
|------------|----------|
| `@jump target=label` | `*label` の行 |
| `jump("label")` / `call("label")` | `*label` の行 |
| 関数呼び出し `func()` | `def func` / `function func` の定義行 |
| `import { x } from "mod"` | 対象ファイルの `export` |

### 8.6 参照検索 (Find References)

ラベル / 関数名 / 変数名に対して、ファイル内・ワークスペース内の全参照箇所を検索。

### 8.7 リネーム (Rename Symbol)

ラベル / 関数名 / 変数名の一括リネーム。

### 8.8 カラーデコレーター

KSC の話者ブロック `#name ... #` を薄い背景色で視覚的に強調:

```
│ #hero                           ← オレンジ背景帯
│ おはよう。                       ← 薄いオレンジ背景
│ 今日もいい天気だな。             ← 薄いオレンジ背景
│ #                               ← オレンジ背景帯
```

話者ごとに色を変える (設定可能):

```jsonc
{
  "ksc.speakerColors": {
    "hero": "#FFA50020",
    "heroine": "#FF69B420",
    "narrator": "#87CEEB20"
  }
}
```

### 8.9 プレビューコマンド

`Ctrl+Shift+P` → `KS: Preview Scene` で、現在のカーソル位置のシーンをプレビューウィンドウ (WebView) に表示。エンジンの WebEngine を組み込み、実際のレンダリング結果を確認できる (将来拡張)。

---

## 9. Language Configuration

### 9.1 KS (language-configuration.json)

```jsonc
{
  "comments": {
    "lineComment": "//"
  },
  "brackets": [
    ["{", "}"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "(", "close": ")" },
    { "open": "\"", "close": "\"" }
  ],
  "surroundingPairs": [
    { "open": "{", "close": "}" },
    { "open": "(", "close": ")" },
    { "open": "\"", "close": "\"" }
  ],
  "folding": {
    "markers": {
      "start": "^\\s*(choice|if)\\s.*\\{\\s*$",
      "end": "^\\s*\\}"
    }
  },
  "indentationRules": {
    "increaseIndentPattern": "\\{\\s*$",
    "decreaseIndentPattern": "^\\s*\\}"
  },
  "wordPattern": "[\\w@*]+"
}
```

### 9.2 KSC (language-configuration.json)

```jsonc
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [
    ["{", "}"],
    ["(", ")"],
    ["[", "]"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "(", "close": ")" },
    { "open": "[", "close": "]" },
    { "open": "\"", "close": "\"" },
    { "open": "'", "close": "'" },
    { "open": "`", "close": "`" },
    { "open": "#", "close": "#", "notIn": ["string", "comment"] }
  ],
  "surroundingPairs": [
    { "open": "{", "close": "}" },
    { "open": "(", "close": ")" },
    { "open": "[", "close": "]" },
    { "open": "\"", "close": "\"" },
    { "open": "'", "close": "'" },
    { "open": "`", "close": "`" }
  ],
  "folding": {
    "markers": {
      "start": "^\\s*(choice|if|for|while|switch|function|def|sub)\\b.*\\{\\s*$",
      "end": "^\\s*\\}"
    }
  },
  "indentationRules": {
    "increaseIndentPattern": "(\\{|^#\\w+)\\s*$",
    "decreaseIndentPattern": "^\\s*(\\}|#)\\s*$"
  },
  "wordPattern": "[\\w$]+"
}
```

---

## 10. 拡張機能ディレクトリ構造

```
kaedevn-ks-ksc/
├── package.json                    # 拡張機能マニフェスト
├── README.md
├── CHANGELOG.md
├── syntaxes/
│   ├── ks.tmLanguage.json          # KS TextMate grammar
│   └── ksc.tmLanguage.json         # KSC TextMate grammar
├── language-configuration/
│   ├── ks.language-configuration.json
│   └── ksc.language-configuration.json
├── snippets/
│   ├── ks.snippets.json
│   └── ksc.snippets.json
├── src/
│   ├── extension.ts                # エントリポイント
│   ├── providers/
│   │   ├── ksCompletionProvider.ts  # KS 自動補完
│   │   ├── kscCompletionProvider.ts # KSC 自動補完
│   │   ├── hoverProvider.ts         # ホバー情報 (共通)
│   │   ├── definitionProvider.ts    # 定義へ移動
│   │   ├── referenceProvider.ts     # 参照検索
│   │   ├── symbolProvider.ts        # アウトライン
│   │   ├── diagnosticProvider.ts    # 診断
│   │   ├── foldingProvider.ts       # 折りたたみ
│   │   └── renameProvider.ts        # リネーム
│   ├── data/
│   │   ├── ksCommands.ts            # KS コマンド定義データ
│   │   ├── kscBuiltins.ts           # KSC 組み込み関数定義
│   │   └── engineApi.ts             # IEngineAPI メソッド定義
│   └── utils/
│       ├── parser.ts                # 簡易パーサー (ラベル/変数収集)
│       └── assetResolver.ts         # アセット ID 解決 (将来)
├── themes/
│   └── kaedevn-dark.json            # 推奨ダークテーマ (任意)
└── tsconfig.json
```

---

## 11. 実装優先度

### Phase 1: MVP (最小限の価値)

- [x] TextMate Grammar (KS + KSC) — シンタックスハイライト
- [x] Language Configuration — コメントトグル、ブラケットペアリング、自動閉じ
- [x] 基本スニペット (コマンド系)

### Phase 2: 生産性向上

- [ ] コマンド / 関数の自動補完
- [ ] ホバー情報
- [ ] アウトライン (Document Symbols)
- [ ] 折りたたみ

### Phase 3: 品質向上

- [ ] 基本診断 (未知コマンド、ブレース不一致)
- [ ] ラベル定義へ移動
- [ ] ラベル参照検索
- [ ] リネーム

### Phase 4: 高度な機能

- [ ] アセット ID 補完
- [ ] キャラクター/表情補完
- [ ] 話者ブロックのカラーデコレーション
- [ ] KSC 型チェック (簡易)

### Phase 5: プレビュー連携

- [ ] WebView によるシーンプレビュー
- [ ] エンジン連携デバッグ

---

## 12. package.json 骨格

```jsonc
{
  "name": "kaedevn-ks-ksc",
  "displayName": "KS/KSC Language Support",
  "description": "Syntax highlighting, snippets, and IntelliSense for kaedevn visual novel scripts (.ks, .ksc)",
  "version": "0.1.0",
  "publisher": "kaedevn",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Snippets"],
  "activationEvents": [
    "onLanguage:ks",
    "onLanguage:ksc"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "ks",
        "aliases": ["KS", "KaedeScript"],
        "extensions": [".ks"],
        "configuration": "./language-configuration/ks.language-configuration.json"
      },
      {
        "id": "ksc",
        "aliases": ["KSC", "KaedeScript Compiled"],
        "extensions": [".ksc"],
        "configuration": "./language-configuration/ksc.language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "ks",
        "scopeName": "source.ks",
        "path": "./syntaxes/ks.tmLanguage.json"
      },
      {
        "language": "ksc",
        "scopeName": "source.ksc",
        "path": "./syntaxes/ksc.tmLanguage.json"
      }
    ],
    "snippets": [
      { "language": "ks", "path": "./snippets/ks.snippets.json" },
      { "language": "ksc", "path": "./snippets/ksc.snippets.json" }
    ],
    "configuration": {
      "title": "KS/KSC",
      "properties": {
        "ksc.speakerColors": {
          "type": "object",
          "default": {},
          "description": "話者名ごとの背景色 (例: { \"hero\": \"#FFA50020\" })"
        },
        "ksc.diagnostics.enabled": {
          "type": "boolean",
          "default": true,
          "description": "リアルタイム診断の有効/無効"
        }
      }
    }
  }
}
```
