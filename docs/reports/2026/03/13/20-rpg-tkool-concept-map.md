# kaedevn ゲームシステム設計 — ツクール概念の再構成

- **作成日**: 2026-03-13
- **目的**: RPGツクールの概念体系を参考に、kaedevn の完成形を設計する
- **方針**: ツクールをそのまま真似るのではなく、kaedevn のアーキテクチャ（ブロックエディタ + PlayLayout + Web/Switch ランタイム）に合う形で再構成する

---

## 1. kaedevn の4本柱

ツクールは「マップ・データベース・イベント」の3柱だが、kaedevn はノベルエンジンがベースなので構造が違う。

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ シナリオ      │  │ ゲームDB     │  │ マップ        │  │ UIレイアウト  │
│ (物語)        │  │ (定義)       │  │ (空間)        │  │ (見た目)      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
  ブロックで組む     キャラ・敵・技・     タイルで描く      PlayLayout JSON
  テキスト・演出・    アイテムを定義     歩ける場所を作る   で UI 配置を編集
  分岐・バトルを配置
```

| 柱 | ツクールとの違い |
|----|---------------|
| **シナリオ** | ツクールの「イベント」に相当するが、ノベルゲームの**テキスト+演出が主軸** |
| **ゲームDB** | ツクールの「データベース」。kaedevn ではプロジェクト JSON 内に格納 |
| **マップ** | ツクールと同じ。ただしノベルでは任意（ADV なら不要、RPG なら必須） |
| **UIレイアウト** | ツクールにはない。kaedevn 独自。PlayLayout JSON でメッセージウィンドウ等を配置 |

---

## 2. シナリオ（ブロックシステム）

### ツクールの「イベントコマンド」と kaedevn の「ブロック」の対応

ツクールではイベントコマンドを1行ずつ積み上げる。kaedevn ではブロックを並べる。同じこと。

#### メッセージ・演出系

| ツクールのコマンド | kaedevn のブロック | 備考 |
|-----------------|-----------------|------|
| 文章の表示 | `text` | `body` + `speaker` |
| 選択肢の表示 | `choice` | `options[]` でページ分岐 |
| 背景の変更 | `bg` | `assetId` で背景指定 |
| キャラの表示 | `ch` | `characterId`, `expressionId`, `pos` |
| ピクチャの表示/消去 | `overlay` | `assetId`, `visible` |
| 画面のフェード | `effect`（fade） | `intensity`, `duration` |
| 画面のシェイク | `effect`（shake） | 同上 |
| 画面のフラッシュ | `effect`（flash） | 同上 |
| 画面の色調変更 | `screen_filter` | sepia/grayscale/blur/pc98/gameboy/crt |
| BGM の演奏 | KSC `@playBgm` | `ksc` ブロック or KSC 命令 |
| SE の演奏 | KSC `@playSe` | 同上 |
| ウェイト | KSC `@wait` | click/timeout/voiceend |
| タイムライン演出 | `timeline` | 複数要素の同期制御 |
| 文章のスクロール表示 | **新規: `scroll_text`** | スタッフロール、長文演出用 |

#### ゲーム進行系

| ツクールのコマンド | kaedevn のブロック | 備考 |
|-----------------|-----------------|------|
| 条件分岐 | `if` | `conditions[]`, `thenBlocks[]`, `elseBlocks[]` |
| 変数の操作 | `set_var` | `varName`, `operator`(=,+=,-=), `value` |
| スイッチの操作 | `set_var`（値を 0/1 で運用） | 専用 `switch` 型があると直感的 → 後述 |
| ラベルジャンプ | `jump` | `toPageId` でページ間移動 |
| コモンイベント呼び出し | **新規: `call`** | 共通ブロック列を呼び出す → 後述 |
| ループ | `if` + `jump` の組み合わせ | ノベルでループは稀 |
| 戦闘の処理 | `battle` | `troopId`, `onWinPageId`, `onLosePageId` |
| KSC 直接実行 | `ksc` | スクリプトで何でもできるエスケープハッチ |

#### ツクールにあって kaedevn に不要なもの

| コマンド | 理由 |
|---------|------|
| 移動ルートの設定 | ノベルではキャラは立ち絵。マップモード時は別途対応 |
| 乗り物の乗降 | スコープ外 |
| フキダシアイコン | `ch` の表情差分で代用 |
| 名前入力の処理 | Web の input で対応（`ksc` ブロック経由） |
| 透明状態の変更 | `ch` の `visible: false` で対応 |

---

## 3. フラグシステム（スイッチ + 変数）

ツクールの「スイッチ」と「変数」に相当する機能は **既に実装済み**。

### `set_var` ブロック（実装済み）

| 演算子 | 例 | 用途 |
|--------|---|------|
| `=` | `{ "varName": "ボス撃破", "operator": "=", "value": "1" }` | スイッチ相当（ON/OFF） |
| `+=` | `{ "varName": "好感度", "operator": "+=", "value": "5" }` | 加算 |
| `-=` | `{ "varName": "gold", "operator": "-=", "value": "10" }` | 減算 |

value は文字列型なので数値も文字列も格納できる。

### `if` ブロック（実装済み）

```typescript
// apps/editor/src/types/index.ts より
type IfCondition = {
  varName: string;
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';  // 6種の比較演算子
  value: string;
  logicalOp?: '&&' | '||';  // 複数条件の論理結合
};

type IfBlock = {
  type: 'if';
  conditions: IfCondition[];  // 複数条件対応
  thenBlocks: Block[];        // true 時
  elseBlocks?: Block[];       // false 時（省略可）
};
```

**ツクールの「スイッチ」「変数」「条件分岐」に必要な機能は全て揃っている。**

### ツクールの「セルフスイッチ」の代替

ツクールのセルフスイッチ（A/B/C/D）は「宝箱を開けたら空になる」等に使う。
kaedevn では**変数名の命名規約**で代用:

```json
// page1 の宝箱イベント
{ "type": "set_var", "varName": "page1_treasure_opened", "operator": "=", "value": 1 }

// 条件分岐で「開封済みなら空のメッセージ」
{ "type": "if", "conditions": [{ "var": "page1_treasure_opened", "op": "==", "value": 1 }],
  "thenBlocks": [{ "type": "text", "body": "からっぽだ。" }],
  "elseBlocks": [{ "type": "text", "body": "宝箱を開けた！ 薬草を手に入れた。" }]
}
```

---

## 4. コモンイベント（再利用ブロック列）

ツクールの「コモンイベント」= どこからでも呼べる共通処理。

### 提案: `templates` + `call` ブロック

プロジェクト JSON に `templates` 配列を追加:

```json
{
  "data": {
    "pages": [...],
    "characters": [...],
    "templates": [
      {
        "id": "tpl-shop",
        "name": "ショップ処理",
        "blocks": [
          { "type": "text", "body": "いらっしゃい！\n何をお求めですか？" },
          { "type": "choice", "options": [
            { "text": "薬草（10G）", "actions": [{ "type": "set_var", "varName": "gold", "operator": "-=", "value": 10 }] },
            { "text": "やめる" }
          ]}
        ]
      },
      {
        "id": "tpl-levelup",
        "name": "レベルアップ演出",
        "blocks": [
          { "type": "effect", "effect": "flash", "intensity": 0.8, "duration": 500 },
          { "type": "text", "body": "レベルが上がった！" }
        ]
      }
    ]
  }
}
```

呼び出し:

```json
{ "type": "call", "templateId": "tpl-shop" }
```

**新規ブロック型 `call`** が必要。ランタイムは `templateId` で `templates[]` から該当ブロック列を取り出して実行する。

---

## 5. ゲームデータベース

ツクールのデータベースに相当する部分。プロジェクト JSON の `data.gameDb` に格納する。

### 5-1. 必要なテーブル

ツクールの全テーブルは不要。kaedevn に必要なものだけ:

| テーブル | 用途 | ツクール対応 |
|---------|------|------------|
| **actors** | プレイヤーキャラの定義 | アクター + 職業 |
| **enemies** | 敵キャラの定義 | エネミー |
| **troops** | 敵グループの定義 | トループ |
| **skills** | 技・魔法の定義 | スキル |
| **items** | アイテムの定義 | アイテム + 武器 + 防具 |
| **states** | 状態異常の定義 | ステート |

#### actors（キャラクター定義）

```json
{
  "id": "actor-hero",
  "name": "勇者",
  "characterId": "fantasy_hero",
  "stats": {
    "maxHp": 100, "maxMp": 30,
    "atk": 15, "def": 10, "mat": 8, "mdf": 8, "agi": 12, "luk": 10
  },
  "skills": ["skill-slash", "skill-heal"],
  "equipment": { "weapon": "item-iron-sword", "armor": "item-leather-armor" },
  "level": 1,
  "growthCurve": {
    "hp": 15, "mp": 5, "atk": 3, "def": 2, "mat": 1, "mdf": 1, "agi": 2, "luk": 1
  }
}
```

#### enemies（敵キャラ定義）

```json
{
  "id": "enemy-goblin",
  "name": "ゴブリン",
  "imageId": "enemy-goblin-img",
  "stats": { "maxHp": 50, "atk": 8, "def": 5, "agi": 6 },
  "exp": 10,
  "gold": 5,
  "drops": [{ "itemId": "item-herb", "chance": 0.3 }],
  "actions": [
    { "skillId": "skill-attack", "rating": 5 },
    { "skillId": "skill-fire-breath", "rating": 3, "condition": { "hpBelow": 0.5 } }
  ]
}
```

#### skills（スキル定義）

```json
{
  "id": "skill-slash",
  "name": "斬撃",
  "type": "physical",
  "mpCost": 0,
  "target": "one-enemy",
  "formula": "a.atk * 4 - b.def * 2",
  "animation": "anim-slash",
  "description": "剣で敵を斬りつける"
}
```

`formula` は JavaScript 式。`a`=使用者, `b`=対象。ツクールと同じ。

#### items（アイテム定義）

```json
{
  "id": "item-herb",
  "name": "薬草",
  "type": "consumable",
  "effect": { "type": "heal-hp", "value": 30 },
  "price": 10,
  "description": "HPを30回復する"
}
```

```json
{
  "id": "item-iron-sword",
  "name": "鉄の剣",
  "type": "weapon",
  "stats": { "atk": 10 },
  "price": 100,
  "description": "標準的な剣"
}
```

#### troops（敵グループ定義）

```json
{
  "id": "troop-goblin-x3",
  "name": "ゴブリン×3",
  "members": [
    { "enemyId": "enemy-goblin", "x": 200, "y": 300 },
    { "enemyId": "enemy-goblin", "x": 400, "y": 280 },
    { "enemyId": "enemy-goblin", "x": 600, "y": 310 }
  ],
  "events": [
    { "condition": { "turn": 0 }, "blocks": [
      { "type": "text", "body": "ゴブリンが現れた！", "speaker": "" }
    ]},
    { "condition": { "enemyHpBelow": { "index": 0, "percent": 0.3 } }, "blocks": [
      { "type": "text", "body": "ゴブリンは逃げ出した！" }
    ]}
  ]
}
```

### 5-2. JSON 配置

```json
{
  "data": {
    "pages": [...],
    "characters": [...],
    "templates": [...],
    "gameDb": {
      "actors": [...],
      "enemies": [...],
      "troops": [...],
      "skills": [...],
      "items": [...],
      "states": [...]
    }
  }
}
```

### 5-3. ノベルゲームでは gameDb は空でいい

ADV・ノベルを作る人は `gameDb` を一切触らない。バトルやアイテムを使いたい人だけ定義する。

---

## 6. バトルシステム

### 現行の `battle` ブロック

```json
{ "type": "battle", "troopId": "troop-goblin-x3", "onWinPageId": "page-win", "onLosePageId": "page-lose" }
```

これだけで「戦闘開始 → 勝ったら page-win へ、負けたら page-lose へ」が動く。

### バトル画面の設計

```
┌──────────────────────────────────────┐
│ [背景画像]                            │
│                                      │
│    👹 👹 👹  ← 敵（フロントビュー）     │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 勇者  HP 100/100  MP 30/30      │ │
│ │ 戦士  HP 120/120  MP 10/10      │ │
│ │ 魔法使い HP 60/60  MP 80/80     │ │
│ └──────────────────────────────────┘ │
│ ┌─────────┐                          │
│ │ 攻撃     │ ← コマンドウィンドウ      │
│ │ スキル   │                          │
│ │ アイテム │                          │
│ │ 防御     │                          │
│ │ 逃走     │                          │
│ └─────────┘                          │
└──────────────────────────────────────┘
```

バトル UI も PlayLayout JSON で配置を定義できる:

```json
{
  "id": "battle-status",
  "rect": { "x": 40, "y": 520, "width": 1200, "height": 120 },
  "options": { "showHp": true, "showMp": true, "barStyle": "gradient" }
}
```

### バトルの流れ

```
1. battle ブロック到達 → troopId から敵グループ取得
2. バトル画面に遷移（フロントビュー / サイドビュー は PlayLayout で設定）
3. ターン開始:
   a. パーティ全員のコマンド選択（攻撃/スキル/アイテム/防御/逃走）
   b. agi 順にソートして順番に実行
   c. formula を eval して ダメージ計算
   d. アニメーション再生
4. 勝利判定: 敵が全滅 → onWinPageId へジャンプ
5. 敗北判定: 味方が全滅 → onLosePageId へジャンプ
6. 逃走: agi ベースの成功率で判定
7. トループイベント: 条件（ターン数、敵HP%等）を毎ターンチェック
```

### ダメージ計算

ツクールと同じく JavaScript 式:

```javascript
// a = 使用者の stats, b = 対象の stats
"a.atk * 4 - b.def * 2"        // 物理
"a.mat * 3 - b.mdf"            // 魔法
"100"                           // 固定ダメージ
"a.atk * (1 + a.level * 0.1)"  // レベル依存
```

ランタイムは `new Function('a', 'b', 'return ' + formula)` で評価。

---

## 7. マップシステム

### 現行の map-cli

タイルセット定義 → マップ作成 → レイヤー生成 → 衝突判定 → イベント配置 → PNG プレビュー

### ツクールから取り入れるもの

| 概念 | kaedevn での実装 |
|------|----------------|
| **タイルセット** | `maps/tilesets.json` で定義済み |
| **4層レイヤー** | ground / decoration-lower / decoration-upper / shadow |
| **通行設定** | タイルごとに `passable: true/false` |
| **衝突レイヤー** | `collision` レイヤー（0=通行可, 1=不可, 2=特殊） |
| **マップイベント** | マップ上の座標にイベント（NPC会話等）を配置 |
| **エンカウント** | マップ設定で `encounters: [{ troopId, weight }]` |
| **リージョン** | `region` レイヤー（番号でエリア分け → エンカウント率変更等） |
| **遠景** | `parallax` 設定（背景画像 + スクロール速度） |
| **マップBGM** | マップに入ったら自動再生 |

### マップイベントの JSON

```json
{
  "events": [
    {
      "id": "evt-npc-01",
      "x": 5, "y": 3,
      "graphic": "npc-villager",
      "pages": [
        {
          "condition": null,
          "trigger": "action-button",
          "blocks": [
            { "type": "text", "body": "この先に洞窟があるよ。\n気をつけてね。", "speaker": "村人" }
          ]
        },
        {
          "condition": { "var": "ボス撃破", "op": "==", "value": 1 },
          "trigger": "action-button",
          "blocks": [
            { "type": "text", "body": "魔王を倒したんだって？\nすごいなぁ！", "speaker": "村人" }
          ]
        }
      ]
    }
  ]
}
```

**ポイント**: ツクールと同じく「複数ページ + 条件で切り替え」モデル。ブロックはシナリオと同じ型を使う。

### マップ ↔ シナリオの接続

```
シナリオページ → jump でマップへ → マップ上を歩く → イベントに触れる → ブロック列実行
                                                    → エンカウント → battle ブロック
マップ上のイベント → jump でシナリオページへ戻る
```

マップモードとシナリオモードの切り替えは `jump` ブロックの拡張で:

```json
// シナリオ → マップ
{ "type": "jump", "toMapId": "map-village", "spawnX": 10, "spawnY": 8 }

// マップイベント → シナリオ
{ "type": "jump", "toPageId": "page-boss-cutscene" }
```

---

## 8. アイテム・所持品システム

### インベントリ

変数でアイテム所持数を管理:

```json
// アイテム入手
{ "type": "set_var", "varName": "item_herb", "operator": "+=", "value": 3 }

// 使用（条件チェック付き）
{ "type": "if",
  "conditions": [{ "var": "item_herb", "op": ">", "value": 0 }],
  "thenBlocks": [
    { "type": "set_var", "varName": "item_herb", "operator": "-=", "value": 1 },
    { "type": "text", "body": "薬草を使った。HPが30回復した。" }
  ],
  "elseBlocks": [
    { "type": "text", "body": "薬草を持っていない。" }
  ]
}
```

### ショップ

テンプレート（コモンイベント）として定義:

```json
{
  "id": "tpl-shop-village",
  "name": "村のショップ",
  "blocks": [
    { "type": "text", "body": "いらっしゃい！", "speaker": "店主" },
    { "type": "choice", "options": [
      { "text": "薬草（10G）",
        "condition": { "var": "gold", "op": ">=", "value": 10 },
        "actions": [
          { "type": "set_var", "varName": "gold", "operator": "-=", "value": 10 },
          { "type": "set_var", "varName": "item_herb", "operator": "+=", "value": 1 }
        ]},
      { "text": "鉄の剣（100G）",
        "condition": { "var": "gold", "op": ">=", "value": 100 },
        "actions": [
          { "type": "set_var", "varName": "gold", "operator": "-=", "value": 100 },
          { "type": "set_var", "varName": "equip_weapon", "operator": "=", "value": "iron-sword" }
        ]},
      { "text": "やめる" }
    ]}
  ]
}
```

**ショップ専用ブロックは不要。** `choice` + `set_var` の組み合わせで実現できる。

---

## 9. セーブ/ロード（Phase ごとの段階的拡張）

セーブデータは機能追加に合わせて段階的に拡張する。機能を作ってもセーブできなければプレイできない。

### 現行のセーブスキーマ（v1）— Phase 1–3

```json
{
  "save_schema_version": 1,
  "engine_version": "",
  "work_id": "",
  "scenario_id": "",
  "node_id": "",
  "vars": {},
  "read": {},
  "timestamp": 0
}
```

ノベル制作・フラグ・コモンイベントまではこれで十分。Phase 2 で vars に文字列値が入るようになるが、スキーマ変更は不要。

### v1.1 — Phase 4（ゲームDB導入時）

```json
{
  "save_schema_version": 1.1,
  "...": "...v1 のフィールド全て",
  "inventory": {
    "gold": 250,
    "items": { "item-herb": 3, "item-iron-sword": 1 },
    "equipment": {
      "actor-hero": { "weapon": "item-iron-sword", "armor": "item-leather" }
    }
  }
}
```

アイテム・装備・所持金をセーブに含める。

### v1.2 — Phase 5（バトル導入時）

```json
{
  "save_schema_version": 1.2,
  "...": "...v1.1 のフィールド全て",
  "party": {
    "members": ["actor-hero", "actor-mage"],
    "states": {
      "actor-hero": { "hp": 85, "mp": 20, "level": 3, "exp": 120, "states": [] },
      "actor-mage": { "hp": 45, "mp": 60, "level": 2, "exp": 80, "states": ["poison"] }
    }
  }
}
```

パーティ構成・HP/MP/レベル/経験値・状態異常をセーブに含める。

### v1.3 — Phase 6（マップ導入時）

```json
{
  "save_schema_version": 1.3,
  "...": "...v1.2 のフィールド全て",
  "mapState": {
    "currentMapId": "map-village",
    "playerX": 10, "playerY": 8,
    "direction": "down",
    "visitedMaps": ["map-village", "map-forest"]
  }
}
```

マップ位置・向き・訪問済みマップをセーブに含める。

### 後方互換

ロード時に `save_schema_version` を見て、ないフィールドはデフォルト値で補完:

| フィールド | デフォルト |
|-----------|----------|
| `inventory` | `{ gold: 0, items: {}, equipment: {} }` |
| `party` | `{ members: [], states: {} }` |
| `mapState` | `null`（シナリオモードで開始） |

v1 のセーブデータも v1.3 のランタイムで読める。ノベルだけのプロジェクトでは inventory / party / mapState は空のまま。

---

## 10. 新規ブロック型まとめ

現行14型に加えて必要な新規ブロック:

| ブロック型 | 用途 | 優先度 |
|-----------|------|:------:|
| `call` | テンプレート（コモンイベント）呼び出し | 高 |
| `scroll_text` | スクロールテキスト（スタッフロール等） | 中 |
| `map_jump` | シナリオ → マップ遷移 | 中 |
| `give_item` | アイテム入手（`set_var` のシュガー） | 低 |
| `give_gold` | ゴールド入手（`set_var` のシュガー） | 低 |

`give_item` / `give_gold` は `set_var` で実現できるが、作者にとってわかりやすいショートカット。

---

## 11. 作者の体験レベル

作者のスキルに応じて使う機能が変わる:

| Lv | 作者の目的 | 使う機能 | 実装Phase | ツクール相当 |
|:--:|-----------|---------|:--------:|:----------:|
| **1** | ノベルを作りたい | text, bg, ch, choice, jump, effect, screen_filter | Phase 1 | — |
| **2** | 分岐やフラグを入れたい | + set_var, if, choice の condition | **既存** | — |
| **3** | 再利用したい | + templates, call | Phase 2 | — |
| **4** | RPG要素を入れたい | + gameDb, battle, map, map_jump | Phase 3–5 | **ここでツクール相当** |
| **5** | UI を自分好みにしたい | + PlayLayout, set-layout | Phase 6 | ツクール超え |
| **∞** | 何でもやりたい | + timeline, ksc（既存） | — | — |

- **Lv.1–2 は今すぐリリースできる** — ノベル制作 + 分岐/フラグは全て実装済み
- **Lv.4（Phase 5 完了）がツクール相当ライン** — データベース + バトル + マップ + イベントが揃う
- **Lv.5 はツクールを超える** — ツクールにはない PlayLayout（UI 自由配置）が加わる
- **Lv.∞** の timeline / ksc は既存14ブロック型に含まれており、実装不要。上級者のエスケープハッチ

---

## 12. 実装ロードマップ

### ツクール機能との対応

| ツクールの機能 | kaedevn の対応 | Phase | 関連資料 |
|--------------|--------------|:-----:|---------|
| **メッセージ表示** | `text` ブロック | 既存 | — |
| **選択肢** | `choice` ブロック | 既存 | — |
| **背景/キャラ表示** | `bg` / `ch` ブロック | 既存 | — |
| **画面エフェクト** | `effect` / `screen_filter` ブロック | 既存 | — |
| **ピクチャ** | `overlay` ブロック | 既存 | — |
| **BGM/SE** | KSC `@playBgm` / `@playSe` | 既存 | — |
| **タイムライン演出** | `timeline` ブロック | 既存 | — |
| **スクリプト直書き** | `ksc` ブロック | 既存 | — |
| **ページ遷移** | `jump` ブロック | 既存 | — |
| **バトル（呼び出し）** | `battle` ブロック | 既存 | — |
| **スイッチ/変数** | `set_var`（=, +=, -=）+ `if`（6比較演算子, &&/\|\|） | **既存** | 本書 §3 |
| **条件分岐** | `if` ブロック（thenBlocks/elseBlocks） | **既存** | 本書 §3 |
| **セーブ/ロード（ノベル）** | schema v1（vars, read, node_id） | 既存 | — |
| **ショップ** | `choice` + `set_var` の組み合わせ | **既存** | 本書 §8 |
| ── ここまで既存（**リリース可能**） ── | | | |
| **コモンイベント** | `templates[]` + `call` ブロック | **Phase 2** | 本書 §4 |
| **データベース（キャラ/敵/技/アイテム）** | `gameDb` スキーマ | **Phase 3** | 本書 §5 |
| **バトル（ランタイム）** | ダメージ計算、行動AI、勝敗分岐 | **Phase 4** | 本書 §6 |
| **マップイベント** | マップ上の NPC・宝箱（複数ページ+条件） | **Phase 5** | 本書 §7 |
| **マップ ↔ シナリオ接続** | `map_jump` ブロック、エンカウント | **Phase 5** | 本書 §7 |
| ── ここまででツクール相当 ── | | | |
| **UIレイアウト自由配置** | PlayLayout JSON（20要素） | **Phase 6** | 09〜13 |
| **プリセット切り替え** | novel-standard / rpg-classic / etc. | **Phase 6** | 11 |

### Phase 一覧

各 Phase にはセーブデータ対応が含まれる。機能を作ってもセーブできなければプレイできない。

| Phase | 到達Lv | 内容 | 追加するもの | セーブ対応 | 規模 |
|:-----:|:------:|------|------------|----------|:----:|
| **1** | Lv.1–2 | ノベル完結 + CLI | create-story / story-preview / auth スキル | schema v1 そのまま（既存で完結） | 小 |
| | | **━━ Phase 1 完了 = リリース可能 ━━** | | | |
| **2** | Lv.3 | コモンイベント | `templates[]` 配列、`call` ブロック型 | 変更なし（テンプレートは定義側） | 小 |
| **3** | Lv.4 | ゲームDB | `gameDb` スキーマ（actors/enemies/skills/items）、edit-db スキル | + `inventory`（所持アイテム/装備/ゴールド） | 中 |
| **4** | Lv.4 | バトル | バトルランタイム、ダメージ計算（formula eval）、勝敗分岐 | + `party`（HP/MP/レベル/経験値/ステート） | 大 |
| **5** | Lv.4 | マップ連携 | `map_jump` ブロック、マップイベント（複数ページ+条件）、エンカウント | + `mapState`（現在マップ/座標/向き） | 大 |
| | | **━━ Phase 5 完了 = ツクール相当 ━━** | | | |
| **6** | Lv.5 | UIカスタマイズ | PlayLayout 全20要素のランタイム実装、set-layout スキル | 変更なし（レイアウトはプロジェクト定義側） | 中 |

### セーブスキーマの段階的拡張

```
schema v1（既存）         → Phase 1–2 で使用（変更なし）
{
  save_schema_version: 1,
  node_id: "...",          // 現在のブロック位置
  vars: { 好感度: 10 },    // フラグ・変数（文字列も格納可能）
  read: { page1: true },  // 既読ページ
  timestamp: ...
}

schema v1.1（Phase 3）    → inventory 追加
{
  ...v1,
  save_schema_version: 1.1,
  inventory: {
    gold: 250,
    items: { "item-herb": 3, "item-iron-sword": 1 },
    equipment: { "actor-hero": { weapon: "item-iron-sword", armor: "item-leather" } }
  }
}

schema v1.2（Phase 4）    → party 追加
{
  ...v1.1,
  save_schema_version: 1.2,
  party: {
    members: ["actor-hero", "actor-mage"],
    states: {
      "actor-hero": { hp: 85, mp: 20, level: 3, exp: 120, states: [] },
      "actor-mage": { hp: 45, mp: 60, level: 2, exp: 80, states: ["poison"] }
    }
  }
}

schema v1.3（Phase 5）    → mapState 追加
{
  ...v1.2,
  save_schema_version: 1.3,
  mapState: {
    currentMapId: "map-village",
    playerX: 10, playerY: 8,
    direction: "down",
    visitedMaps: ["map-village", "map-forest"]
  }
}
```

**後方互換**: ロード時に `save_schema_version` を見て、ないフィールドはデフォルト値で補完。v1 のセーブデータも v1.3 のランタイムで読める。

- **Phase 1 は PoC 完了済み**（19-create-story-poc-result.md）。スキルファイルを書けばリリース可能
- Phase 2 はブロック型の追加だけなので軽い。セーブ変更なし
- **Phase 3–5 が本丸**（ゲームDB + バトル + マップ連携）。各 Phase でセーブスキーマも段階的に拡張
- Phase 6 はツクールにない独自機能（UI自由配置）。セーブ変更なし

### 既存のツクール関連資料

| # | ファイル | 内容 | 関連Phase |
|---|---------|------|:--------:|
| 09 | `09-tsukuru-editor-spec.md` | ツクール型エディタ全体仕様 | Phase 7 |
| 10 | `10-tsukuru-layout-preview.html` | PlayLayout プレビュー（ブラウザで開ける） | Phase 7 |
| 11 | `11-tsukuru-preset-json.md` | 4プリセットの PlayLayout JSON 定義 | Phase 7 |
| 12 | `12-tsukuru-ui-parts-design.md` | 20 UI要素のデザイン仕様 | Phase 7 |
| 13 | `13-tsukuru-runtime-integration.md` | エンジンへの統合手順（7ステップ） | Phase 7 |
| 14 | `14-tsukuru-user-needs-v2.md` | ユーザーニーズ44項目（既存/新規/ロードマップ） | 全体 |
| 15 | `15-tsukuru-claude-code-cli.md` | Claude Code CLI でのゲーム制作検討 | Phase 1 |
| 16 | `16-tsukuru-cli-catalog.md` | 既存 CLI/スキル 111本カタログ | 全体 |
| 17 | `17-creation-tools-for-authors.md` | 作者向けツールカタログ | 全体 |
| 18 | `18-game-creation-cli-design.md` | ゲーム制作スキル設計（8スキル） | Phase 1–7 |
| 19 | `19-create-story-poc-result.md` | create-story PoC 結果 | Phase 1 |
| 20 | `20-rpg-tkool-concept-map.md` | 本書 | 全体 |
