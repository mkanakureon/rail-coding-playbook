# アセット画像 ファイル名命名規約

画像ファイル名から自動的にメタデータを抽出できるようにするための命名ルール。
Midjourney 等で画像生成する際のプロンプト設計ガイドも兼ねる。

---

## 現状の問題

327 件の画像ファイル名を分析した結果:

| 問題 | 件数 | 例 |
|---|---|---|
| プロンプトが途中で切れている | BG 全般 | `Dark_Souls_style_Realistic_3D_rendering_landscape_a_fan` |
| 場所がわからない BG | 40/59 | `Unreal_engine_Anime_landscape_a_fantasy_role_playing_game` |
| 性別がないキャラ | 121/267 | `legendary_three_kingdoms_general_Frost_Serpent` |
| スタイル指定が長すぎて内容が埋もれる | BG 全般 | `DARK_SOULS_style_fantasy_role_playing_game_In_the_heart...` |
| カテゴリ分類ミス | 9 件 | `bg/06_BL` にキャラ画像が入っている |
| subcategory 不統一 | 3 件 | `ch-img/fantasy` と `ch-img/ファンタジー` が混在 |

---

## 命名フォーマット

### キャラクター画像（ch-img）

```
{genre}_{role}_{gender}_{age}_{trait}_full_body_standing_{uuid}.png
```

| フィールド | 必須 | 値の例 | 説明 |
|---|---|---|---|
| `genre` | ○ | `fantasy`, `school`, `modern`, `historical`, `scifi` | ジャンル |
| `role` | ○ | `knight`, `mage`, `student`, `nurse`, `merchant` | 職業・役割 |
| `gender` | ○ | `man`, `woman`, `boy`, `girl` | 性別（必ず入れる） |
| `age` | △ | `young`, `elderly`, `child` | 年齢層（省略時は青年） |
| `trait` | △ | `cool`, `cheerful`, `dark`, `elegant` | 性格・雰囲気 |
| `full_body_standing` | ○ | 固定 | ポーズ（立ち絵） |

**良い例:**
```
fantasy_knight_woman_cool_full_body_standing_{uuid}.png
fantasy_mage_girl_cheerful_full_body_standing_{uuid}.png
fantasy_innkeeper_man_elderly_friendly_full_body_standing_{uuid}.png
school_student_boy_protagonist_full_body_standing_{uuid}.png
school_nurse_woman_gentle_full_body_standing_{uuid}.png
modern_politician_woman_elite_full_body_standing_{uuid}.png
historical_general_man_fierce_full_body_standing_{uuid}.png
```

**悪い例（現状）:**
```
❌ original_fantasy_cool_heroine_full_body_character_stand...   ← gender なし
❌ legendary_three_kingdoms_general_Frost_Serpent_full_bod...   ← gender なし、固有名が入っている
❌ handsome_anime_boy_BL_style_full_body_character_standin...  ← role なし
❌ pre-modern_desert_water_carrier_full_body_character_sta...  ← gender なし
```

---

### 背景画像（bg）

```
{genre}_{location}_{timeofday}_{mood}_{uuid}.png
```

| フィールド | 必須 | 値の例 | 説明 |
|---|---|---|---|
| `genre` | ○ | `fantasy`, `school`, `modern`, `historical` | ジャンル |
| `location` | ○ | `forest`, `castle_interior`, `classroom`, `office` | **具体的な場所** |
| `timeofday` | △ | `day`, `night`, `sunset`, `dawn` | 時間帯（省略時は昼） |
| `mood` | △ | `dark`, `serene`, `ruins`, `cozy`, `luxury` | 雰囲気 |

**良い例:**
```
fantasy_forest_day_serene_{uuid}.png
fantasy_castle_interior_night_dark_{uuid}.png
fantasy_village_sunset_{uuid}.png
fantasy_dungeon_dark_ruins_{uuid}.png
fantasy_meadow_day_bright_{uuid}.png
school_classroom_day_{uuid}.png
school_rooftop_sunset_{uuid}.png
modern_office_night_luxury_{uuid}.png
modern_bedroom_night_cozy_{uuid}.png
modern_street_day_{uuid}.png
```

**悪い例（現状）:**
```
❌ DARK_SOULS_style_fantasy_role_playing_game_In_the_heart...  ← 場所不明
❌ Unreal_engine_Anime_landscape_a_fantasy_role_playing_ga...  ← スタイルだけ
❌ Dark_Souls_style_Realistic_3D_rendering_landscape_a_fan...  ← 場所なし
❌ luxury_penthouse_living_room_spacious_modern_interior_f...   ← genre なし
```

---

## 抽出可能フィールド一覧

この命名規約に従えば、ファイル名から以下を自動抽出できる:

### CH 画像

| フィールド | 抽出方法 | 例 |
|---|---|---|
| `genre` | 先頭トークン | `fantasy` |
| `role` | 2番目のトークン | `knight` |
| `gender` | `man`/`woman`/`boy`/`girl` の出現 | `woman` |
| `age` | `young`/`elderly`/`child` の出現 | `elderly` |
| `trait` | gender と `full_body` の間 | `cool` |
| `tags` | 上記を全て結合 | `["fantasy", "knight", "woman", "cool"]` |

### BG 画像

| フィールド | 抽出方法 | 例 |
|---|---|---|
| `genre` | 先頭トークン | `fantasy` |
| `location` | 2番目のトークン（`_` 結合可） | `castle_interior` |
| `timeofday` | `day`/`night`/`sunset`/`dawn` の出現 | `night` |
| `mood` | location と UUID の間 | `dark` |
| `tags` | 上記を全て結合 | `["fantasy", "castle", "interior", "night", "dark"]` |

---

## Midjourney プロンプト設計

ファイル名に情報を残すため、プロンプトの **先頭に構造化キーワード** を置く。

### CH プロンプトテンプレート

```
{genre} {role} {gender} {age?} {trait?} full body character standing facing camera,
white background, anime style, high quality --ar 2:3
```

例:
```
fantasy knight woman cool full body character standing facing camera,
medieval armor, long silver hair, confident pose,
white background, anime style --ar 2:3
```

→ ファイル名: `fantasy_knight_woman_cool_full_body_character_standing_facing_camera_{uuid}.png`
→ 抽出: genre=fantasy, role=knight, gender=woman, trait=cool

### BG プロンプトテンプレート

```
{genre} {location} {timeofday?} {mood?} landscape background,
no characters, wide angle, anime style --ar 16:9
```

例:
```
fantasy forest night dark landscape background,
ancient trees, fog, moonlight filtering through canopy,
no characters, wide angle, anime style --ar 16:9
```

→ ファイル名: `fantasy_forest_night_dark_landscape_background_{uuid}.png`
→ 抽出: genre=fantasy, location=forest, timeofday=night, mood=dark

---

## location 語彙リスト（BG 用）

### ファンタジー
| 語彙 | 日本語 |
|---|---|
| `forest` | 森 |
| `meadow` / `field` | 草原・野原 |
| `village` | 村 |
| `castle_interior` | 城内部 |
| `castle_exterior` | 城外観 |
| `dungeon` | ダンジョン・地下 |
| `cave` | 洞窟 |
| `ruins` | 遺跡 |
| `mountain` | 山 |
| `lake` / `river` | 湖・川 |
| `desert` | 砂漠 |
| `tavern` | 酒場 |
| `inn` | 宿屋 |
| `shrine` / `temple` | 神殿 |
| `tower` | 塔 |
| `port` / `harbor` | 港 |
| `throne_room` | 玉座の間 |
| `market` | 市場 |

### 学園
| 語彙 | 日本語 |
|---|---|
| `classroom` | 教室 |
| `hallway` / `corridor` | 廊下 |
| `rooftop` | 屋上 |
| `schoolyard` | 校庭 |
| `clubroom` | 部室 |
| `library` | 図書室 |
| `gym` | 体育館 |
| `school_gate` | 校門 |
| `infirmary` | 保健室 |
| `staff_room` | 職員室 |

### 現代
| 語彙 | 日本語 |
|---|---|
| `office` | オフィス |
| `bedroom` | 寝室 |
| `living_room` | リビング |
| `street` | 街路 |
| `cafe` | カフェ |
| `hospital` | 病院 |
| `station` | 駅 |
| `park` | 公園 |
| `apartment` | マンション |
| `business_district` | ビジネス街 |

---

## role 語彙リスト（CH 用）

### 共通
| 語彙 | 日本語 |
|---|---|
| `protagonist` | 主人公 |
| `heroine` | ヒロイン |
| `villain` | 敵役 |
| `extra` / `mob` | モブ |

### ファンタジー
`knight`, `mage`, `archer`, `priest`, `thief`, `merchant`, `innkeeper`, `farmer`, `king`, `queen`, `prince`, `princess`, `guard`, `assassin`, `bard`, `monk`, `alchemist`, `blacksmith`, `healer`, `summoner`, `warrior`, `swordsman`

### 学園
`student`, `teacher`, `nurse`, `principal`, `librarian`, `janitor`, `coach`, `club_president`, `transfer_student`, `childhood_friend`

### 現代
`office_worker`, `politician`, `doctor`, `nurse`, `police_officer`, `engineer`, `journalist`, `secretary`, `CEO`, `delivery_worker`, `store_clerk`

---

## 既存ファイルの改善例

| 現状 | 改善後 |
|---|---|
| `DARK_SOULS_style_fantasy_role_playing_game_In_the_heart...` | `fantasy_forest_day_dark` |
| `luxury_penthouse_living_room_spacious_modern_interior_f...` | `modern_living_room_night_luxury` |
| `original_fantasy_cool_heroine_full_body_character_stand...` | `fantasy_heroine_girl_cool_full_body_standing` |
| `legendary_three_kingdoms_general_Frost_Serpent_full_bod...` | `historical_general_man_fierce_full_body_standing` |
| `handsome_anime_boy_BL_style_full_body_character_standin...` | `bl_protagonist_boy_handsome_full_body_standing` |
| `pre-modern_desert_water_carrier_full_body_character_sta...` | `historical_water_carrier_man_full_body_standing` |

---

## チェックリスト（画像生成前）

- [ ] プロンプト先頭に `{genre} {role/location}` を置いたか
- [ ] CH: `man`/`woman`/`boy`/`girl` のいずれかを含むか
- [ ] BG: 具体的な場所（`forest`, `castle`, `office` 等）を含むか
- [ ] スタイル指定（`DARK_SOULS_style`, `Unreal_engine` 等）は後半に置いたか
- [ ] フォルダ分類: `{category}/{subcategory}/` の subcategory は日本語で統一か
