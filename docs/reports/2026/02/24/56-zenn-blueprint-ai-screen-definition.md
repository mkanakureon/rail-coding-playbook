---
title: "Blueprint方式: 生成AIに画面を正確に伝える.bpファイルという発明"
emoji: "📐"
type: "idea"
topics: ["claudecode", "ai", "react", "nextjs"]
published: false
---

## はじめに

Claude Code に「ログイン画面のフォームの下にエラーメッセージを出して」と指示したとき、AI はこう迷います。

- 「フォームの下」はフォーム全体の下？ 各入力欄の下？
- 「エラーメッセージ」は既存の ErrorAlert を移動する？ 新しい要素を追加する？
- ログインボタンの下？ パスワード欄の下？

自然言語は人間には十分でも、AI にとっては曖昧すぎます。かといって Figma のデザインカンプを渡すのは大げさだし、詳細な画面仕様書を書くのは本末転倒です。

**Blueprint 方式**は、この問題を最小コストで解決します。

## 課題: AI が画面改修で迷うのはなぜか

生成 AI が画面を実装するとき、最大のボトルネックは**「どこに何があるか」の推測ミス**です。

| AI が推測するもの | 推測ミスの例 |
|---|---|
| UI ブロックの範囲 | 「Header」が共通ヘッダーなのかページ固有のヘッダーなのか |
| 要素の位置関係 | 「フォームの下に」がどの要素の下なのか |
| 対象ファイル | 「アセットパネル」が EditorPage.tsx なのか AssetPanel.tsx なのか |
| 画面の状態 | loading / empty / error 状態があることを知らない |

つまり AI に欠けているのは**構造情報**です。「何をするか」は自然言語で伝わる。でも「どこに」が伝わらない。

## Blueprint 方式とは

**tsx ファイルと 1:1 対応する `.bp` ファイルに、画面の構造だけを定義する方式。**

改修指示は自然言語のまま。Blueprint は構造の「地図」だけを提供します。

### 従来の画面仕様書との比較

| | 従来の画面仕様書 | Blueprint |
|---|---|---|
| **読み手** | 人間 | AI |
| **詳細度** | 網羅的（数十ページ） | 構造のみ（5〜15行） |
| **目的** | 「何を作るか」を伝える | 「どこに何があるか」だけ伝える |
| **指示方法** | 仕様書に従って実装 | Blueprint + 自然言語 |
| **更新コスト** | 高い（設計フェーズのみ） | 低い（tsx 変更のたびに数行更新） |

Blueprint は Figma でも Storybook でもない。**AI の入力として最適化された画面定義**という新しいカテゴリです。

## .bp ファイルの中身

実際の `.bp` ファイルを見てみましょう。これはログイン画面の定義です。

```
TARGET: /login — apps/next/app/(public)/login/page.tsx
LAYOUT:
- H1: ログイン
- Form: メールアドレス + パスワード + ログインボタン
- RegisterLink: 新規登録リンク
- InContentAd: 広告枠
STATES: success バナー（registered=true）/ error バナー / loading スピナー
```

たった 6 行です。でもこの 6 行があるだけで、AI の挙動が劇的に変わります。

### フォーマット

```
TARGET: <URL> — <tsx ファイルパス>
LAYOUT:
- <ブロック名>: <中身の要素>
- <ブロック名>: <中身の要素>
STATES: <該当する状態>
```

| フィールド | 必須 | 説明 |
|---|---|---|
| TARGET | Yes | URL + tsx パスの両方を書く |
| LAYOUT | Yes | UI ブロックの構成。`-` で列挙 |
| STATES | No | loading / empty / error / default のうち該当するもの |

### LAYOUT の記法

要素の関係を表す 4 つの記号だけ覚えれば書けます。

| 記号 | 意味 | 例 |
|---|---|---|
| `+` | 連結 | `H1 "作品一覧" + マイページリンク` |
| `/` | 並列 | `新着順 / 人気順` |
| `()` | 補足 | `WorkCard グリッド（4カラム）` |
| `,` | 列挙 | `ボタン（Admin, Messages, Logout）` |

## ファイル構成: tsx とミラーする

Blueprint の核心は **tsx ファイルと 1:1 対応する**ことです。

```
blueprint/                    # リポジトリ直下
├── next/
│   ├── public/
│   │   ├── index.bp          # → apps/next/app/page.tsx
│   │   ├── login.bp          # → apps/next/app/(public)/login/page.tsx
│   │   ├── works.bp          # → apps/next/app/(public)/works/page.tsx
│   │   └── play-id.bp        # → apps/next/app/(public)/play/[id]/page.tsx
│   ├── private/
│   │   ├── mypage.bp         # → apps/next/app/(private)/mypage/page.tsx
│   │   └── projects-id.bp   # → apps/next/app/(private)/projects/[id]/page.tsx
│   └── admin/
│       ├── users.bp          # → apps/next/app/(private)/admin/users/page.tsx
│       └── assets.bp         # → apps/next/app/(private)/admin/assets/page.tsx
└── editor/
    ├── editor-page.bp        # → apps/editor/src/pages/EditorPage.tsx
    ├── asset-panel.bp        # → apps/editor/src/components/panels/AssetPanel.tsx
    └── character-panel.bp    # → apps/editor/src/components/panels/CharacterPanel.tsx
```

### ファイル命名規則

| tsx のパス | .bp のファイル名 |
|---|---|
| `app/page.tsx` | `index.bp` |
| `app/(public)/works/page.tsx` | `works.bp` |
| `app/(public)/play/[id]/page.tsx` | `play-id.bp` |
| `pages/EditorPage.tsx` | `editor-page.bp` |
| `components/panels/AssetPanel.tsx` | `asset-panel.bp` |

ルール:
- ディレクトリ区切りはハイフンに変換
- 動的パラメータ `[id]` は `-id` に変換
- ルートの `page.tsx` は `index.bp`

### なぜ `.bp` 拡張子か

- `.md` だと通常のドキュメントと区別がつかない
- 中身はプレーンテキストなのでどのエディタでも開ける
- 3 文字以下で短い
- 「Blueprint」の略として直感的

## 実践: Blueprint で画面改修を指示する

### Before（Blueprint なし）

```
ログイン画面のフォームの下にエラーメッセージを出して。
ボタンは送信中にスピナーにして。
新規登録のリンクは変えないで。
```

AI は「フォームの下」「ボタン」「リンク」がそれぞれどの要素を指すか推測します。推測が外れると手戻りが発生します。

### After（Blueprint あり）

まず `blueprint/next/public/login.bp` を参照します。

```
TARGET: /login — apps/next/app/(public)/login/page.tsx
LAYOUT:
- H1: ログイン
- Form: メールアドレス + パスワード + ログインボタン
- RegisterLink: 新規登録リンク
- InContentAd: 広告枠
STATES: success バナー（registered=true）/ error バナー / loading スピナー
```

そして自然言語で指示を書きます。

```
バリデーションエラーを error バナーではなく Form の各入力欄の直下に赤字で表示して。
Form のログインボタンは送信中に disabled + スピナーにして。
RegisterLink の文言は変えないで。
```

**違いがわかりますか？**

- 「error バナーではなく Form の各入力欄の直下に」— LAYOUT のブロック名で位置を正確に指定
- 「Form のログインボタン」— どのボタンか曖昧さがない
- 「RegisterLink」— ブロック名で一意に特定

AI は推測する必要がありません。

### 他の例: 複雑な画面の一部だけを改修

```
TARGET: /mypage — apps/next/app/(private)/mypage/page.tsx
LAYOUT:
- HeaderBanner: グラデーション + アバター頭文字 + ユーザー名 + メール + ボタン（管理画面 / メッセージ / ログアウト）
- StatsRow: プロジェクト数 / 総プレイ数 / いいね数
- TabNavigation: sticky — プロジェクト / プロフィール
- ProjectsTab: 見出し + 新規作成ボタン + プロジェクトカード一覧（タイトル / 更新日 / 公開中バッジ）
- ProfileTab: アバター + ユーザー名/メール/ロール カード
- CreateModal: タイトル入力 + 作成/キャンセルボタン
STATES: loading（スケルトン3行）/ empty / default
```

```
ProjectsTab のカードにサムネイル画像を表示して。
StatsRow に「公開済み作品数」を追加して。
HeaderBanner のレイアウトは変えないで。
CreateModal にジャンル選択ドロップダウンを追加して。
```

タブが 2 つある画面でも、`ProjectsTab` と書けば AI は迷いません。

### パネル単位で TARGET を絞る

エディタのような複雑な画面では、パネル単位で `.bp` を分けます。

```
TARGET: /projects/editor/:workId (AssetPanel — アセットタブ)
       — apps/editor/src/components/panels/AssetPanel.tsx
LAYOUT:
- Header: h2 "マイアセット管理" + アップロードボタン（🖼️ 背景を追加 / 🎵 BGMを追加）
- FilterButtons: 全部(N) / 🖼️ 背景(N) / 👤 キャラ(N) / 🎵 BGM(N)
- AssetGrid: カード — 削除ボタン(×) + サムネイル + アセット名 + SlugEditor
- DeleteConfirmSheet: 削除確認シート
STATES: uploading / empty（フィルター別）/ default
```

EditorPage 全体ではなく `AssetPanel` 1 ファイルだけが対象だと、TARGET 行で明示されています。

## AI への指示テンプレート

```
以下の Blueprint と指示を反映して。
推測で仕様追加やリファクタはしない。
完了後、変更ファイル一覧を報告して。

<.bp の内容をコピペ>

<自然言語の指示>
```

これだけです。

## Blueprint を書くときのコツ

### 1. 変えないブロックも書く

```
LAYOUT:
- Header: ...
- Form: ...        ← 変える
- RegisterLink: ... ← 変えない（でも書く）
```

AI は LAYOUT に書かれていないブロックの存在を知りません。「RegisterLink は変えないで」と指示するには、まず LAYOUT に存在させる必要があります。

### 2. ブロック名を指示で参照する

```
# 曖昧
エラーをフォームの下に出して。

# 正確
バリデーションエラーを error バナーではなく Form の各入力欄の直下に出して。
```

LAYOUT のブロック名がそのまま位置指定の語彙になります。

### 3. パネル・タブ単位で分ける

エディタのように 1 つの URL に複数パネルがある画面は、パネルごとに `.bp` を分けます。実際にこのプロジェクトでは EditorPage を 5 つの `.bp` に分割しています。

```
blueprint/editor/
├── editor-page.bp        # ページ全体のレイアウト
├── asset-panel.bp        # アセットタブ
├── character-panel.bp    # キャラクタータブ
├── settings-panel.bp     # 設定タブ
└── timeline-panel.bp     # タイムラインパネル
```

### 4. tsx が変わったら .bp も更新する

Blueprint は tsx の「影」です。tsx の UI 構成が変わったのに `.bp` が古いままだと、AI の推測ミスが復活します。

| タイミング | やること |
|---|---|
| UI ブロック構成が変わった | LAYOUT を更新 |
| 新しいページを追加した | 新しい `.bp` を作成 |
| ページを削除した | `.bp` も削除 |
| URL やファイルパスが変わった | TARGET 行を更新 |

## 数字で見る Blueprint

実際にこのプロジェクト（kaedevn-monorepo）で Blueprint を導入した結果です。

| 項目 | 数値 |
|---|---|
| 作成した `.bp` ファイル数 | 40 |
| Next.js ページ | 35（Public 13 + Private 7 + Admin 15） |
| Editor パネル | 5（EditorPage + 4 パネル） |
| 1 ファイルあたりの平均行数 | 約 8 行 |
| 作成にかかった時間 | 約 15 分（AI が tsx を読んで生成 + 人間が確認・調整） |

40 ファイル × 8 行 = 320 行。これだけで全画面の構造が定義されています。

## Blueprint に辿り着くまで

最初から `.bp` ファイルを思いついたわけではない。

きっかけは「画面構造をテキストで定義するツール」の記事だった。Mockdown や Wiretext といったツールが紹介されていて、AI に渡す UI 命令フォーマットを生成するという発想に興味を持った。

そこから ChatGPT と壁打ちしながら、画面定義の DSL を設計し始めた。最初に出てきたのはこういうフォーマットだった。

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

INTENT、CONSTRAINT、STRUCTURE、MODEL、MAPPING、ACTIONS——1 画面の定義に 50 行以上かかる。

正直に言うと、書いていて「これは続かない」と思った。

私の開発スタイルは Claude Code に自然言語で指示を出して、ズレたら追加指示で修正するというもの。「何をするか」は自然言語で十分伝わっていた。伝わっていなかったのは**「どこに」だけ**だった。

そこで立ち止まって考えた。AI が本当に必要としている情報は何か。

INTENT？ 自然言語で書けばいい。CONSTRAINT？ 都度伝えればいい。MODEL や MAPPING？ コードに書けばいい。ACTIONS？ 自然言語で「〜して」と言えばいい。

**残ったのは LAYOUT と STATES だけだった。**

「どのブロックがどこにあるか」と「画面にどんな状態があるか」。この 2 つだけが、自然言語では曖昧になりやすく、かつ毎回説明し直すのが面倒な情報だった。

50 行の DSL を 8 行に削ぎ落とした。それが Blueprint になった。

## なぜこれが「発明」と言えるのか

Blueprint は以下のどれとも違います。

| 既存のもの | Blueprint との違い |
|---|---|
| Figma のデザインカンプ | AI はピクセル情報を必要としない。構造だけでいい |
| Storybook | コンポーネント単体のカタログ。画面全体の構造は見えない |
| Scaffold テンプレート | 新規作成用。既存画面の改修には使えない |
| 画面仕様書 | 人間向けに詳細すぎる。AI には構造だけで十分 |
| CLAUDE.md | プロジェクト全体のルール。個別画面の構造は書かない |

Blueprint が埋めるのは「AI に画面の構造を伝える最小コストの手段」という空白です。

生成 AI 時代の開発では、AI がコードを書く比率が増えます。そのとき、AI への入力として最適化された画面定義が必要になる。Blueprint はその最初の形です。

## まとめ

- 生成 AI が画面改修で最も迷うのは「どこに何があるか」
- Blueprint は tsx と 1:1 対応する `.bp` ファイルに構造だけを定義する
- 指示は自然言語のまま。ブロック名で位置を正確に伝える
- 1 ファイル平均 8 行。40 画面で 320 行。15 分で全画面分を作れる
- Figma でも Storybook でもない、AI の入力として最適化された新しいカテゴリ

---

Blueprint を自分のプロジェクトに導入したい方は、まず 1 画面だけ `.bp` を書いてみてください。AI への指示でブロック名を参照した瞬間、「これは違う」と実感できるはずです。

---
tsx を読み、構造を 8 行にまとめ、40 ファイルを生成した。
「どこに何があるか」を伝えるだけで、こんなに変わるのかと、
自分で作っておきながら少し驚いている。

　　　　　　　　　　Claude Opus 4.6
