# CLI によるエディタ操作設計書

## 目的

ブラウザを経由せず、Claude Code（または任意の CLI ツール）からブロックエディタとマップエディタを操作できるようにする。

**核心的な発見: ブラウザエディタと Claude Code は同じ API を叩いている。** ブラウザは GUI → Zustand → API PUT という経路を取るが、Claude Code は API を直接叩けば同じ結果になる。必要なのは API の薄いラッパーだけ。

---

## 1. 現状の構造

```
ブラウザエディタ (GUI)
  ↓ Zustand state 操作
  ↓ PUT /api/projects/:id  ← JSON { pages: [{ blocks: [...] }] }
  ↓
Hono API → PostgreSQL (data カラムに JSON 保存)

Claude Code (CLI)
  ↓ curl / fetch で直接
  ↓ PUT /api/projects/:id  ← 同じ JSON
  ↓
Hono API → PostgreSQL (同じ)
```

プロジェクトデータは PostgreSQL の単一 JSON カラムに格納されている。ブラウザもCLIも、最終的には同じ JSON を PUT するだけ。

---

## 2. 既存 API（すでに使える）

### プロジェクト操作

| メソッド | エンドポイント | 用途 |
|---------|--------------|------|
| GET | `/api/projects/:id` | プロジェクト取得（blocks + `_ai_context`） |
| PUT | `/api/projects/:id` | プロジェクト更新（pages/blocks の保存） |
| GET | `/api/editor-schema` | ブロック型スキーマ（全14型の定義） |

### キャラクター操作

| メソッド | エンドポイント | 用途 |
|---------|--------------|------|
| PUT | `/api/projects/:pid/characters/:cid` | キャラクター更新 |
| PUT | `/api/projects/:pid/characters/:cid/expressions/:eid` | 表情更新 |

### アセット操作

| メソッド | エンドポイント | 用途 |
|---------|--------------|------|
| PATCH | `/api/assets/:projectId/:assetId` | アセットの slug 更新 |

### `_ai_context`（GET /api/projects/:id のレスポンスに含まれる）

```json
{
  "_ai_context": {
    "schemaEndpoint": "/api/editor-schema",
    "availableAssets": [{ "id": "...", "name": "..." }],
    "availableCharacters": [{ "id": "...", "slug": "hero", "expressions": [...] }],
    "availablePages": [{ "id": "page1", "name": "第1話" }],
    "knownVariables": ["affection", "score"]
  }
}
```

---

## 3. CLI ラッパー設計

### 3.1 なぜ CLI が必要か

API は既に使えるが、毎回 curl で JSON を組み立てるのは：

- Claude Code にとって冗長（大きな JSON の Read → 編集 → PUT）
- バリデーションがない（壊れた JSON を PUT できてしまう）
- 人間可読な出力がない（生 JSON は読みにくい）

CLI は「よく使う操作を安全に短く書ける」ためのもの。

### 3.2 ブロックエディタ CLI (`scripts/editor-cli.mjs`)

```bash
# ----- 閲覧系 -----

# プロジェクト一覧
node scripts/editor-cli.mjs list
# → project-abc  "異世界転生物語"  3 pages  updatedAt: 2026-03-07
# → project-def  "学園ミステリー"  5 pages  updatedAt: 2026-03-06

# ブロック一覧（人間 + AI 可読な要約）
node scripts/editor-cli.mjs blocks <projectId>
# → page "第1話" (page1):
#   [0] start                        start-1741334400000
#   [1] bg: fantasy_castle           bg-1741334400001
#   [2] ch: hero (smile) pos=C       ch-1741334400002
#   [3] text: "ここにセリフを..."     text-1741334400003
#   [4] choice: 2 options            choice-1741334400004
#   [5] jump → 第2話                 jump-1741334400005

# コンテキスト確認（利用可能なアセット・キャラ・ページ）
node scripts/editor-cli.mjs context <projectId>
# → Assets (bg): fantasy_castle, sunset_beach, school_hallway
# → Characters: hero (smile, angry, sad), heroine (normal, blush)
# → Pages: 第1話 (page1), 第2話 (page2), バッドエンド (page-bad)
# → Variables: affection, score

# ----- 編集系 -----

# ブロック追加（末尾に追加）
node scripts/editor-cli.mjs add <projectId> <pageId> text \
  --body "こんにちは" --speaker "主人公"

# ブロック追加（指定位置に挿入）
node scripts/editor-cli.mjs add <projectId> <pageId> bg \
  --assetId "asset-xxx" --after "text-1741334400003"

# ブロック更新
node scripts/editor-cli.mjs update <projectId> <blockId> \
  --body "セリフを変更しました"

# ブロック削除
node scripts/editor-cli.mjs remove <projectId> <blockId>

# ブロック移動
node scripts/editor-cli.mjs move <projectId> <blockId> up
node scripts/editor-cli.mjs move <projectId> <blockId> down

# ----- ページ操作 -----

# ページ追加
node scripts/editor-cli.mjs add-page <projectId> "第3話"

# ページ名変更
node scripts/editor-cli.mjs rename-page <projectId> <pageId> "クライマックス"

# ページ削除
node scripts/editor-cli.mjs remove-page <projectId> <pageIndex>

# ----- 一括操作（AI 向け） -----

# JSON ファイルからブロック一括インポート
node scripts/editor-cli.mjs import <projectId> <pageId> blocks.json

# 現在のブロックを JSON でエクスポート
node scripts/editor-cli.mjs export <projectId> > project.json

# バリデーション
node scripts/editor-cli.mjs validate <projectId>
# → OK: 3 pages, 12 blocks, all references valid
# → ERROR: block ch-xxx references unknown characterId "ghost"
```

### 3.3 マップエディタ CLI (`scripts/map-cli.mjs`)

```bash
# ----- タイルセット -----

# タイルセット一覧
node scripts/map-cli.mjs tilesets
# → tileset-forest: 森タイルセット (32x32, 16 columns, 256 tiles)
# → tileset-interior: 室内タイルセット (32x32, 16 columns, 128 tiles)

# タイル詳細（AI がタイルIDを調べる）
node scripts/map-cli.mjs tiles <tilesetId>
# →  0: wall-top-left     (terrain: wall, passable: false)
# →  1: wall-top          (terrain: wall, passable: false)
# →  2: wall-top-right    (terrain: wall, passable: false)
# →  3: grass             (terrain: grass, passable: true)
# →  4: grass-flower      (terrain: grass, passable: true)
# → ...

# ----- マップ操作 -----

# マップ一覧
node scripts/map-cli.mjs list
# → map-001: 始まりの村 (20x15, 3 layers, 2 events)
# → map-002: 森の洞窟 (30x20, 2 layers, 5 events)

# マップ詳細（テキストビジュアル）
node scripts/map-cli.mjs show <mapId>
# → map-001: 始まりの村 (20x15)
# → Layers: ground, decoration, collision
# → Events: 村人A (3,5), 宝箱 (10,2), 出口 (9,14)
# →
# → Layer "ground" (terrain view):
# → wall  wall  wall  wall  wall
# → wall  grass grass grass wall
# → wall  grass water grass wall
# → wall  grass grass grass wall
# → wall  wall  wall  wall  wall

# マップ新規作成（空マップ）
node scripts/map-cli.mjs create <mapId> --name "新しいマップ" \
  --width 20 --height 15 --tileset tileset-forest

# マップバリデーション
node scripts/map-cli.mjs validate <mapId>
# → OK: 20x15, 3 layers (all 300 tiles), 2 events in bounds
# → ERROR: layer "ground" has 299 tiles, expected 300

# ----- レイヤー操作 -----

# terrain テキストからレイヤー生成
node scripts/map-cli.mjs gen-layer <tilesetId> <mapId> <layerId> <<'EOF'
wall  wall  wall  wall  wall
wall  grass grass grass wall
wall  grass water grass wall
wall  grass grass grass wall
wall  wall  wall  wall  wall
EOF

# コリジョン自動生成（terrain の passable から）
node scripts/map-cli.mjs gen-collision <mapId>

# ----- イベント操作 -----

# イベント追加
node scripts/map-cli.mjs add-event <mapId> \
  --name "村人A" --x 3 --y 5 --trigger action \
  --scenarioId "scenario-villager-a"

# イベント削除
node scripts/map-cli.mjs remove-event <mapId> <eventId>
```

---

## 4. 実装の内部構造

### 4.1 ブロックエディタ CLI の中身

```typescript
// scripts/editor-cli.mjs
const API = process.env.KAEDEVN_API || "http://localhost:8080/api";

// --- API 通信 ---

async function getProject(id: string) {
  const res = await fetch(`${API}/projects/${id}`);
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json();
}

async function updateProject(id: string, data: any) {
  const res = await fetch(`${API}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
  return res.json();
}

// --- ブロック操作 ---

function generateBlockId(type: string): string {
  return `${type}-${Date.now()}`;
}

function addBlockToPage(pages: any[], pageId: string, block: any, afterBlockId?: string) {
  const page = pages.find((p: any) => p.id === pageId);
  if (!page) throw new Error(`Page not found: ${pageId}`);
  if (afterBlockId) {
    const idx = page.blocks.findIndex((b: any) => b.id === afterBlockId);
    if (idx === -1) throw new Error(`Block not found: ${afterBlockId}`);
    page.blocks.splice(idx + 1, 0, block);
  } else {
    page.blocks.push(block);
  }
  return pages;
}

// --- バリデーション ---

function validateProject(data: any): string[] {
  const errors: string[] = [];
  const { pages, _ai_context } = data;

  for (const page of pages) {
    // start ブロックチェック
    if (!page.blocks[0] || page.blocks[0].type !== "start") {
      errors.push(`Page "${page.name}": 先頭が start ブロックではない`);
    }
    // 参照整合性チェック
    for (const block of page.blocks) {
      if (block.type === "bg" && _ai_context) {
        const asset = _ai_context.availableAssets?.find((a: any) => a.id === block.assetId);
        if (!asset) errors.push(`Block ${block.id}: unknown assetId "${block.assetId}"`);
      }
      if (block.type === "jump") {
        const target = pages.find((p: any) => p.id === block.toPageId);
        if (!target) errors.push(`Block ${block.id}: unknown toPageId "${block.toPageId}"`);
      }
    }
  }
  return errors;
}
```

### 4.2 マップ CLI の中身

```typescript
// scripts/map-cli.mjs
import { readFileSync, writeFileSync } from "fs";

const MAPS_DIR = "maps";
const TILESETS_PATH = `${MAPS_DIR}/tilesets.json`;

// --- ファイルベース（マップはローカル JSON） ---

function loadMap(mapId: string) {
  return JSON.parse(readFileSync(`${MAPS_DIR}/${mapId}.json`, "utf-8"));
}

function saveMap(mapId: string, data: any) {
  writeFileSync(`${MAPS_DIR}/${mapId}.json`, JSON.stringify(data, null, 2));
}

function loadTilesets() {
  return JSON.parse(readFileSync(TILESETS_PATH, "utf-8"));
}

// --- terrain → tileId 解決 ---

function terrainToTileId(tilesetId: string, terrain: string): number {
  const tilesets = loadTilesets();
  const ts = tilesets.find((t: any) => t.id === tilesetId);
  if (!ts) throw new Error(`Tileset not found: ${tilesetId}`);

  for (const [idStr, meta] of Object.entries(ts.tiles ?? {})) {
    if ((meta as any).terrain === terrain) return Number(idStr);
  }
  throw new Error(`Terrain not found in ${tilesetId}: ${terrain}`);
}

// --- バリデーション ---

function validateMap(map: any): string[] {
  const errors: string[] = [];
  const expected = map.width * map.height;

  for (const layer of map.layers) {
    if (layer.data.length !== expected) {
      errors.push(
        `Layer "${layer.name}": ${layer.data.length} tiles, expected ${expected}`
      );
    }
  }

  for (const event of map.events ?? []) {
    if (event.x < 0 || event.x >= map.width || event.y < 0 || event.y >= map.height) {
      errors.push(`Event "${event.name}": (${event.x},${event.y}) is out of bounds`);
    }
  }

  return errors;
}
```

---

## 5. Skill 定義

### 5.1 `/edit-blocks` Skill

```
name: edit-blocks
description: ブロックエディタをCLIで操作する
```

Skill プロンプト展開:

```markdown
## ブロックエディタ CLI 操作

### 操作手順
1. コンテキスト確認: `node scripts/editor-cli.mjs context <projectId>`
2. 現在のブロック確認: `node scripts/editor-cli.mjs blocks <projectId>`
3. ブロック追加/編集/削除: `node scripts/editor-cli.mjs add|update|remove ...`
4. バリデーション: `node scripts/editor-cli.mjs validate <projectId>`

### 直接 API 操作（大規模変更時）
1. GET: `curl localhost:8080/api/projects/{id}`
2. JSON 編集（pages[].blocks[] を操作）
3. PUT: `curl -X PUT localhost:8080/api/projects/{id} -H 'Content-Type: application/json' -d @data.json`

### ブロック ID 生成規則
`{type}-{Date.now()}`（例: `text-1741334400000`）

### 制約
- start ブロックは各ページ先頭に1つ。削除不可
- assetId / characterId / expressionId は _ai_context の実在 ID を使う
- _ai_context は読み取り専用。PUT 時に含めても自動除去される
```

### 5.2 `/map` Skill

```
name: map
description: マップの作成・編集
```

Skill プロンプト展開:

```markdown
## マップ操作

### 新規作成
1. タイル確認: `node scripts/map-cli.mjs tiles <tilesetId>`
2. マップ作成: `node scripts/map-cli.mjs create <mapId> --name "..." --width N --height N --tileset <id>`
3. レイヤー生成（2つの方法）:
   a. terrain テキスト: `node scripts/map-cli.mjs gen-layer <tilesetId> <mapId> <layerId> < terrain.txt`
   b. JSON 直接 Write: maps/<mapId>.json の layers[].data を編集
4. コリジョン生成: `node scripts/map-cli.mjs gen-collision <mapId>`
5. バリデーション: `node scripts/map-cli.mjs validate <mapId>`

### 編集
1. 現状確認: `node scripts/map-cli.mjs show <mapId>`
2. JSON を Read → 編集 → Write
3. バリデーション: `node scripts/map-cli.mjs validate <mapId>`

### data 配列のルール
- `data[y * width + x] = tileId`
- `-1` = 空タイル
- `data.length` は必ず `width * height` と一致させる

### ファイル配置
- maps/tilesets.json — タイルセット定義
- maps/<mapId>.json — マップデータ
- assets/tilesets/ — タイルセット画像（PNG）
```

---

## 6. ブロックエディタ vs マップエディタの違い

| | ブロックエディタ | マップエディタ |
|--|---------------|--------------|
| データ保存先 | PostgreSQL（API 経由） | ローカル JSON ファイル |
| 操作方法 | API (GET/PUT) | ファイル Read/Write |
| ブラウザ連携 | リアルタイム同期（同じDB） | ファイル監視で同期 |
| バリデーション | 参照整合性（アセット・キャラ存在確認） | 構造整合性（data.length, 座標範囲） |
| AI 生成の得意分野 | シナリオ・会話・分岐 | 地形・部屋・ダンジョン |

### なぜマップはローカル JSON か

- マップデータは大きい（20x15x3レイヤー = 900タイル分の配列）
- 頻繁に Read/Write する
- git 管理したい（差分が見える）
- DB に入れると API 経由の往復が重い

将来的に DB 保存に移行する場合は、マップ用 API エンドポイントを追加するだけで CLI の中身を差し替えられる。

---

## 7. 実装フェーズ

### Phase 1: ブロックエディタ CLI（API は既存）

- [ ] `scripts/editor-cli.mjs` 実装
  - [ ] list / blocks / context（閲覧系）
  - [ ] add / update / remove / move（編集系）
  - [ ] add-page / rename-page / remove-page（ページ系）
  - [ ] import / export / validate（一括系）
- [ ] `/edit-blocks` Skill 定義
- [ ] 動作確認: Claude Code でシナリオ1本作成

### Phase 2: マップエディタ CLI（新規）

- [ ] `MapData` / `TilesetDef` 型定義（packages/core）
- [ ] `scripts/map-cli.mjs` 実装
  - [ ] tilesets / tiles（タイルセット系）
  - [ ] list / show / create（マップ系）
  - [ ] gen-layer / gen-collision（生成系）
  - [ ] add-event / remove-event（イベント系）
  - [ ] validate（検証）
- [ ] `/map` Skill 定義
- [ ] サンプルタイルセット + サンプルマップの作成
- [ ] 動作確認: Claude Code でマップ1枚生成

### Phase 3: ブラウザエディタ GUI

- [ ] マップエディタ画面（apps/editor 内）
- [ ] タイルパレット + キャンバス描画
- [ ] ファイル監視による CLI 変更の反映

---

*文書作成: Claude Code (Claude Opus 4.6) -- 2026-03-07*
