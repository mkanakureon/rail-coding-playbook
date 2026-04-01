# 公式アセット メタデータ仕様書

## 概要

公式アセット（`official_assets` テーブル）の `metadata` カラム（JSONB）に構造化メタデータを保存し、キーワード検索・フィルタリングを可能にする。

情報ソースは 2 つ:
1. **fromFilename** — ファイル名から自動抽出（アップロード時）
2. **fromVision** — AI Vision で画像を分析して補完（バッチ実行）

**fromFilename が常に優先。Vision は補完のみ。**

---

## DB 構造

既存の `metadata` カラム（JSONB, nullable）を使用。新テーブル・新カラム不要。

```sql
-- 例
UPDATE official_assets SET metadata = '{
  "fromFilename": { ... },
  "fromVision": { ... },
  "subtype": "main",
  "tags": ["fantasy", "knight", "woman"]
}'::jsonb WHERE id = '...';
```

---

## metadata JSON 構造

```json
{
  "fromFilename": {
    "genre": "fantasy",
    "role": "knight",
    "gender": "woman",
    "age": null,
    "trait": "cool",
    "location": null,
    "timeOfDay": null,
    "mood": null,
    "subtype": "main"
  },
  "fromVision": {
    "description_ja": "銀髪の女騎士。青い鎧を着た凛とした立ち絵",
    "description_en": "Silver-haired female knight in blue armor",
    "hairColor": "silver",
    "hairStyle": "long",
    "outfit": "blue plate armor",
    "weapon": "longsword",
    "mood": "determined",
    "bodyType": "athletic",
    "background": "transparent",
    "tags": ["銀髪", "鎧", "剣", "凛々しい", "青"]
  },
  "subtype": "main",
  "tags": ["fantasy", "ファンタジー", "knight", "騎士", "woman", "女性", "cool", "クール", "主要キャラ", "銀髪", "鎧", "剣", "凛々しい"]
}
```

---

## フィールド定義

### トップレベル（統合結果）

| フィールド | 型 | 説明 |
|---|---|---|
| `subtype` | string | 細分類（統合結果） |
| `tags` | string[] | 検索用タグ（両ソースのマージ） |

### fromFilename（ファイル名由来）

#### CH 用フィールド

| フィールド | 型 | 例 | 抽出方法 |
|---|---|---|---|
| `genre` | string | `"fantasy"` | 先頭トークン or subcategory |
| `role` | string | `"knight"` | role 語彙に一致するトークン |
| `gender` | string | `"woman"` | `man`/`woman`/`boy`/`girl`/`male`/`female` |
| `age` | string \| null | `"elderly"` | `young`/`elderly`/`child` |
| `trait` | string \| null | `"cool"` | trait 語彙に一致するトークン |
| `subtype` | string | `"main"` | 後述の自動振り分けルール |

#### BG 用フィールド

| フィールド | 型 | 例 | 抽出方法 |
|---|---|---|---|
| `genre` | string | `"fantasy"` | 先頭トークン or subcategory |
| `location` | string \| null | `"forest"` | location 語彙に一致するトークン |
| `timeOfDay` | string \| null | `"night"` | `day`/`night`/`sunset`/`dawn`/`morning`/`evening` |
| `mood` | string \| null | `"dark"` | mood 語彙に一致するトークン |
| `subtype` | string | `"outdoor"` | 後述の自動振り分けルール |

### fromVision（AI Vision 由来）

| フィールド | 型 | CH | BG | 説明 |
|---|---|---|---|---|
| `description_ja` | string | ○ | ○ | 日本語の自然文説明 |
| `description_en` | string | ○ | ○ | 英語の自然文説明 |
| `tags` | string[] | ○ | ○ | 見た目から判断したタグ（日英混合） |
| `hairColor` | string | ○ | - | 髪色 |
| `hairStyle` | string | ○ | - | 髪型（long/short/ponytail/braid 等） |
| `outfit` | string | ○ | - | 服装の説明 |
| `weapon` | string \| null | ○ | - | 武器（あれば） |
| `mood` | string | ○ | ○ | 雰囲気 |
| `bodyType` | string | ○ | - | 体型（athletic/slim/muscular 等） |
| `background` | string | ○ | - | 背景（transparent/white/colored） |
| `season` | string \| null | - | ○ | 季節（spring/summer/autumn/winter） |
| `weather` | string \| null | - | ○ | 天候（clear/rain/snow/fog） |
| `architecture` | string \| null | - | ○ | 建築様式（medieval/japanese/modern 等） |

---

## subtype 自動振り分けルール

### CH（キャラクター画像）

ファイル名のトークンで判定:

```
"main" ← protagonist, heroine, hero, villain, boss, final_boss, lead
"mob"  ← soldier, extra, mob, unit, guard (city_guard, palace_guard 等)
"npc"  ← 上記に該当しない全て（merchant, innkeeper, farmer, student 等）
```

| subtype | 説明 | 例 |
|---|---|---|
| `main` | 主要キャラ・ボス | `fantasy_knight_woman_protagonist`, `fantasy_dark_priestess_final_boss` |
| `npc` | 名前付き NPC | `fantasy_innkeeper_man`, `school_nurse_woman` |
| `mob` | モブ・兵士 | `historical_soldier_man_extra`, `three_kingdoms_soldier_unit` |

### BG（背景画像）

ファイル名の location トークンで判定:

```
"outdoor" ← forest, meadow, field, village, mountain, desert, lake, river,
             sea, beach, port, harbor, cliff, street, park, garden,
             schoolyard, business_district, gate, market
"indoor"  ← castle_interior, room, inn, tavern, office, bedroom, classroom,
             shop, library, gym, infirmary, living_room, cafe, hospital,
             throne_room, staff_room, clubroom, kitchen
"dungeon" ← dungeon, cave, ruins, tower, underground, basement, prison,
             sewer, crypt, mine
"unknown" ← 上記いずれにも該当しない
```

| subtype | 説明 | 例 |
|---|---|---|
| `outdoor` | 屋外の風景 | `fantasy_forest_night_dark`, `school_schoolyard_day` |
| `indoor` | 室内 | `fantasy_tavern_cozy`, `modern_office_night_luxury` |
| `dungeon` | ダンジョン系 | `fantasy_cave_dark`, `fantasy_ruins_ancient` |
| `unknown` | 判定不能（Vision で補完） | プロンプトが切れているBG等 |

---

## 優先順位ルール

### subtype の決定

```
if (fromFilename.subtype !== "unknown" && fromFilename.subtype != null) {
  metadata.subtype = fromFilename.subtype;      // ファイル名優先
} else if (fromVision.subtype != null) {
  metadata.subtype = fromVision.subtype;         // Vision でフォールバック
} else {
  metadata.subtype = "unknown";
}
```

### 個別フィールドの優先

```
fromFilename に値がある → fromFilename の値を採用
fromFilename が null    → fromVision の値を採用
両方ある & 矛盾する    → fromFilename が勝つ
```

例: ファイル名から `gender: "woman"` が取れている場合、Vision が `gender: "man"` を返しても無視する。

### tags のマージ（日英バイリンガル）

fromFilename から英語タグを生成する際、**tag-dictionary を使って日本語タグも同時に追加**する。
これにより Vision 未実行でも日本語検索が効く。

```
// tag-dictionary.json の変換テーブルを使用
function bilingualTags(enTag: string, category: string): string[] {
  const ja = tagDictionary[category]?.[enTag];
  return ja ? [enTag, ja] : [enTag];
}

// 例: role="knight" → ["knight", "騎士"]
// 例: location="forest" → ["forest", "森"]

metadata.tags = unique([
  ...fromFilename の各フィールドを bilingualTags() で展開,
  ...fromVision.tags   // Vision のタグはそのまま追加（日英混合）
])
```

**変換テーブル**: `metadata-samples/tag-dictionary.json`
- genre, gender, age, role, location, trait, mood, timeOfDay, subtype の全カテゴリに対応
- 例: `knight→騎士`, `forest→森`, `cool→クール`, `night→夜`

重複を除去し、両方のタグを統合。矛盾は発生しない（タグは加算のみ）。

**検索例（Vision 未実行でも動作）:**

| 検索語 | マッチ先 | 結果 |
|---|---|---|
| `騎士` | tags に `"騎士"` | **OK** |
| `knight` | tags に `"knight"` | OK |
| `森` | tags に `"森"` | **OK** |
| `夜` | tags に `"夜"` | **OK** |
| `銀髪` | tags になし（Vision 補完後に追加） | Vision 必要 |

---

## genre マッピング

subcategory（日本語）から genre（英語）への変換:

| subcategory | genre |
|---|---|
| `ファンタジー` / `fantasy` | `fantasy` |
| `学園` / `sc` | `school` |
| `政治` | `politics` |
| `中国短尺ドラマ` | `chinese_drama` |
| `三国志` | `three_kingdoms` |
| `シルクロード` | `silk_road` |
| `BL` / `06_BL` | `bl` |
| `basic` | `basic` |

---

## 処理フロー

### Phase 1: ファイル名パース（アップロード時、自動）

```
画像アップロード
  ↓
ファイル名をトークン分割
  ↓
語彙マッチで genre / role / gender / location 等を抽出
  ↓
subtype 自動振り分け
  ↓
metadata.fromFilename に保存
metadata.subtype に設定
metadata.tags にファイル名由来タグを設定
```

### Phase 2: AI Vision（バッチ、任意）

```
metadata.fromVision が null のレコードを抽出
  ↓
Blob URL で画像を取得
  ↓
AI Vision API に送信（プロンプトでフィールドを指定）
  ↓
metadata.fromVision に保存
  ↓
subtype が "unknown" の場合のみ fromVision.subtype で上書き
tags を fromFilename + fromVision でマージ
```

### Phase 3: 検索 API

```
GET /api/official-assets/search?q=騎士+銀髪&genre=fantasy&subtype=main

検索対象:
  - metadata.tags（配列）に対する部分一致
  - metadata.fromVision.description_ja に対する ILIKE
  - genre / subtype でフィルタ
```

---

## 語彙リスト

### role（CH 用）

#### ファンタジー
`knight`, `mage`, `archer`, `priest`, `thief`, `rogue`, `merchant`, `innkeeper`, `farmer`, `king`, `queen`, `prince`, `princess`, `guard`, `assassin`, `bard`, `monk`, `alchemist`, `blacksmith`, `healer`, `summoner`, `warrior`, `swordsman`, `shepherd`, `vendor`, `cook`, `doctor`, `shaman`, `informant`

#### 学園
`student`, `teacher`, `nurse`, `principal`, `librarian`, `janitor`, `coach`, `club_president`, `transfer_student`, `childhood_friend`, `class_president`, `staff`, `driver`

#### 現代
`office_worker`, `politician`, `doctor`, `nurse`, `police_officer`, `engineer`, `journalist`, `secretary`, `CEO`, `delivery_worker`, `store_clerk`, `hairstylist`, `homemaker`, `bureaucrat`, `minister`

#### 歴史
`general`, `strategist`, `soldier`, `emperor`, `pilgrim`, `merchant`, `archer`, `scout`, `shepherd`, `scribe`, `interpreter`, `carrier`

### location（BG 用）

#### 屋外
`forest`, `meadow`, `field`, `village`, `mountain`, `desert`, `lake`, `river`, `sea`, `beach`, `port`, `harbor`, `cliff`, `street`, `park`, `garden`, `schoolyard`, `business_district`, `gate`, `market`, `plain`, `waterfall`

#### 室内
`castle_interior`, `room`, `inn`, `tavern`, `office`, `bedroom`, `classroom`, `shop`, `library`, `gym`, `infirmary`, `living_room`, `cafe`, `hospital`, `throne_room`, `staff_room`, `clubroom`, `kitchen`, `apartment`, `penthouse`

#### ダンジョン
`dungeon`, `cave`, `ruins`, `tower`, `underground`, `basement`, `prison`, `sewer`, `crypt`, `mine`

### trait（CH 用）
`cool`, `cheerful`, `dark`, `elegant`, `fierce`, `gentle`, `mysterious`, `handsome`, `beautiful`, `cold`, `confident`, `shy`, `calm`, `brave`, `cunning`

### mood（BG 用）
`dark`, `bright`, `serene`, `ominous`, `mystical`, `peaceful`, `abandoned`, `ancient`, `cozy`, `luxury`, `modern`, `futuristic`, `ruined`, `lively`

---

## 既存データへの適用

327 件の既存アセットに対して:

1. **Phase 1（即実行可能）**: ファイル名パーサーで `fromFilename` を一括生成
   - 予想: genre 100%, role 60%, gender 63%, subtype 70% が自動取得
   - 残り 30% は `subtype: "unknown"`
2. **Phase 2（任意）**: `fromVision` が null の 327 件を AI Vision で補完
   - 特に BG の location / subtype が改善される
   - コスト: ~$3-4（327 件 × ~$0.01）
3. **今後の新規アセット**: 命名規約に従えば Phase 1 でほぼ 100% 自動抽出

---

## 検索 API 仕様（予定）

```
GET /api/official-assets/search

Parameters:
  q         - キーワード（スペース区切り AND、tags + description_ja を検索）
  genre     - ジャンルフィルタ
  subtype   - 細分類フィルタ（main / npc / mob / outdoor / indoor / dungeon）
  gender    - 性別フィルタ
  category  - bg / ch-img / ovl
  limit     - 件数（デフォルト 50）
  offset    - ページング

Response:
{
  "assets": [
    {
      "id": "...",
      "url": "https://kaedevnworks.blob.core.windows.net/assets/...",
      "category": "ch-img",
      "subcategory": "ファンタジー",
      "metadata": { ... },
      "relevance": 0.95
    }
  ],
  "total": 42
}
```
