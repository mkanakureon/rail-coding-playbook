# アセット分類体系リストラクチャ 仕様書

- 作成日: 2026-02-23
- ステータス: Draft
- 前提: [Asset管理 仕様書 v1](./09-asset-management-spec.md)

---

## 1. 概要

現行のアセットは `kind` がフラット（bg, ch, bgm, se, voice）で、キャラクターは別テーブル（Character + Expression）に分離している。これを **「全てアセット」** に統合し、kind → category → subcategory の3階層で分類する。

### 現行 → 新体系

```
【現行】                          【新体系】
Asset (kind: bg/ch/bgm/se/voice)  →  Asset (kind → category → subcategory)
Character テーブル                 →  kind: "ch-class" のアセット
Expression テーブル                →  ch-class の JSON 内で表情マッピング
```

---

## 2. 3階層分類体系

```
kind              category      subcategory      説明
─────────────────────────────────────────────────────────────
image             bg            outdoor          背景（屋外）
image             bg            indoor           背景（室内）
image             bg            fantasy          背景（ファンタジー）
image             bg            (null)           背景（未分類）
image             ch-img        (null)           キャラクター画像
image             effect        (null)           演出・エフェクト画像
image             ui            (null)           UI素材
─────────────────────────────────────────────────────────────
audio             bgm           (null)           BGM
audio             se            battle           SE（バトル）
audio             se            ui               SE（UI操作音）
audio             se            environment      SE（環境音）
audio             se            (null)           SE（未分類）
audio             voice         (null)           ボイス
─────────────────────────────────────────────────────────────
ch-class   (null)        (null)           キャラ定義（JSON）
```

### ルール

- `kind` は必須: `"image"` | `"audio"` | `"ch-class"`
- `category` は kind ごとに定義。ch-class は null
- `subcategory` は任意。使わない場合は null
- 階層は **最大3段固定**。それ以上は作らない

---

## 3. キャラクラス（ch-class）

### 概念

キャラクラスは **ファイル実体を持たない定義アセット**。中身はJSON。画像アセット（kind: "image", category: "ch-img"）を参照して表情を構成する。

```
キャラクラス "hero" (Asset)
  │
  │  metadata JSON で参照
  │
  ├──→ 画像アセット "hero_normal"  (kind: image, category: ch-img)
  ├──→ 画像アセット "hero_smile"   (kind: image, category: ch-img)
  └──→ 画像アセット "hero_angry"   (kind: image, category: ch-img)
```

### データ構造

Asset テーブルの1行として保存:

| フィールド | 値 |
|-----------|-----|
| kind | `"ch-class"` |
| category | `null` |
| slug | `"hero"` — スクリプトで使うID |
| filename | `""` (空) |
| blobPath | `""` (空 — ファイル実体なし) |
| size | `0` |
| contentType | `"application/json"` |
| metadata | JSON（下記） |

### metadata JSON

```json
{
  "name": "主人公",
  "defaultExpression": "normal",
  "expressions": {
    "normal": "01ASSET_NORMAL_ID",
    "smile": "01ASSET_SMILE_ID",
    "angry": "01ASSET_ANGRY_ID"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `name` | string | 表示名（「主人公」「ヒロイン」など） |
| `defaultExpression` | string | デフォルト表情のキー |
| `expressions` | `Record<string, string>` | 表情slug → 画像アセットID のマッピング |

### スクリプトからの解決フロー

```
[show ch="hero" face="smile"]

1. slug "hero" → Asset (kind: ch-class) を検索
2. metadata.expressions.smile → 画像アセットID "01ASSET_SMILE_ID"
3. アセットID → Asset (kind: image) の blobPath
4. blobPath → manifest で URL 解決 → 描画
```

---

## 4. データモデル変更

### Asset テーブル変更

```prisma
model Asset {
  // --- 既存（維持） ---
  id          String  @id @db.VarChar(31)
  projectId   String  @map("project_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  slug        String? @db.VarChar(100)
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  createdAt   BigInt  @map("created_at")

  // --- 変更: kind を新体系に ---
  kind        String  @db.VarChar(30)
  // "image" | "audio" | "ch-class"
  // (旧: "bg" | "ch" | "bgm" | "se" | "voice" | "frame")

  // --- 追加 ---
  category    String? @db.VarChar(50)    // "bg" | "ch-img" | "effect" | "bgm" | "se" | "voice"
  subcategory String? @db.VarChar(50)    // "outdoor" | "indoor" | "battle" | "ui" | ...
  metadata    Json?                       // ch-class のJSON定義など
  sourceType  String  @default("upload") @map("source_type") @db.VarChar(20)

  // --- 削除対象 ---
  // frameSetId, frameIndex → FrameSet統合後に検討

  // --- リレーション ---
  project          Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  // Expression, FrameSet リレーションは廃止

  @@unique([projectId, slug])
  @@index([projectId])
  @@index([projectId, kind])
  @@index([projectId, kind, category])
  @@map("assets")
}
```

### 廃止対象テーブル

| テーブル | 理由 | 移行先 |
|---------|------|--------|
| `Character` | kind: "ch-class" のアセットに統合 | Asset.metadata |
| `Expression` | ch-class の JSON expressions に統合 | Asset.metadata.expressions |
| `UserCharacter` | マイアセットの ch-class に統合 | UserAsset (kind: ch-class) |
| `UserExpression` | 同上 | UserAsset の metadata.expressions |

---

## 5. 旧 kind → 新 kind/category マッピング

マイグレーション時の変換テーブル:

| 旧 kind | 新 kind | 新 category | 新 subcategory |
|---------|---------|------------|---------------|
| `bg` | `image` | `bg` | `null` |
| `ch` | `image` | `ch-img` | `null` |
| `bgm` | `audio` | `bgm` | `null` |
| `se` | `audio` | `se` | `null` |
| `voice` | `audio` | `voice` | `null` |
| `frame` | `image` | `effect` | `null` (要検討) |

### マイグレーション SQL

```sql
-- 1. カラム追加
ALTER TABLE "assets" ADD COLUMN "category"    VARCHAR(50);
ALTER TABLE "assets" ADD COLUMN "subcategory" VARCHAR(50);
ALTER TABLE "assets" ADD COLUMN "metadata"    JSONB;

-- 2. 既存データ変換
UPDATE "assets" SET category = 'bg',        kind = 'image' WHERE kind = 'bg';
UPDATE "assets" SET category = 'ch-img', kind = 'image' WHERE kind = 'ch';
UPDATE "assets" SET category = 'bgm',       kind = 'audio' WHERE kind = 'bgm';
UPDATE "assets" SET category = 'se',        kind = 'audio' WHERE kind = 'se';
UPDATE "assets" SET category = 'voice',     kind = 'audio' WHERE kind = 'voice';
UPDATE "assets" SET category = 'effect',    kind = 'image' WHERE kind = 'frame';

-- 3. Character + Expression → ch-class アセットに変換
-- (アプリケーションレベルのスクリプトで実行)

-- 4. インデックス追加
CREATE INDEX "assets_project_kind_idx" ON "assets"("project_id", "kind");
CREATE INDEX "assets_project_kind_category_idx" ON "assets"("project_id", "kind", "category");
```

---

## 6. OfficialAsset テーブル変更

公式アセットも同じ3階層にする:

```prisma
model OfficialAsset {
  id          String  @id @db.VarChar(31)
  filename    String  @db.VarChar(255)
  kind        String  @db.VarChar(30)     // "image" | "audio"
  category    String  @db.VarChar(50)     // "bg" | "ch-img" | "bgm" | "se"
  subcategory String? @db.VarChar(50)     // "outdoor" | "indoor" | ...
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  createdAt   BigInt  @map("created_at")

  // 拡張フィールド（09-spec から継承）
  displayName   String  @default("") @map("display_name") @db.VarChar(255)
  description   String  @default("") @db.Text
  thumbnailPath String  @default("") @map("thumbnail_path") @db.VarChar(500)
  sortOrder     Int     @default(0) @map("sort_order")
  downloadCount Int     @default(0) @map("download_count")
  isFree        Boolean @default(true) @map("is_free")

  @@index([kind])
  @@index([kind, category])
  @@index([kind, category, subcategory])
  @@map("official_assets")
}
```

旧 `category`（"fantasy_outdoor" 等）は `subcategory` に移動:

| 旧 kind | 旧 category | 新 kind | 新 category | 新 subcategory |
|---------|------------|---------|------------|---------------|
| `bg` | `fantasy_outdoor` | `image` | `bg` | `fantasy_outdoor` |
| `bg` | `modern_indoor` | `image` | `bg` | `modern_indoor` |
| `ch` | `basic` | `image` | `ch-img` | `basic` |
| `bgm` | `basic` | `audio` | `bgm` | `basic` |

---

## 7. UserAsset テーブル

マイアセットも同じ3階層:

```prisma
model UserAsset {
  id          String  @id @db.VarChar(31)
  userId      String  @map("user_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  kind        String  @db.VarChar(30)     // "image" | "audio" | "ch-class"
  category    String? @db.VarChar(50)
  subcategory String? @db.VarChar(50)
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  metadata    Json?                        // ch-class 用
  tags        String  @default("") @db.VarChar(500)
  createdAt   BigInt  @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, kind])
  @@map("user_assets")
}
```

---

## 8. UI のフィルター構造

### アセット管理ページ `/my-assets`

```
第1段: kind タブ
  [すべて] [画像] [音声] [キャラクラス]

第2段: category フィルター（kind 選択時に表示）
  画像 → [すべて] [背景] [キャラクター] [演出] [UI]
  音声 → [すべて] [BGM] [SE] [ボイス]

第3段: subcategory フィルター（category 選択時に表示、あれば）
  背景 → [すべて] [屋外] [室内] [ファンタジー] ...
  SE   → [すべて] [バトル] [UI] [環境] ...
```

### エディタ AssetSelectModal

```
タブ: [プロジェクト] [公式] [マイライブラリ]

各タブ内:
  kind は props (assetKind) で自動絞り込み
  例: 背景選択時 → kind=image, category=bg で固定
  例: キャラ選択時 → kind=ch-class で固定
```

---

## 9. API エンドポイント変更

### クエリパラメータ拡張

全アセット系エンドポイントのフィルターを拡張:

```
GET /api/assets/:projectId?kind=image&category=bg&subcategory=outdoor
GET /api/user-assets?kind=audio&category=se
GET /api/official-assets?kind=image&category=bg&subcategory=fantasy_outdoor
```

### キャラクラス専用

```
POST /api/assets/:projectId/ch-class
  body: { slug, name, defaultExpression, expressions: { [slug]: assetId } }
  → kind: "ch-class" の Asset を作成

PUT /api/assets/:projectId/ch-class/:slug
  body: { name?, expressions? }
  → metadata を更新

GET /api/assets/:projectId?kind=ch-class
  → キャラクラス一覧
```

---

## 10. エンジン manifest への影響

### 現行

```json
{
  "forest_evening": "https://storage.../bg/abc123.webp",
  "hero_normal": "https://storage.../ch/def456.webp"
}
```

### 新体系

manifest 形式は変更なし。slug → URL のフラットマッピング。

ch-class の解決はエンジン内部で2段階:

```
1. manifest から ch-class の metadata を取得
   "hero" → { name: "主人公", expressions: { smile: "hero_smile" } }

2. expressions の値（アセットslug）を manifest で URL 解決
   "hero_smile" → "https://storage.../image/ch-img/xyz789.webp"
```

manifest に ch-class の metadata を含める:

```json
{
  "assets": {
    "forest_evening": "https://storage.../image/bg/abc123.webp",
    "hero_normal": "https://storage.../image/ch-img/def456.webp",
    "hero_smile": "https://storage.../image/ch-img/xyz789.webp"
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

---

## 11. 主要設計判断

| # | 判断事項 | 決定 | 理由 |
|---|---------|------|------|
| 1 | キャラの扱い | **アセットに統合** | 全てアセットで統一。別テーブル管理の複雑さを排除 |
| 2 | キャラクラスの実体 | **JSONメタデータ** | ファイル不要。画像アセットへの参照のみ |
| 3 | 分類の階層 | **3階層固定** | kind → category → subcategory。十分な粒度でシンプル |
| 4 | 旧 kind | **マイグレーションで変換** | bg→image/bg, ch→image/ch-img 等 |
| 5 | Character テーブル | **廃止** | ch-class アセットに置き換え |
| 6 | Expression テーブル | **廃止** | ch-class metadata.expressions に統合 |
| 7 | manifest 形式 | **assets + characters の2セクション** | 画像URLはフラット維持。キャラ定義を別セクション |

---

## 12. 修正対象ファイル

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `apps/hono/prisma/schema.prisma` | Asset に category/subcategory/metadata 追加、Character/Expression 廃止 |
| 2 | `apps/hono/src/routes/assets.ts` | kind/category/subcategory フィルター、ch-class CRUD |
| 3 | `apps/hono/src/routes/user-assets.ts` | 同様の3階層対応 |
| 4 | `apps/hono/src/routes/official-assets.ts` | kind/category/subcategory 対応 |
| 5 | `apps/next/app/(private)/my-assets/page.tsx` | 3階層フィルターUI |
| 6 | `apps/editor/src/components/AssetSelectModal.tsx` | kind/category ベースの絞り込み |
| 7 | `apps/editor/src/components/CharacterPanel.tsx` | ch-class アセット操作に変更 |
| 8 | `packages/web/src/engine/WebEngine.ts` | manifest の characters セクション対応 |
| 9 | マイグレーションスクリプト | 旧kind変換 + Character→ch-class変換 |
