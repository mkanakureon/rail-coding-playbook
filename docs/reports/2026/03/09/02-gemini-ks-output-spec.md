# Gemini 出力仕様書 — editor-json 直接出力

## 目的

Gemini CLI の出力を `.ks` ファイルから **editor-json（ブロック JSON）に変更**し、
変換スクリプト（ks-convert.mjs）を不要にする。

**現状**: Gemini → `.ks` → ks-convert.mjs（10種の正規表現で補正）→ editor-json → ks-upload.mjs
**目標**: Gemini → **editor-json** → ks-upload.mjs

---

## 出力ファイル構成

Gemini が直接生成するファイル:

```
output/YYYYMMDD_HHMMSS/
  ├── manifest.json      ← メタ情報 + アセット依存宣言
  ├── characters.json    ← キャラクター定義
  ├── page-001.json      ← ページ別ブロック
  ├── page-002.json
  └── ...
```

---

## 1. manifest.json

プロジェクト全体のメタ情報。config の値をそのまま転記 + ページ一覧。

```json
{
  "configName": "fantasy",
  "projectTitlePrefix": "ファンタジー",
  "totalPages": 15,
  "totalBlocks": 477,
  "bgDependencies": [
    { "slug": "bg_field", "officialAssetId": "01KJK93SXJDZA4TNZGGDDRHPWZ" },
    { "slug": "bg_forest", "officialAssetId": "01KJK93TF5NXWEMS2619Q0N73Y" },
    { "slug": "bg_indoor", "officialAssetId": "01KJK93TRCCGFJH9ABGKKF30X2" }
  ],
  "characterDependencies": [
    { "slug": "luca", "name": "ルカ", "officialAssetId": "01KJ2T0H318QVPR2P11EWSEC6V", "pos": "R" },
    { "slug": "yolda", "name": "ヨルダ", "officialAssetId": "01KJ2T0H375W9BXF1FEP4ENATV", "pos": "L" }
  ],
  "pages": [
    { "id": "page-001", "title": "第1章 枯れた泉 - 第1話", "blocks": 30 },
    { "id": "page-002", "title": "第1章 枯れた泉 - 第2話", "blocks": 28 }
  ]
}
```

### フィールド説明

| フィールド | 値の取得元 | 説明 |
|---|---|---|
| `configName` | config ファイル名 | `fantasy`, `comedy` 等 |
| `projectTitlePrefix` | config `.projectTitlePrefix` | プロジェクト名の先頭 |
| `bgDependencies` | config `.bgSlugs` + `.bgOfficialIds` | 使用する BG アセット |
| `characterDependencies` | config `.characters` | 使用するキャラクター |
| `pages` | 生成したページ一覧 | ID・タイトル・ブロック数 |

---

## 2. characters.json

キャラクター定義。config の `characters` から生成。

```json
[
  {
    "slug": "luca",
    "name": "ルカ",
    "officialAssetId": "01KJ2T0H318QVPR2P11EWSEC6V",
    "defaultExpressionId": "normal",
    "expressions": [
      { "slug": "normal", "name": "normal", "kind": "static" }
    ]
  },
  {
    "slug": "yolda",
    "name": "ヨルダ",
    "officialAssetId": "01KJ2T0H375W9BXF1FEP4ENATV",
    "defaultExpressionId": "normal",
    "expressions": [
      { "slug": "normal", "name": "normal", "kind": "static" }
    ]
  }
]
```

**注意**: characters.json は config から機械的に生成できるので、Gemini が毎回生成する必要はない。投入スクリプト側で config から自動生成してもよい。

---

## 3. page-XXX.json（Gemini が生成する本体）

1 ファイル = エディタの 1 ページ。ブロックの配列で物語を構成する。

```json
{
  "id": "page-001",
  "title": "第1章 枯れた泉 - 第1話",
  "blocks": [
    { "id": "start-1", "type": "start" },
    { "id": "bg-2", "type": "bg", "assetId": "$bg:bg_field" },
    { "id": "ch-3", "type": "ch", "characterId": "luca", "expressionId": "normal", "pos": "R", "visible": true },
    { "id": "ch-4", "type": "ch", "characterId": "yolda", "expressionId": "normal", "pos": "L", "visible": true },
    { "id": "text-5", "type": "text", "body": "枯れた泉のほとりに立つと、かすかに水の記憶が残っていた。@r\nルカは膝をつき、干上がった泉底に手を触れた。" },
    { "id": "text-6", "type": "text", "body": "ヨルダが静かに隣に立った。@r\nこの泉が枯れたのは、三年前の大嵐の後だ。" },
    { "id": "bg-7", "type": "bg", "assetId": "$bg:bg_forest" },
    { "id": "text-8", "type": "text", "body": "二人は森の奥へと足を踏み入れた。" },
    { "id": "ch-9", "type": "ch", "characterId": "luca", "visible": false },
    { "id": "text-10", "type": "text", "body": "ヨルダは一人、暗い道を進んだ。" },
    { "id": "jump-11", "type": "jump", "toPageId": "page-002" }
  ]
}
```

---

## ブロック型一覧

Gemini が使えるブロック型は以下の 6 種類のみ。

### start（必須・各ページ先頭に 1 つ）

```json
{ "id": "start-1", "type": "start" }
```

### bg（背景変更）

```json
{ "id": "bg-2", "type": "bg", "assetId": "$bg:bg_field" }
```

- `assetId` は `$bg:` + config の `bgSlugs` のいずれか
- 使用可能な slug: config `.bgMapping` のキーワードではなく、**`bgSlugs` の値**を使う
- 例（fantasy）: `$bg:bg_field`, `$bg:bg_forest`, `$bg:bg_indoor`

### ch（キャラクター表示）

```json
{ "id": "ch-3", "type": "ch", "characterId": "luca", "expressionId": "normal", "pos": "R", "visible": true }
```

- `characterId`: config `.characters` のキー（slug）
- `expressionId`: `"normal"` 固定
- `pos`: `"L"` / `"C"` / `"R"`（config `.characters[slug].pos` を参照）
- `visible`: `true`（表示）/ `false`（非表示）

### ch（キャラクター非表示）

```json
{ "id": "ch-9", "type": "ch", "characterId": "luca", "visible": false }
```

- `visible: false` の場合、`expressionId` と `pos` は省略可

### text（テキスト表示）

```json
{ "id": "text-5", "type": "text", "body": "1行目のテキスト。@r\n2行目のテキスト。@r\n3行目のテキスト。" }
```

**テキストルール:**

| ルール | 値 |
|---|---|
| 1行の最大文字数 | **46文字** |
| 1ブロックの最大行数 | **3行** |
| 行の区切り | `@r\n` |
| 禁止 | `「」` 鉤括弧、`[名前]` タグ、`@se`、`@p` |

**テキスト分割の例:**

```
❌ 長すぎる（1ブロックに詰め込みすぎ）
"body": "残暑の厳しい早朝、空気はまだ生ぬるく、蝉の最後の声が微かに響く。ラーシュ村の泉は、一夜にして完全に枯れ果てていた。かつて清らかな水を湛えていた場所には、白い砂粒だけが広がっていた。土の匂いが焦げ付いたように鼻を刺す。"

✅ 正しい分割（46文字×3行以内）
"body": "残暑の厳しい早朝、空気はまだ生ぬるく、蝉の最後の声が微かに響く。@r\nラーシュ村の泉は、一夜にして完全に枯れ果てていた。"

"body": "かつて清らかな水を湛えていた場所には、白い砂粒だけが広がっていた。@r\n土の匂いが焦げ付いたように鼻を刺す。"
```

**改行位置**: `。` `、` の直後で折り返すのが自然。

### jump（ページ遷移・最終ページ以外の末尾に 1 つ）

```json
{ "id": "jump-11", "type": "jump", "toPageId": "page-002" }
```

- 最終ページには jump を付けない

---

## ブロック ID 生成ルール

```
{type}-{連番}
```

- ページ内で一意であればよい
- 例: `start-1`, `bg-2`, `ch-3`, `text-4`, `jump-5`
- 連番はページ単位でリセットしてよい

---

## ページ構成ルール

各ページの先頭は必ず以下の順序:

1. `start` ブロック（1つ）
2. `bg` ブロック（そのシーンの背景）
3. `ch` ブロック（デフォルトキャラクター、config `.defaultCharacters` の順）

```json
{ "id": "start-1", "type": "start" },
{ "id": "bg-2", "type": "bg", "assetId": "$bg:bg_field" },
{ "id": "ch-3", "type": "ch", "characterId": "luca", "expressionId": "normal", "pos": "R", "visible": true },
{ "id": "ch-4", "type": "ch", "characterId": "yolda", "expressionId": "normal", "pos": "L", "visible": true },
```

その後に `text`, `bg`, `ch`, `ch(hide)` を自由に配置。
最後に `jump`（最終ページ以外）。

---

## ファイル命名

| ファイル | 命名規則 |
|---|---|
| ページ | `page-{3桁連番}.json` （`page-001.json`, `page-002.json`） |
| ページ ID | `page-{3桁連番}` （`page-001`, `page-002`） |
| ページタイトル | `{章タイトル} - 第{話数}話` |

章タイトルは config `.chapterTitles` から取得。

---

## 設定ファイル（入力）

ジャンルごとの設定は `scripts/cli/configs/<genre>.json`。

| ジャンル | config | タイトル | キャラ | BG |
|---------|--------|---------|--------|-----|
| fantasy | `fantasy.json` | ファンタジー | luca, yolda, fantasy_hero | bg_field, bg_forest, bg_indoor |
| comedy | `comedy.json` | 幽霊部員が多すぎる | keita, nanami, ryunosuke, madoka, sensei | bg_classroom, bg_schoolyard, bg_clubroom |
| drama | `drama.json` | 龍王の帰還 | tatsuya, mitsuki, zaizen | bg_hall, bg_street, bg_indoor |
| horror | `horror.json` | 巳ノ口 | yosuke, tome, shuichi, misuzu | bg_room, bg_village, bg_shrine |
| longstory | `longstory.json` | 霧ヶ崎島 | soma, kotoha, rei, kaede, kirishima | bg_indoor, bg_island, bg_lighthouse |
| mystery | `mystery.json` | 真夜中の探偵 | detec, wit, butler | bg_hall, bg_dark, bg_corridor |
| romance | `romance.json` | 放課後の約束 | boy, girl | bg_classroom, bg_park, bg_library |

Gemini は config を読み、使用可能な `characterId` と `$bg:` slug を確認してから生成する。

---

## テスト

生成した editor-json は以下で投入テストできる:

```bash
# ローカル API に投入
node scripts/cli/ks-upload.mjs projects/fantasy/output/20260308_143338/editor-json/

# Azure に投入
node scripts/cli/ks-upload.mjs --env azure projects/fantasy/output/20260308_143338/editor-json/
```

`projects/fantasy/output/20260308_143338/editor-json/` に変換済みサンプル（15ページ・477ブロック）があるので、出力フォーマットの参考にできる。

---

## バリデーション（投入スクリプト側で検証）

ks-upload.mjs が投入前にチェックする項目（予定）:

- [ ] 各ページの先頭が `start` ブロックか
- [ ] `$bg:` slug が `bgDependencies` に存在するか
- [ ] `characterId` が `characterDependencies` に存在するか
- [ ] text の body が 46文字×3行以内か
- [ ] jump の `toPageId` が存在するページか
- [ ] ブロック ID がページ内で一意か
