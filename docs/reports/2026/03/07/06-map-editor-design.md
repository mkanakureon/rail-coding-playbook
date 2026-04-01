# マップエディタ設計書

## 目的

ドット絵タイルチップ（完成済み素材）を使い、タイルマップ方式でマップを作成するエディタ。
**人間が GUI で操作する**ことも、**Claude Code が API/JSON 直接編集で操作する**ことも可能にする。

---

## 設計原則

1. **データが真実** — マップは JSON ファイル。GUI もAI も同じ JSON を読み書きする
2. **既存アーキテクチャ踏襲** — ブラウザエディタ → JSON → ランタイム（PixiJS / SDL2）
3. **タイルチップは外部素材** — エディタはタイルを「並べる」ことに集中する
4. **AI ファースト** — JSON 構造は Claude Code が理解・生成しやすい形にする

---

## 1. データモデル

### 1.1 タイルセット定義 (`TilesetDef`)

```typescript
interface TilesetDef {
  id: string;                    // "tileset-forest"
  name: string;                  // 英語名（コード用）: "forest"
  label: string;                 // 日本語名（表示/AI用）: "森タイルセット"
  description?: string;          // 説明: "森・草原・水辺の基本タイル"
  src: string;                   // "assets/tilesets/forest.png"
  tileWidth: number;             // デフォルト: 48（ツクール MZ 互換）
  tileHeight: number;            // デフォルト: 48
  columns: number;               // PNG内の横タイル数（自動算出も可）
  tileCount?: number;            // 総タイル数（省略時は PNG から自動算出）
  defaultTileId?: number;        // 空白を埋めるデフォルトタイル（例: 草地=3）
  tags?: string[];               // セット全体のタグ: ["屋外", "ファンタジー"]
  tiles?: Record<number, TileMeta>;  // タイルごとの追加情報
  autoTiles?: AutoTileDef[];     // オートタイル定義
}

interface TileMeta {
  name: string;                  // 英語ID（コード/CLI用）: "wall-top-left"
  label?: string;                // 日本語名（表示/AI用）: "壁・左上角"
  terrain?: string;              // 地形グループ: "grass" | "water" | "wall"
  passable?: boolean;            // 通行可否（デフォルト: true）
  layer?: "ground" | "decor" | "overhead";  // 配置推奨レイヤー
  tags?: string[];               // 自由タグ: ["角", "壁", "室内"]
  variantOf?: string;            // バリエーション元の name（例: "grass" の色違い）
  footstep?: string;             // 足音SE ID: "se-grass-step"
  damage?: number;               // ダメージ床（0=なし, 正数=HP減少/歩）
  slip?: boolean;                // 滑る床（氷など）
  animFrames?: number[];         // アニメーションタイル: [0, 1, 2, 3]
  animFps?: number;              // アニメーションFPS
}

interface AutoTileDef {
  name: string;                  // "water-auto"
  label?: string;                // "水（オートタイル）"
  terrain: string;               // "water"
  baseTileId: number;            // パレット上の代表タイルID
  variants: Record<number, number>;  // bitmask → 実タイルID
  mode?: "4bit" | "8bit";       // 判定方式（デフォルト: "4bit"）
}
```

**タイルサイズの選定根拠:**
- 48x48 = ツクール MZ と同一。素材互換・作者の感覚互換
- 1280x720 で 横26.67 x 縦15 タイル表示（端はスクロールで処理、ツクール MZ も同じ）
- フルHD（1920x1080）で x1.5 拡大 → 72px 表示 = ツクール MZ と同等の見た目
- タイルサイズは JSON の数値なので後から変更可能（コード変更不要、素材の描き直しのみ）

**タイル ID のルール:**
- タイルセット PNG を左上から右方向にスキャンし、0-indexed で番号を振る
- 例: 48x48タイル、PNG が 480x480 → columns=10、タイルID 0〜99
- `-1` は「空（タイルなし）」を表す

**name / label の使い分け:**
- `name`: CLI・コード・gen-layer で使う英語識別子（一意）
- `label`: GUI表示・AI への日本語説明（重複可）
- gen-layer は name でも label でも検索できる

### 1.2 マップデータ (`MapData`)

```typescript
interface MapData {
  id: string;                    // "map-001"
  name: string;                  // 内部名（英語）: "village-start"
  label: string;                 // 表示名（日本語可）: "始まりの村"
  description?: string;          // AI/人間向け説明: "冒険の起点となる小さな村。北に森、南に港。"
  width: number;                 // マップ幅（タイル数）
  height: number;                // マップ高さ（タイル数）
  tileWidth: number;             // 1タイルのピクセル幅
  tileHeight: number;            // 1タイルのピクセル高さ
  tilesets: string[];            // 使用タイルセットID ["tileset-forest", "tileset-interior"]
  layers: MapLayer[];            // レイヤー（下から順に描画）
  events: MapEvent[];            // イベント配置

  // --- プレイヤー初期位置 ---
  playerStart?: {
    x: number;                   // 初期タイル座標X
    y: number;                   // 初期タイル座標Y
    direction?: "down" | "left" | "right" | "up";
  };

  // --- マップ間接続 ---
  connections?: MapConnection[];

  // --- 演出 ---
  bgm?: { id: string; vol?: number };           // BGM（マップ遷移時に自動再生）
  bgs?: { id: string; vol?: number };           // 環境音（風、川、雨など）
  tint?: { r: number; g: number; b: number; a: number };  // 色調変更（夕方=橙、夜=青暗）
  weather?: "none" | "rain" | "snow" | "fog";   // 天候エフェクト
  parallax?: MapParallax;                        // 遠景（スクロール背景）

  // --- RPG要素 ---
  encounterRate?: number;        // エンカウント率（0=エンカウントなし, 1-100）
  encounters?: MapEncounter[];   // エンカウントテーブル

  // --- スクロール ---
  scrollType?: "none" | "scroll" | "loop-x" | "loop-y" | "loop-both";

  // --- メタ ---
  tags?: string[];               // 検索用タグ: ["屋外", "村", "序盤"]
  note?: string;                 // 開発メモ（ランタイムでは無視）
}

interface MapParallax {
  src: string;                   // "assets/parallax/sky.png"
  scrollX?: number;              // 横スクロール速度（0=固定, 正数=右方向）
  scrollY?: number;              // 縦スクロール速度
  fixedToMap?: boolean;          // true=マップに固定, false=カメラに追従
}

interface MapConnection {
  direction: "north" | "south" | "east" | "west";
  targetMapId: string;           // 遷移先マップID
  targetX?: number;              // 遷移先の出現座標X
  targetY?: number;              // 遷移先の出現座標Y
  offset?: number;               // 接続位置のタイルオフセット
}

interface MapEncounter {
  troopId: string;               // 敵グループID
  weight: number;                // 出現重み（確率配分）
  regionIds?: number[];          // 特定リージョンでのみ出現（省略=全域）
}

interface MapLayer {
  id: string;                    // "layer-ground"
  name: string;                  // 英語名: "ground"
  label?: string;                // 日本語名: "地面"
  type: "tile" | "collision" | "region";
  visible: boolean;
  opacity: number;               // 0.0〜1.0
  zIndex?: number;               // 描画順の明示指定（省略時は layers 配列順）
  data: number[];                // タイルID配列（length = width * height）
  tilesetId?: string;            // このレイヤーが使うタイルセット（省略時は tilesets[0]）
  parallaxFactor?: number;       // 視差スクロール係数（0.5=半速、1.0=等速、2.0=倍速）
}

interface MapEvent {
  id: string;                    // "event-001"
  name: string;                  // 英語名: "villager-a"
  label?: string;                // 日本語名: "村人A"
  x: number;                     // タイル座標X
  y: number;                     // タイル座標Y
  sprite?: EventSprite;          // 見た目
  trigger: "action" | "touch" | "auto" | "parallel";
  scenarioId?: string;           // 発火するシナリオID（既存のノベルシナリオと接続）
  conditions?: EventCondition[];

  // --- NPC挙動 ---
  moveRoute?: MoveRoute;         // 自動移動パターン
  through?: boolean;             // すり抜け可能か（デフォルト: false）
  priority: "below" | "same" | "above";  // プレイヤーとの表示優先度

  // --- 複数ページ（ツクール式） ---
  pages?: EventPage[];           // 条件別のイベントページ（省略時は単一ページ扱い）

  // --- メタ ---
  note?: string;                 // 開発メモ: "クリア後に消える"
}

interface EventPage {
  id: string;
  conditions: EventCondition[];  // このページが有効になる条件
  sprite?: EventSprite;
  trigger: "action" | "touch" | "auto" | "parallel";
  scenarioId?: string;
  moveRoute?: MoveRoute;
  through?: boolean;
  priority?: "below" | "same" | "above";
}

interface EventSprite {
  src: string;                   // "assets/characters/villager.png"
  frameWidth: number;
  frameHeight: number;
  direction: "down" | "left" | "right" | "up";
  pattern?: number;              // 初期フレーム番号（デフォルト: 0）
  animFps?: number;
  opacity?: number;              // 0.0〜1.0（半透明イベント）
  blendMode?: "normal" | "add"; // 加算合成（光エフェクト等）
}

interface MoveRoute {
  type: "fixed" | "random" | "path" | "chase" | "flee";
  speed?: number;                // 移動速度（1=最遅〜6=最速, デフォルト: 3）
  path?: Array<"up" | "down" | "left" | "right" | "wait">;  // type="path" 時の経路
  repeat?: boolean;              // 巡回するか（デフォルト: true）
}

interface EventCondition {
  type: "switch" | "variable";
  name: string;
  op?: "==" | "!=" | ">" | "<" | ">=" | "<=";
  value: unknown;
}
```

### 1.3 data 配列のレイアウト

```
data[y * width + x] = tileId
```

例: 4x3 マップ
```json
{
  "width": 4,
  "height": 3,
  "data": [
    0,  1,  1,  2,
    3,  4,  4,  5,
    6,  7,  7,  8
  ]
}
```

→ これは AI が最も理解しやすい形式。2D配列にしない理由は JSON の行数削減と互換性（Tiled形式と同じ）。

### 1.4 コリジョンレイヤー

```
0 = 通行可
1 = 通行不可
2 = カウンター越し（ツクールの「カウンター属性」相当）
```

タイルの `passable` プロパティから自動生成も可能だが、手動上書きできる。

---

## 2. AI（Claude Code）によるマップ生成

### 2.1 なぜ JSON が AI 向きか

- マップは本質的に「数値の2D配列 + メタデータ」
- Claude Code は JSON を直接 Write できる
- タイルの `name` / `terrain` ラベルがあれば、意味を理解してマップを構築できる

### 2.2 AI マップ生成フロー

```
1. タイルセット定義を読む（TileMeta の name/terrain を確認）
2. マップの要件を受ける（「20x15の村マップ、中央に広場、右に民家2軒」）
3. MapData JSON を生成して Write
4. 人間がエディタで確認・微調整
```

### 2.3 AI 用コンテキスト（`_ai_context` 拡張）

既存の `GET /api/projects/:id` の `_ai_context` に追加：

```typescript
interface MapAIContext {
  availableTilesets: Array<{
    id: string;
    name: string;
    label: string;
    tileWidth: number;
    tileHeight: number;
    tags: string[];
    tiles: Array<{
      tileId: number;
      name: string;
      label: string;
      terrain: string;
      passable: boolean;
      layer: string;
      tags: string[];
    }>;
  }>;
  existingMaps: Array<{
    id: string;
    name: string;
    label: string;
    width: number;
    height: number;
    tags: string[];
  }>;
}
```

### 2.4 AI マップ生成の具体例

ユーザー指示: 「10x8 の小さな部屋を作って。床は木の板、壁で囲む、入口は下中央」

**Step 1: タイルセットを確認する**

```bash
node scripts/map-cli.mjs tiles tileset-interior
#  0: wall-top-left    壁・左上角     terrain:wall   passable:false  [角,壁,室内]
#  1: wall-top         壁・上端       terrain:wall   passable:false  [壁,室内]
#  2: wall-top-right   壁・右上角     terrain:wall   passable:false  [角,壁,室内]
#  3: wall-left        壁・左端       terrain:wall   passable:false  [壁,室内]
#  4: wall-right       壁・右端       terrain:wall   passable:false  [壁,室内]
#  5: wall-btm-left    壁・左下角     terrain:wall   passable:false  [角,壁,室内]
#  6: wall-btm         壁・下端       terrain:wall   passable:false  [壁,室内]
#  7: wall-btm-right   壁・右下角     terrain:wall   passable:false  [角,壁,室内]
# 10: wood-floor       木の床         terrain:floor  passable:true   [床,室内]
# 11: wood-floor-2     木の床・暗     terrain:floor  passable:true   [床,室内]
# 20: door             ドア           terrain:door   passable:true   [入口,室内]
```

**Step 2: name 指定で gen-layer するか、tileId で直接 JSON を書く**

方法A — name 指定（推奨）:
```bash
node scripts/map-cli.mjs gen-layer tileset-interior map-room-001 layer-ground <<'EOF'
壁・左上角  壁・上端  壁・上端  壁・上端  壁・上端  壁・上端  壁・上端  壁・上端  壁・上端  壁・右上角
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左端    木の床    木の床    木の床    木の床    木の床    木の床    木の床    木の床    壁・右端
壁・左下角  壁・下端  壁・下端  壁・下端  ドア      ドア      壁・下端  壁・下端  壁・下端  壁・右下角
EOF
```

方法B — tileId 直接指定:

Claude Code が生成する JSON:
```json
{
  "id": "map-room-001",
  "name": "small-room",
  "label": "小さな部屋",
  "description": "木の床の小部屋。下中央にドアがある。",
  "width": 10,
  "height": 8,
  "tileWidth": 48,
  "tileHeight": 48,
  "tilesets": ["tileset-interior"],
  "tags": ["室内", "序盤"],
  "playerStart": { "x": 4, "y": 6, "direction": "down" },
  "scrollType": "none",
  "layers": [
    {
      "id": "layer-ground",
      "name": "ground",
      "label": "地面",
      "type": "tile",
      "visible": true,
      "opacity": 1.0,
      "tilesetId": "tileset-interior",
      "data": [
        0,  1,  1,  1,  1,  1,  1,  1,  1,  2,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        3, 10, 10, 10, 10, 10, 10, 10, 10,  4,
        5,  6,  6,  6, 20, 20,  6,  6,  6,  7
      ]
    },
    {
      "id": "layer-collision",
      "name": "collision",
      "label": "通行判定",
      "type": "collision",
      "visible": false,
      "opacity": 1.0,
      "data": [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 1, 1, 1, 0, 0, 1, 1, 1, 1
      ]
    }
  ],
  "events": [
    {
      "id": "event-door",
      "name": "exit-door",
      "label": "出口",
      "x": 4,
      "y": 7,
      "trigger": "touch",
      "priority": "below",
      "scenarioId": "scenario-exit-room",
      "note": "外のマップへ遷移"
    }
  ]
}
```

### 2.5 AI 操作パターン

| 操作 | 方法 |
|------|------|
| マップ新規作成 | JSON を Write |
| タイル一括配置 | data 配列を書き換えて Write |
| イベント追加 | events 配列に追加 |
| レイヤー追加 | layers 配列に追加 |
| マップ修正 | Read → 部分変更 → Write |
| マップ検証 | Read して width*height と data.length の一致を確認 |

---

## 3. ブラウザエディタ（人間向け GUI）

### 3.1 画面構成

```
+-------+---------------------------+----------+
| タイル |                           | プロパ   |
| パレット|      マップキャンバス       | ティ     |
|       |      (PixiJS)             | パネル   |
|       |                           |          |
| [セット|                           | [レイヤー|
|  選択] |                           |  一覧]   |
|       |                           |          |
| [タイル|                           | [イベント|
|  一覧] |                           |  一覧]   |
+-------+---------------------------+----------+
|              ツールバー                       |
| [ペン] [矩形] [塗りつぶし] [消しゴム] [スポイト]|
+----------------------------------------------+
```

### 3.2 描画ツール

| ツール | 動作 | ショートカット |
|--------|------|---------------|
| ペン | クリック/ドラッグでタイル配置 | B |
| 矩形 | 矩形範囲を選択タイルで塗る | R |
| 塗りつぶし | 同一タイルの連続領域を置換 | G |
| 消しゴム | タイルを -1（空）にする | E |
| スポイト | クリックしたタイルを選択 | I |
| 範囲選択 | コピー/ペースト/移動 | M |

### 3.3 レイヤー操作

- レイヤーの表示/非表示トグル
- レイヤーの不透明度調整
- 編集対象レイヤーの切り替え
- コリジョンレイヤーは赤/緑の半透明オーバーレイで表示

### 3.4 技術スタック

- **描画**: PixiJS（既存の packages/web と同じ）
- **状態管理**: Zustand（既存の apps/editor と同じ）
- **配置先**: `apps/editor` 内に `/map-editor` ルートとして追加

---

## 4. ランタイム描画

### 4.1 PixiJS（Web）

```typescript
// レイヤーごとに CompositeTilemap を使用
import { CompositeTilemap } from "@pixi/tilemap";

function renderMapLayer(layer: MapLayer, tileset: TilesetDef): CompositeTilemap {
  const tilemap = new CompositeTilemap();
  const texture = Texture.from(tileset.src);

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tileId = layer.data[y * mapWidth + x];
      if (tileId < 0) continue;

      const srcX = (tileId % tileset.columns) * tileset.tileWidth;
      const srcY = Math.floor(tileId / tileset.columns) * tileset.tileHeight;

      tilemap.tile(texture, x * tileset.tileWidth, y * tileset.tileHeight, {
        u: srcX, v: srcY,
        tileWidth: tileset.tileWidth,
        tileHeight: tileset.tileHeight,
      });
    }
  }
  return tilemap;
}
```

### 4.2 SDL2（Switch）

- `SDL_RenderCopy` でタイルを1枚ずつ描画
- マップ JSON をそのまま読み込み、同じロジックで描画
- カメラ（スクロール）は画面内のタイルだけ描画（カリング）

### 4.3 カメラ / スクロール

```typescript
interface MapCamera {
  x: number;        // カメラ中心のピクセル座標
  y: number;
  zoom: number;     // 1.0 = 等倍
  followTarget?: string;  // キャラクターIDを指定で自動追従
}
```

- 論理解像度 1280x720 に対して、表示範囲外のタイルは描画しない
- プレイヤーキャラが画面端に近づいたらスクロール

---

## 5. 既存システムとの統合

### 5.1 ノベルパート ↔ マップパートの切り替え

```
マップ探索 → イベント発火 → ノベルシナリオ再生 → マップに戻る
```

Op に追加が必要：

```typescript
// マップ遷移
| { op: "MAP_LOAD"; mapId: string; startX: number; startY: number }
| { op: "MAP_UNLOAD" }

// マップ上のプレイヤー操作
| { op: "MAP_MOVE_PLAYER"; x: number; y: number; speed?: number }
| { op: "MAP_SCROLL"; x: number; y: number; speed?: number }
```

### 5.2 セーブデータ拡張

SaveData の `vars` に含める（save_schema_version は変えない）：

```json
{
  "vars": {
    "_map_id": "map-001",
    "_map_player_x": 5,
    "_map_player_y": 3,
    "_map_player_dir": "down"
  }
}
```

`_` プレフィックス = エンジン内部変数の規約。

### 5.3 ファイル配置

```
project/
├── assets/
│   ├── tilesets/
│   │   ├── forest.png
│   │   └── interior.png
│   └── characters/
│       └── player.png
├── maps/
│   ├── tilesets.json          # TilesetDef[]
│   ├── map-001.json           # MapData
│   └── map-002.json           # MapData
└── scenarios/
    └── ...
```

---

## 6. オートタイル

### 6.1 概要

ツクールのオートタイルは隣接タイルの状態に応じて自動的に接続形状を選ぶ機能。
マップ制作の効率に直結するため、**マップエディタの必須機能**。

### 6.2 方式: 4bit（簡易）→ 8bit（完全）の段階実装

オートタイル定義は `TilesetDef.autoTiles` に格納する（1.1 参照）。

**Phase 1: 4bit オートタイル（上下左右の4方向）**
- 隣接4方向のみ判定 → 16パターン
- 実装が簡単、ほとんどのケースで十分

```json
{
  "autoTiles": [
    {
      "name": "water-auto",
      "label": "水（オートタイル）",
      "terrain": "water",
      "baseTileId": 40,
      "mode": "4bit",
      "variants": {
        "0": 40, "1": 41, "2": 42, "3": 43,
        "4": 44, "5": 45, "6": 46, "7": 47,
        "8": 48, "9": 49, "10": 50, "11": 51,
        "12": 52, "13": 53, "14": 54, "15": 55
      }
    }
  ]
}
```

bitmask: 上=1, 右=2, 下=4, 左=8
例: 上と右が同じ地形 → 1+2=3 → variants[3] のタイルを使用

**Phase 2: 8bit（角も含む、47パターン）**
- ツクール MV/MZ と同等の品質
- `mode: "8bit"` に切り替えるだけで拡張可能

### 6.3 AI でのオートタイル

AI はオートタイルを意識せず、terrain 名で指定する：

```json
{
  "layer": "ground",
  "fill": [
    "wall  wall  wall  wall  wall",
    "wall  grass grass grass wall",
    "wall  grass water grass wall",
    "wall  grass grass grass wall",
    "wall  wall  wall  wall  wall"
  ]
}
```

エディタ/ランタイムが terrain → 実タイルID に解決する。
これにより AI は見た目のパターンを気にせず、意味だけでマップを記述できる。

---

## 7. 実装フェーズ

### Phase A: 最小マップエディタ（MVP）

- [ ] `MapData` / `TilesetDef` 型定義（packages/core）
- [ ] タイルセット PNG 読み込み・パレット表示
- [ ] タイル配置（ペンツール）
- [ ] レイヤー切り替え
- [ ] コリジョンレイヤーの編集・表示
- [ ] JSON 保存/読み込み
- [ ] PixiJS でのマップ描画（packages/web）
- [ ] AI による JSON 直接生成のテスト

### Phase B: 実用レベル

- [ ] 矩形塗り・塗りつぶし・消しゴム・スポイト
- [ ] Undo/Redo
- [ ] イベント配置 GUI
- [ ] イベント → シナリオ接続
- [ ] 4bit オートタイル
- [ ] MAP_LOAD / MAP_UNLOAD Op 実装
- [ ] terrain ベースの AI マップ記述

### Phase C: 完成形

- [ ] 8bit オートタイル
- [ ] プレイヤーキャラの移動・カメラ追従
- [ ] マップ間遷移
- [ ] コピー/ペースト・範囲選択
- [ ] ミニマップ表示
- [ ] SDL2 ランタイムでのマップ描画

---

## 8. AI 生成 vs 人間編集の使い分け

| 作業 | 推奨 | 理由 |
|------|------|------|
| 地形の大枠（草原・森・水辺の配置） | AI | terrain 指定で一発生成 |
| 細かい装飾配置 | 人間 | 見た目の微調整は GUI が速い |
| コリジョン設定 | AI + 人間確認 | 自動生成 → 目視チェック |
| イベント配置・設定 | 人間 | ゲームデザインの判断が必要 |
| 大量の部屋・ダンジョン量産 | AI | パターン生成が得意 |
| NPC 配置・セリフ | AI | シナリオ生成と一体で |

---

*文書作成: Claude Code (Claude Opus 4.6) — 2026-03-07*
