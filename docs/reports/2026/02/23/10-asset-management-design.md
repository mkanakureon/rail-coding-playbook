# Asset管理 設計書 v2

- 作成日: 2026-02-23
- 改訂: v2 — 3階層分類+キャラクラス統合
- ステータス: Draft
- 関連: [Asset管理 仕様書 v2](./09-asset-management-spec.md)

---

## 1. アーキテクチャ概要

### 3層アセットモデル + 3階層分類

```
┌──────────────────────────────────────────────────────────────┐
│                        ユーザーの視点                          │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐                         │
│  │  公式アセット   │   │  マイアセット   │    ← ライブラリ層      │
│  │ OfficialAsset │   │  UserAsset   │                         │
│  │  (PF提供)     │   │ (個人Upload) │                         │
│  └──────┬───────┘   └──────┬───────┘                         │
│         │ Import           │ Import                           │
│         ▼                  ▼                                   │
│  ┌──────────────────────────────────────┐                     │
│  │        プロジェクトアセット              │  ← プロジェクト層   │
│  │                                      │                     │
│  │  image/bg         ─── 背景画像         │                     │
│  │  image/ch-img      ─── キャラ画像       │                     │
│  │  image/effect      ─── 演出画像         │                     │
│  │  audio/bgm         ─── BGM             │                     │
│  │  audio/se          ─── SE              │                     │
│  │  audio/voice       ─── ボイス           │                     │
│  │  ch-class   ─── キャラ定義(JSON) │                     │
│  │                          │             │                     │
│  │                    参照 ──┘             │                     │
│  └──────────────┬───────────────────────┘                     │
│                 │ manifest 生成                                │
│                 ▼                                              │
│  ┌──────────────────────────────────────┐                     │
│  │  manifest                            │  ← エンジン層        │
│  │  ├── assets:  { slug → URL }         │                     │
│  │  └── characters: { slug → 定義JSON } │                     │
│  │                                      │                     │
│  │  WebEngine / Switch Engine           │                     │
│  └──────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### ストレージ共有モデル

```
Azure Blob Storage / Local filesystem
  └── assets/
      ├── image/
      │   ├── bg/           ← 背景画像
      │   ├── ch-img/       ← キャラクター画像
      │   └── effect/       ← 演出画像
      ├── audio/
      │   ├── bgm/
      │   ├── se/
      │   └── voice/
      └── (ch-class はファイルなし)
```

blobPath 形式: `{kind}/{category}/{contentHash}.{ext}`
例: `image/bg/a1b2c3d4.webp`, `audio/bgm/e5f6g7h8.mp3`

---

## 2. マイグレーション計画

全フェーズ非破壊。追加のみで既存データ・機能を壊さない。

### Phase 1: DB スキーマ変更

```sql
-- 1. Asset テーブルにカラム追加
ALTER TABLE "assets" ADD COLUMN "category"    VARCHAR(50);
ALTER TABLE "assets" ADD COLUMN "subcategory" VARCHAR(50);
ALTER TABLE "assets" ADD COLUMN "metadata"    JSONB;
ALTER TABLE "assets" ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'upload';

-- 2. 既存 kind データを新体系に変換
UPDATE "assets" SET category = 'bg',        kind = 'image' WHERE kind = 'bg';
UPDATE "assets" SET category = 'ch-img', kind = 'image' WHERE kind = 'ch';
UPDATE "assets" SET category = 'effect',    kind = 'image' WHERE kind = 'frame';
UPDATE "assets" SET category = 'bgm',       kind = 'audio' WHERE kind = 'bgm';
UPDATE "assets" SET category = 'se',        kind = 'audio' WHERE kind = 'se';
UPDATE "assets" SET category = 'voice',     kind = 'audio' WHERE kind = 'voice';

-- 3. インデックス追加
CREATE INDEX "assets_project_kind_idx" ON "assets"("project_id", "kind");
CREATE INDEX "assets_project_kind_cat_idx" ON "assets"("project_id", "kind", "category");

-- 4. UserAsset テーブル作成
CREATE TABLE "user_assets" (
  "id"           VARCHAR(31) PRIMARY KEY,
  "user_id"      VARCHAR(31) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "filename"     VARCHAR(255) NOT NULL,
  "kind"         VARCHAR(30) NOT NULL,
  "category"     VARCHAR(50),
  "subcategory"  VARCHAR(50),
  "blob_path"    VARCHAR(500) NOT NULL,
  "size"         BIGINT NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "metadata"     JSONB,
  "tags"         VARCHAR(500) NOT NULL DEFAULT '',
  "created_at"   BIGINT NOT NULL
);
CREATE INDEX "user_assets_user_id_idx" ON "user_assets"("user_id");
CREATE INDEX "user_assets_user_id_kind_idx" ON "user_assets"("user_id", "kind");

-- 5. OfficialAsset テーブル拡張
ALTER TABLE "official_assets" ADD COLUMN "subcategory"    VARCHAR(50);
ALTER TABLE "official_assets" ADD COLUMN "display_name"   VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "official_assets" ADD COLUMN "description"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "official_assets" ADD COLUMN "thumbnail_path" VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE "official_assets" ADD COLUMN "sort_order"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "official_assets" ADD COLUMN "download_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "official_assets" ADD COLUMN "is_free"        BOOLEAN NOT NULL DEFAULT true;

-- 6. OfficialAsset の kind/category 変換
-- 旧: kind=bg, category=fantasy_outdoor
-- 新: kind=image, category=bg, subcategory=fantasy_outdoor
UPDATE "official_assets" SET subcategory = category, category = 'bg',        kind = 'image' WHERE kind = 'bg';
UPDATE "official_assets" SET subcategory = category, category = 'ch-img', kind = 'image' WHERE kind = 'ch';
UPDATE "official_assets" SET subcategory = category, category = 'bgm',       kind = 'audio' WHERE kind = 'bgm';

CREATE INDEX "official_assets_kind_cat_sub_idx" ON "official_assets"("kind", "category", "subcategory");
```

### Phase 2: Character → ch-class 変換（アプリスクリプト）

```typescript
// 各プロジェクトの Character + Expression を ch-class Asset に変換
for (const char of characters) {
  const expressions: Record<string, string> = {};
  for (const expr of char.expressions) {
    if (expr.imageAssetId) {
      expressions[expr.slug] = expr.imageAssetId;
    }
  }
  await prisma.asset.create({
    data: {
      id: generateId(),
      projectId: char.projectId,
      slug: char.slug,
      kind: 'ch-class',
      filename: '',
      blobPath: '',
      size: 0n,
      contentType: 'application/json',
      metadata: {
        name: char.name,
        defaultExpression: char.defaultExpressionId
          ? char.expressions.find(e => e.id === char.defaultExpressionId)?.slug ?? 'normal'
          : 'normal',
        expressions,
      },
      sourceType: 'upload',
      createdAt: char.createdAt,
    },
  });
}
// UserCharacter も同様に UserAsset に変換
```

### Phase 3: API 追加

| 優先度 | エンドポイント | ファイル |
|--------|--------------|---------|
| P0 | UserAsset CRUD (GET/POST/DELETE) | `user-assets.ts` (新規) |
| P0 | `import-from-library` | `assets.ts` (追加) |
| P0 | `ch-class` CRUD | `assets.ts` (追加) |
| P1 | 既存エンドポイントの kind/category フィルター対応 | `assets.ts`, `official-assets.ts` |
| P1 | `use-official` に sourceType 設定 | `assets.ts` |

### Phase 4: フロントエンド

| ファイル | 変更 |
|---------|------|
| `apps/next/app/(private)/my-assets/page.tsx` | 新規ページ（3階層フィルター） |
| `apps/next/lib/api.ts` | UserAsset 型 + API 関数追加 |
| `apps/editor/src/components/AssetSelectModal.tsx` | 3タブ化 + kind/category フィルター |
| `apps/editor/src/components/CharacterPanel.tsx` | ch-class アセット操作に変更 |

### Phase 5: 旧テーブル廃止

Character, Expression, UserCharacter, UserExpression テーブルを DROP（Phase 2 完了・検証後）。

---

## 3. ストレージ設計

### blobPath 生成ルール

新体系:
```
{kind}/{category}/{contentHash}.{ext}
```

例:
- `image/bg/a1b2c3d4.webp`
- `image/ch-img/e5f6g7h8.webp`
- `audio/bgm/x9y0z1a2.mp3`

ch-class は blobPath 空（ファイル実体なし）。

### blobPath 共有と削除時の参照チェック

```typescript
async function canDeleteBlob(
  blobPath: string,
  excludeTable: 'asset' | 'userAsset' | 'officialAsset',
  excludeId: string
): Promise<boolean> {
  const officialRef = await prisma.officialAsset.findFirst({
    where: {
      blobPath,
      ...(excludeTable === 'officialAsset' ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (officialRef) return false;

  const assetRef = await prisma.asset.findFirst({
    where: {
      blobPath,
      ...(excludeTable === 'asset' ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (assetRef) return false;

  const userAssetRef = await prisma.userAsset.findFirst({
    where: {
      blobPath,
      ...(excludeTable === 'userAsset' ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (userAssetRef) return false;

  return true;
}
```

---

## 4. manifest 統合

### manifest 形式

```json
{
  "assets": {
    "forest_evening": "https://storage.../image/bg/abc123.webp",
    "hero_normal": "https://storage.../image/ch-img/def456.webp",
    "hero_smile": "https://storage.../image/ch-img/xyz789.webp",
    "battle_bgm": "https://storage.../audio/bgm/ghi012.mp3"
  },
  "characters": {
    "hero": {
      "name": "主人公",
      "defaultExpression": "normal",
      "expressions": {
        "normal": "hero_normal",
        "smile": "hero_smile"
      }
    }
  }
}
```

- `assets`: 全画像・音声アセットの slug → URL マッピング（既存互換）
- `characters`: ch-class アセットの slug → 定義JSON（新規）

### エンジン側解決

```
[show ch="hero" face="smile"]
→ manifest.characters.hero.expressions.smile → "hero_smile"
→ manifest.assets.hero_smile → URL
→ 描画
```

---

## 5. 主要設計判断テーブル

| # | 判断事項 | 決定 | 理由 | 代替案 |
|---|---------|------|------|--------|
| 1 | キャラの扱い | **アセットに統合** | 全て Asset で統一。別テーブルの複雑さ排除 | Character テーブル維持 → DB分散 |
| 2 | キャラクラスの実体 | **JSONメタデータ** | ファイル不要。画像アセット参照のみ | 独自テーブル → 統合の意味なし |
| 3 | 分類の階層 | **3階層固定** | kind→category→subcategory で十分 | パス形式で自由階層 → パース複雑 |
| 4 | 公式をマイに混ぜるか | **混ぜない** | 自分のアップロードが識別不能 | origin フラグ → UI複雑 |
| 5 | UserAsset に slug | **持たせない** | Import 時に確定。PJごとに異なりうる | 持たせる → 不整合リスク |
| 6 | blobPath 形式 | **kind/category/hash.ext** | 旧 kind/hash.ext から自然拡張 | フラット → 管理しづらい |
| 7 | ファイルコピー | **しない** | blobPath 共有でストレージ節約 | Import 時コピー → 容量2倍 |
| 8 | manifest 形式 | **assets + characters** | 画像URLフラット維持 + キャラ定義追加 | 全部フラット → キャラ解決不能 |
| 9 | 有料アセット | **v1 は isFree のみ** | 課金は将来 | v1 で実装 → スコープ過大 |
| 10 | 旧テーブル | **段階的廃止** | 変換→検証→DROP の安全手順 | 即廃止 → ロールバック不能 |

---

## 6. API 詳細設計

### 6.1 `GET /api/user-assets`

```
GET /api/user-assets?kind=image&category=bg&subcategory=outdoor
Authorization: Bearer <token>
```

```json
{
  "assets": [
    {
      "id": "01HXY0001",
      "filename": "forest_bg.png",
      "kind": "image",
      "category": "bg",
      "subcategory": "outdoor",
      "url": "https://storage.../image/bg/a1b2c3d4.webp",
      "size": 524288,
      "contentType": "image/webp",
      "tags": "",
      "createdAt": 1708675200000
    }
  ]
}
```

### 6.2 `POST /api/user-assets/upload`

```
POST /api/user-assets/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: (binary)
kind: image
category: bg
subcategory: outdoor   (optional)
```

```json
// 201 Created
{
  "message": "アップロードしました",
  "asset": {
    "id": "01HXY0003",
    "filename": "sunset_bg.png",
    "kind": "image",
    "category": "bg",
    "subcategory": "outdoor",
    "url": "https://storage.../image/bg/x9y0z1a2.webp",
    "size": 890000,
    "contentType": "image/webp"
  }
}
```

### 6.3 `DELETE /api/user-assets/:id`

```
DELETE /api/user-assets/01HXY0001
Authorization: Bearer <token>
```

```json
{ "message": "削除しました" }
```

### 6.4 `POST /api/assets/:projectId/import-from-library`

```
POST /api/assets/01PROJ001/import-from-library
Authorization: Bearer <token>
Content-Type: application/json

{ "userAssetId": "01HXY0001" }
```

```json
// 201 Created
{
  "message": "マイアセットを追加しました",
  "asset": {
    "id": "01HABC001",
    "kind": "image",
    "category": "bg",
    "url": "https://storage.../image/bg/a1b2c3d4.webp",
    "name": "forest_bg.png",
    "slug": "forest_bg"
  }
}
```

### 6.5 `POST /api/assets/:projectId/ch-class`

```
POST /api/assets/01PROJ001/ch-class
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "hero",
  "name": "主人公",
  "defaultExpression": "normal",
  "expressions": {
    "normal": "01ASSET_NORMAL",
    "smile": "01ASSET_SMILE"
  }
}
```

```json
// 201 Created
{
  "message": "キャラクラスを作成しました",
  "asset": {
    "id": "01CC001",
    "kind": "ch-class",
    "slug": "hero",
    "metadata": {
      "name": "主人公",
      "defaultExpression": "normal",
      "expressions": {
        "normal": "01ASSET_NORMAL",
        "smile": "01ASSET_SMILE"
      }
    }
  }
}
```

バリデーション:
- slug のユニーク制約チェック
- expressions の各 assetId が同プロジェクトに存在し、kind=image, category=ch-img であること

### 6.6 `PUT /api/assets/:projectId/ch-class/:slug`

```
PUT /api/assets/01PROJ001/ch-class/hero
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "主人公（覚醒後）",
  "expressions": {
    "normal": "01ASSET_NORMAL",
    "smile": "01ASSET_SMILE",
    "awakened": "01ASSET_AWAKENED"
  }
}
```

```json
{
  "message": "キャラクラスを更新しました",
  "asset": { ... }
}
```

### 6.7 `GET /api/official-assets` レスポンス拡張

```json
{
  "assets": [
    {
      "id": "01OFF001",
      "kind": "image",
      "category": "bg",
      "subcategory": "fantasy_outdoor",
      "url": "https://storage.../image/bg/off123.webp",
      "name": "fantasy_forest.png",
      "displayName": "幻想の森",
      "description": "ファンタジー風の森の背景",
      "thumbnailPath": ""
    }
  ]
}
```

---

## 7. フロントエンドコンポーネント設計

### 7.1 `/my-assets` ページ

```
MyAssetsPage
├── PageHeader
├── TabBar [公式アセット | マイアセット]
│
├── (共通) 3階層フィルター
│   ├── KindFilter   [すべて] [画像] [音声] [キャラクラス]
│   ├── CategoryFilter  (kind 依存で動的)
│   └── SubcategoryFilter (category 依存で動的、あれば)
│
├── (公式タブ)
│   └── AssetGrid
│       └── OfficialAssetCard
│           ├── Thumbnail + Name + Kind/Category badge
│           └── AddToProjectButton → ProjectSelectDropdown
│
└── (マイタブ)
    ├── UploadButton (kind + category 選択 → ファイル選択)
    └── AssetGrid
        └── UserAssetCard
            ├── Thumbnail + Name + Kind/Category badge
            ├── DeleteButton
            └── AddToProjectButton → ProjectSelectDropdown
```

### 7.2 AssetSelectModal 変更（エディタ）

```
AssetSelectModal
├── TabBar [プロジェクト | 公式 | マイライブラリ]
│
├── (プロジェクト) ← 既存タブをリネーム
│   └── 現PJアセット（props の kind/category で絞り込み済み）
│
├── (公式)
│   └── カテゴリフィルター + グリッド
│
└── (マイライブラリ) ← 新規
    ├── kind/category で絞り込み
    └── 選択時: import-from-library → onSelect(assetId)
```

### 7.3 CharacterPanel 変更（エディタ）

```
CharacterPanel (現行: Character CRUD)
↓ 変更後
CharacterClassPanel
├── ch-class 一覧 (GET /api/assets/:pj?kind=ch-class)
├── 新規作成ボタン
│   ├── slug, name 入力
│   └── 表情追加: 表情名 + AssetSelectModal(kind=image, category=ch-img)
├── 編集: 表情の追加・削除・画像変更
└── 削除
```

### 7.4 API クライアント (`apps/next/lib/api.ts`)

```typescript
export interface UserAssetItem {
  id: string;
  filename: string;
  kind: string;
  category: string | null;
  subcategory: string | null;
  url: string;
  size: number;
  contentType: string;
  tags: string;
  createdAt: number;
}

export interface CharacterClassMetadata {
  name: string;
  defaultExpression: string;
  expressions: Record<string, string>;
}

export async function getUserAssets(params?: {
  kind?: string;
  category?: string;
  subcategory?: string;
}): Promise<{ assets: UserAssetItem[] }>;

export async function uploadUserAsset(formData: FormData): Promise<{ asset: UserAssetItem }>;
export async function deleteUserAsset(id: string): Promise<{ message: string }>;

export async function importFromLibrary(
  projectId: string,
  userAssetId: string
): Promise<{ asset: Asset }>;

export async function createCharacterClass(
  projectId: string,
  data: { slug: string } & CharacterClassMetadata
): Promise<{ asset: any }>;

export async function updateCharacterClass(
  projectId: string,
  slug: string,
  data: Partial<CharacterClassMetadata>
): Promise<{ asset: any }>;
```

---

## 8. テスト計画

### 8.1 DB マイグレーション

| テスト | 検証内容 |
|--------|---------|
| マイグレーション実行 | `prisma migrate dev` 成功 |
| kind 変換 | 旧 `bg` → `image` + category `bg` |
| kind 変換 | 旧 `ch` → `image` + category `ch-img` |
| kind 変換 | 旧 `bgm` → `audio` + category `bgm` |
| OfficialAsset 変換 | 旧 category → subcategory に移動 |
| Character → ch-class | Character+Expression → ch-class Asset |
| 既存データ保全 | slug, blobPath が変更されていないこと |

### 8.2 API テスト

#### UserAsset CRUD

| テスト | 期待 |
|--------|------|
| 一覧（空） | `{ assets: [] }` |
| アップロード (kind=image, category=bg) | 201 |
| アップロード（サイズ超過） | 400 |
| 一覧 (kind=image でフィルター) | image のみ |
| 一覧 (kind=image, category=bg) | image/bg のみ |
| 削除 | 200 |
| 他ユーザー削除 | 403 |

#### ch-class

| テスト | 期待 |
|--------|------|
| 作成 | 201, metadata に JSON |
| 作成（slug 重複） | 409 |
| 作成（存在しない assetId） | 400 |
| 更新（表情追加） | 200 |
| 一覧 (kind=ch-class) | ch-class のみ |
| 削除 | 200 |

#### Import

| テスト | 期待 |
|--------|------|
| マイ → PJ Import | 201, slug 生成, kind/category 引き継ぎ |
| 重複 Import | 200, 既存返却 |
| 公式 → PJ Import | 201, sourceType=official |

### 8.3 一気通貫テスト

| シナリオ | 検証 |
|---------|------|
| 背景アップロード → PJ Import → manifest | manifest.assets に slug→URL |
| キャラ画像アップロード → キャラクラス作成 → manifest | manifest.characters に定義 |
| 公式 Import → PJ 一覧 | kind/category が正しい |
| マイ → 複数PJ Import | 両PJに独立した slug |
| PJアセット削除 → マイ残存 | UserAsset は残る |

### 8.4 既存機能回帰

| テスト | 検証内容 |
|--------|---------|
| エディタアップロード | kind=image, category=bg で動作 |
| エディタ公式アセット選択 | 3階層フィルターで動作 |
| KS スクリプト `[show ch="hero"]` | ch-class → 画像解決 |
| slug 編集 | 従来通り動作 |
| manifest 生成 | assets + characters の2セクション |

---

## 修正対象ファイル一覧

| # | ファイル | 種別 | 変更内容 |
|---|---------|------|---------|
| 1 | `apps/hono/prisma/schema.prisma` | 変更 | Asset に category/subcategory/metadata 追加, UserAsset 新規, OfficialAsset 拡張, Character/Expression 廃止 |
| 2 | `apps/hono/src/routes/user-assets.ts` | **新規** | UserAsset CRUD + upload |
| 3 | `apps/hono/src/routes/assets.ts` | 変更 | import-from-library, ch-class CRUD, kind/category フィルター, use-official sourceType |
| 4 | `apps/hono/src/routes/official-assets.ts` | 変更 | kind/category/subcategory フィルター, レスポンス拡張 |
| 5 | `apps/hono/src/index.ts` | 変更 | user-assets ルート登録 |
| 6 | `apps/next/app/(private)/my-assets/page.tsx` | **新規** | アセット管理ページ（3階層フィルター） |
| 7 | `apps/next/lib/api.ts` | 変更 | UserAssetItem, CharacterClassMetadata 型 + API 関数追加 |
| 8 | `apps/editor/src/components/AssetSelectModal.tsx` | 変更 | 3タブ化 + kind/category フィルター |
| 9 | `apps/editor/src/components/CharacterPanel.tsx` | 変更 | ch-class アセット操作に変更 |
| 10 | `packages/web/src/engine/WebEngine.ts` | 変更 | manifest の characters セクション対応 |
| 11 | マイグレーションスクリプト | **新規** | 旧kind変換 + Character→ch-class 変換 |
