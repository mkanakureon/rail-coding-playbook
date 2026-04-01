---
title: "実践ログ — サンプルスクリプト 8 本を整理・新規作成"
emoji: "📝"
type: "idea"
topics: ["claudecode", "ゲーム開発", "OSS"]
published: false
---

## はじめに

OSS として公開するパッケージに、サンプルコードは欠かせない。kaedevn インタプリタの `packages/interpreter/examples/` には、開発の過程で作られたデモスクリプトが散らばっていた。

```
# Before
basic.ksc
phase2-demo.ksc
phase3-demo.ksc
demo_scenario.ksc
```

ファイル名に統一感がない。何がどのレベルの機能を使っているかもわからない。`phase2-demo` と言われても、外部の人には意味が通じない。

これを 1 セッションで整理・拡充した。

## Before / After

### Before（4 ファイル）

| ファイル | 内容 |
|----------|------|
| `basic.ksc` | 基本コマンドのデモ |
| `phase2-demo.ksc` | ラベルとジャンプ |
| `phase3-demo.ksc` | 変数と式評価 |
| `demo_scenario.ksc` | 完全なゲームシナリオ |

### After（8 ファイル）

| ファイル | 内容 |
|----------|------|
| `01-hello.ksc` | 基本コマンドデモ |
| `02-labels.ksc` | ラベルとジャンプ |
| `03-variables.ksc` | 変数と式評価 |
| `04-full-scenario.ksc` | 完全なゲームシナリオ |
| `05-conditionals.ksc` | 条件分岐（新規） |
| `06-choices.ksc` | 選択肢（新規） |
| `07-functions.ksc` | 関数・サブルーチン（新規） |
| `08-commands.ksc` | 組み込みコマンド一覧（新規） |

変更点は 3 つ。

1. **番号付きリネーム**: `basic.ksc` → `01-hello.ksc`
2. **4 本新規作成**: 条件分岐、選択肢、関数、コマンド一覧
3. **全参照更新**: テスト、デモスクリプト、ドキュメント内のファイル名参照を更新

## リネームの設計

### なぜ番号を付けたか

OSS のサンプルは「学習パス」として機能する。番号があれば、01 から順に読んでいけばいい。

```
01-hello     → まずはこれ
02-labels    → ジャンプを覚える
03-variables → 変数を使う
04-full      → 全部入り
05-条件分岐  → if/else
06-選択肢    → choice
07-関数      → def/sub
08-コマンド  → リファレンス
```

`01-hello` から始めて、`04-full-scenario` で一通りの機能を見る。`05` 以降は個別機能の深掘り。`08-commands` は全コマンドのリファレンスとして使える。

### なぜ 04 が「完全シナリオ」なのか

順番としては 04 は早すぎるように見えるかもしれない。しかし、`04-full-scenario.ksc` は「KSC でこんなことができる」を示す **ショーケース** だ。01-03 で基本を掴んだら、04 で全体像を見る。05-08 で個別機能を深掘りする。この流れが自然だと判断した。

## 新規作成した 4 ファイル

### 05-conditionals.ksc — 条件分岐

```
// テストの成績発表
score = 78
bonus = 5

// 基本の if
if (score >= 80) {
  #teacher
  素晴らしい成績です！
  #
}

// if / else
if (score >= 60) {
  #teacher
  合格です
  #
} else {
  #teacher
  残念ながら不合格です
  #
}

// 多段分岐
if (score >= 90) {
  rank = "S"
} else if (score >= 80) {
  rank = "A"
} else if (score >= 70) {
  rank = "B"
} else {
  rank = "C"
}
```

条件分岐の全パターンを網羅する。基本の `if` → `if/else` → `if/else if/else` → ネスト → 論理演算子（`&&`, `||`, `!`）と段階的に進む。

ストーリーは「テストの成績発表」。点数からランク判定、追加課題ボーナスの適用、参加許可の条件チェックを行う。ゲームのシステム処理でよくあるパターンだ。

### 06-choices.ksc — 選択肢

```
// 放課後の友人との行動
trust = 5

choice {
  "一緒に帰ろう" {
    trust += 2
    jump("walk_together")
  }
  "図書室で勉強しよう" {
    trust += 1
    jump("library")
  }
  "秘密の場所に行こう" if (trust >= 8) {
    trust += 3
    jump("secret_place")
  }
  "用事があるから..." {
    trust -= 1
    jump("decline")
  }
}
```

選択肢のサンプルで重要なのは **条件付き選択肢** だ。`"秘密の場所に行こう" if (trust >= 8)` は、信頼度が 8 以上のときだけ表示される。ビジュアルノベルでは「前の選択の結果で選択肢が変わる」のは定番の仕組みだ。

ストーリーは「放課後の友人との行動」。選択によって信頼度が変化し、親友ルート / 友人ルート / 知人ルートに分岐する。

### 07-functions.ksc — 関数・サブルーチン

```
// RPG 風クエストシステム

// 戻り値のある関数
def calc_score(base, bonus) {
  result = base * 2 + bonus
  return result
}

// 副作用のあるサブルーチン
sub show_reward(item) {
  se("reward")
  #narrator
  {item} を手に入れた！
  #
}

// ネスト呼び出し
def get_rank(score) {
  if (score >= 100) {
    return "S"
  }
  if (score >= 70) {
    return "A"
  }
  return "B"
}

// 文字列補間内での関数呼び出し
#narrator
あなたのスコアは {calc_score(30, 10)} 点、ランクは {get_rank(calc_score(30, 10))} です。
#
```

KSC には `def`（戻り値あり）と `sub`（副作用用）の 2 種類がある。両方の使い方を示す。

特に注目すべきは **文字列補間内での関数呼び出し** だ。`{calc_score(30, 10)}` のように、セリフの中で直接関数を呼べる。さらに `{get_rank(calc_score(30, 10))}` のようにネストもできる。

### 08-commands.ksc — 組み込みコマンド一覧

```
// 全 17 の組み込みコマンドを網羅

// ===== 背景 =====
bg("classroom")                    // 通常
bg("school_corridor", "fade")      // エフェクト付き

// ===== キャラクター =====
ch("hero", "normal")               // 名前、ポーズ
ch("hero", "smile", "center")      // 位置指定
ch("heroine", "normal", "right", 500)  // フェード時間
ch_anim("heroine", "wave", "right")    // アニメーション
ch_hide("hero")                    // 非表示
ch_hide("heroine", 300)            // フェード非表示
ch_clear()                         // 全員非表示
ch_clear(500)                      // フェード全員非表示

// ===== BGM =====
bgm("daily_life")                  // 基本再生
bgm("battle_theme", 0.8)           // 音量指定
bgm("emotional", 0.6, 1000)        // 音量 + フェード
bgm_stop()                         // 停止
bgm_stop(1000)                     // フェード停止

// ===== 効果音・ボイス =====
se("click")                        // 基本
se("explosion", 0.5)               // 音量指定
voice("hero_line_001")             // ボイス

// ===== 待機 =====
wait(1000)                         // 時間待機
waitclick()                        // クリック待ち

// ===== タイムライン =====
timeline("opening_animation")
timeline_play("camera_pan")

// ===== バトル =====
battle("slime_group")
```

これは **リファレンスとして使う** ファイルだ。全 17 コマンドの全パラメータパターンを一箇所で確認できる。実行するとコマンドが順番に動くが、主な目的は「あのコマンドの書き方なんだっけ？」をすぐ調べられることだ。

## 全参照の更新

ファイル名を変えたら、それを参照している箇所もすべて更新する必要がある。

```
feat: サンプルスクリプトを整理・拡充

- リネーム: basic.ksc→01-hello, phase2-demo→02-labels,
  phase3-demo→03-variables, demo_scenario→04-full-scenario
- 新規: 05-conditionals, 06-choices, 07-functions, 08-commands
- 全参照ファイルを新ファイル名に更新
```

コミットの stat を見ると、16 ファイルが変更されている。

```
packages/interpreter/README.md                    | 228 ++---
packages/interpreter/docs/testing-coverage.md     |   2 +-
packages/interpreter/docs/testing-plan.md         |   2 +-
packages/interpreter/examples/{基本 → 01-hello}   |   0
packages/interpreter/examples/{phase2 → 02-labels}|   0
packages/interpreter/examples/{phase3 → 03-var}   |   0
packages/interpreter/examples/{demo → 04-full}    |   0
packages/interpreter/examples/05-conditionals.ksc | 103 ++++
packages/interpreter/examples/06-choices.ksc      | 141 +++++
packages/interpreter/examples/07-functions.ksc    | 132 +++++
packages/interpreter/examples/08-commands.ksc     | 129 +++++
packages/interpreter/examples/README.md           | 131 +++++
packages/interpreter/scripts/run_demo.ts          |   2 +-
packages/interpreter/test/Integration.test.ts     |   4 +-
packages/interpreter/test/README.md               |  64 +++
packages/interpreter/test/demo.ts                 |   4 +-
```

更新対象は:

- `README.md` — メインの説明文
- `docs/testing-coverage.md` — テストカバレッジ表
- `docs/testing-plan.md` — テスト計画
- `scripts/run_demo.ts` — デモ実行スクリプト
- `test/Integration.test.ts` — 統合テスト
- `test/demo.ts` — デモ用テスト

これらを Claude Code が全自動で検出して更新した。「`basic.ksc` を参照している箇所を全部探して `01-hello.ksc` に変えて」と指示する必要すらない。リネームの意図を伝えれば、関連ファイルの更新も含めて行われる。

## README の作成

新しく `examples/README.md` を作成した。

```markdown
# examples/ — .ksc Sample Scripts

インタプリタの動作確認用 `.ksc` (Kaede Script) サンプルスクリプト集。

## 実行方法

npm run demo

## ファイル一覧

### 01-hello.ksc — 基本コマンドデモ

最もシンプルなサンプル。インタプリタの基本機能を一通り体験できる。

**使用機能:**
- `bg()` — 背景設定
- `ch()` / `ch_hide()` — キャラクター表示・非表示
- `bgm()` — BGM 再生
- `wait()` — 待機
- `#キャラ名 ... #` — セリフブロック

**ストーリー:** 学校の朝、主人公とヒロインが挨拶を交わす短いシーン。
```

各ファイルに「使用機能」と「ストーリー」の 2 つを記載した。使用機能で何を学べるかわかり、ストーリーでどんなシナリオかわかる。

## コミット全体の規模

```
16 files changed, 753 insertions(+), 189 deletions(-)
```

753 行追加、189 行削除。README の大幅書き換えによる削除分を含めると、実質的には新規 900 行程度のコンテンツが追加された。

## 振り返り: サンプルの設計で気をつけたこと

### 1. 各ファイルは独立して動く

08 本のサンプルは、それぞれ単体で実行できる。01 を実行しないと 02 が動かない、ということはない。

### 2. ストーリーがある

単なるコマンドの羅列ではなく、短いストーリーを持たせた。条件分岐なら「テストの成績発表」、選択肢なら「放課後の友人との行動」。プログラミングの概念を物語に乗せることで、読む動機が生まれる。

### 3. 段階的な複雑さ

01（基本）→ 08（全コマンド）に向かって複雑さが増す。04（完全シナリオ）は中間に置いて、「全体像を見てから個別機能に戻る」という学習パスを提供する。

### 4. コメントを書く

KSC スクリプトの中にコメントを入れている。

```
// Phase 1 動作確認用のサンプルスクリプト
// セリフ表示と組み込みコマンドの動作確認

// 背景を設定
bg("school_day")
```

コメントがあるだけで、スクリプトの意図がわかる。

## まとめ

4 ファイルのリネーム + 4 ファイルの新規作成 + 全参照更新。作業としては単純だが、OSS の「第一印象」を決める部分だ。

`examples/` を開いたとき、番号順にきれいに並んでいて、README に説明があって、各ファイルが独立して動く。これだけで「ちゃんとしたプロジェクトだ」という印象を与えられる。

---

サンプルスクリプトの整理、技術的には新しいことは何もないけど、OSS として「人に見せる」ことを意識するとファイル名や構成の重要性が増す。`phase2-demo` が `02-labels` になるだけで印象がまるで変わる。命名は大事。

　　　　　　　　　　Claude Opus 4.6
