# Blueprint 開発記 — 50行の DSL から 8行の .bp へ

## 発端: テキストベースのワイヤーフレームツール

gihyo.jp の記事で **Mockdown** と **Wiretext** というツールを知った。どちらも「テキストで UI 構造を定義して AI に渡す」というコンセプト。

- **Mockdown**: インデント構造で UI を記述 → AI がコード生成。コンポーネント階層を重視
- **Wiretext**: セクション区切りで画面構造を定義 → AI が解釈。ページ全体の構成を重視

面白いと思ったが、どちらも「AI に UI を新規生成させる」ためのツールだった。自分が欲しかったのは「既存画面の改修を正確に指示する」手段。方向性は近いが、用途が違った。

## ChatGPT との DSL 設計

ChatGPT と壁打ちしながら、画面定義の DSL を設計し始めた。

最初に出てきたのはフル装備の DSL だった。

```
INTENT
- 作品一覧ページを実装したい
- 検索・絞り込み可能にしたい

CONSTRAINT
- 1画面1目的
- カード形式表示
- スマホ優先

STRUCTURE
SCREEN works.list
PURPOSE 公開作品を一覧し、詳細へ遷移する
INPUT
  q?: string
  tab?: popular|new|following
DATA
  works: WorkCardVM[]
MODEL WorkCardVM
  id: string
  title: string
  ...
LAYOUT
  HEADER sticky
    BRAND "KaedeVN"
    ...
STATES
  loading SHOW Spinner
  empty   SHOW Empty
  ...
ACTIONS
  applyFilter: fetch works with (q, tab, genre)
MAPPING
  WorkDto -> WorkCardVM
    id = dto.id
    ...
```

INTENT、CONSTRAINT、STRUCTURE、MODEL、MAPPING、ACTIONS — 1 画面 50 行以上。

ChatGPT はさらに PatchSpec、ScreenCard、Layout1 と複数の軽量案を出してきた。その中の **Layout1** がこうだった:

```
TARGET: /works
LAYOUT:
- Header: 左ロゴ / 右=ログイン, サインアップ
- Filter: タブ + 検索 + ジャンル
- List: カード（画像/タイトル/概要/バッジ/開く）
STATES: loading/empty/error/default
```

ここで手が止まった。

## 「これは続かない」

自分の開発スタイルを振り返った。Claude Code に自然言語で指示を出して、ズレたら追加指示で修正する。「何をするか」は自然言語で十分伝わっていた。伝わっていなかったのは **「どこに」だけ** だった。

フル DSL の各項目を検証した:

- INTENT? → 自然言語で書けばいい
- CONSTRAINT? → 都度伝えればいい
- MODEL や MAPPING? → コードに書けばいい
- ACTIONS? → 自然言語で「〜して」と言えばいい

**残ったのは LAYOUT と STATES だけだった。**

ChatGPT の Layout1 案に TARGET の tsx パスを足し、記法を `+` `/` `()` `,` に統一した。50 行の DSL を 8 行に削ぎ落とした。それが Blueprint になった。

## kaedevn-monorepo への導入

Blueprint 方式を自分のプロジェクト（kaedevn-monorepo）に適用した。

Claude Code に tsx ファイルを読ませて `.bp` ファイルを生成し、自分で確認・調整した。

| 項目 | 数値 |
|---|---|
| 作成した `.bp` ファイル数 | 40 |
| Next.js ページ | 35（Public 13 + Private 7 + Admin 15） |
| Editor パネル | 5（EditorPage + 4 パネル） |
| 1 ファイルあたりの平均行数 | 約 8 行 |
| 作成にかかった時間 | 約 15 分 |

40 ファイル x 8 行 = 320 行。全画面の構造がこれだけで定義された。

エディタのように複雑なパネル構成の画面では、パネル単位で `.bp` を分けた。AssetPanel、CharacterPanel、SettingsPanel、TimelinePanel をそれぞれ独立ファイルにすることで、「EditorPage のどこにあるのか」を毎回説明し直す必要がなくなった。

### 残った課題

コンポーネント間の依存関係 — AssetPanel で選んだアセットが TimelinePanel に反映される、といったクロスパネルの関係性は、現在の「1 指示 = 1 TARGET」のフォーマットでは表現しきれない。複数パネルにまたがる改修をどう指示するかは、運用しながら考える。

## AI の役割の整理

この方式を作る過程で、複数の AI を使い分けた。

| AI | やったこと |
|---|---|
| **ChatGPT** | DSL の壁打ち相手。フル DSL → 軽量案を複数提案 |
| **Claude（Web）** | 仕様レビュー。記事の構成フィードバック |
| **Claude Code** | tsx を読んで `.bp` ファイルを生成。実装作業 |

核心の判断 —「50 行を 8 行に削る」「LAYOUT と STATES だけ残す」— は自分で下した。AI は壁打ち相手と実行役。設計の取捨選択は人間の仕事だった。

## Zenn 記事化

開発経緯を Zenn の技術記事にまとめた。

記事の骨格は Claude に書かせた。2 分 38 秒で焼き上がった。だが「AI が書きました」で終わると記事の説得力がない。ChatGPT との試行錯誤のストーリー — フル DSL を試して重すぎた → 削って削って残ったのが LAYOUT と STATES だけだった — を自分の言葉で書き足した。

記事: `docs/zenn/drafts/01kj7kbywh-blueprint-ai-screen-definition.md`

## タイムライン

| 時刻 | やったこと |
|---|---|
| 19:31 | Blueprint 方式の仕様を作成・保存 |
| 19:38 | Zenn 記事を生成 |
| 19:39 | 記事レビュー、「椋梨さんの声が薄い」指摘 |
| 19:42 | ChatGPT との会話ログを共有 |
| 19:43 | 開発経緯セクションを追加、記事を更新 |

---

AI を 3 つ使って、1 つの方式を作った。
ChatGPT が案を出し、Claude が磨き、Claude Code が手を動かした。
でも「これは要らない、これだけ残す」と決めたのは自分だった。
50 行を 8 行にしたのは、削る勇気だった。

　　　　　　　　　　2026-02-24
