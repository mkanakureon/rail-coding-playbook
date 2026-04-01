# Asset管理 仕様書 v2

- 作成日: 2026-02-23
- 改訂: v2 — 3階層分類+キャラクラス統合
- ステータス: Draft

---

## 1. 概要

Unity Package Manager のモデルを参考に、kaedevn にアセット管理機能を導入する。

### 現状の問題

- MyPage がプロジェクト/アセット/キャラクター/プロフィールの4タブでオーバーロード
- アセットは「プロジェクトに紐づくもの」しか管理できず、プロジェクト横断のライブラリ概念がない
- キャラクター（Character + Expression）がアセットと別管理で、データモデルが分散

### 新体系

1. **全てアセット** — 画像・音声・キャラ定義を `Asset` テーブルに統合
2. **3階層分類** — kind → category → subcategory で整理
3. **3つの場所** — 公式アセット / マイアセット / プロジェクトアセット

```
公式アセット（PF提供）      ──→ プロジェクトに Import
マイアセット（自分のアップロード）──→ プロジェクトに Import
プロジェクトアセット（Import済み）──→ エンジンで使用
```

**核心ルール: 公式アセットをマイアセットに入れない。**

---

## 2. 用語定義

| 用語 | 定義 |
|------|------|
| **公式アセット** | 管理者がアップロードした PF 提供素材。`OfficialAsset` テーブル。全ユーザーが閲覧・Import 可能 |
| **マイアセット** | ユーザー個人がアップロードした素材ライブラリ。`UserAsset` テーブル。プロジェクト非依存 |
| **プロジェクトアセット** | 特定プロジェクトに Import された素材。`Asset` テーブル。slug を持つ |
| **kind** | アセットの大分類: `"image"` / `"audio"` / `"ch-class"` |
| **category** | kind 内の中分類: `"bg"` / `"ch-img"` / `"effect"` / `"bgm"` / `"se"` / `"voice"` |
| **subcategory** | category 内の小分類（任意）: `"outdoor"` / `"indoor"` / `"battle"` 等 |
| **キャラクラス** | kind: `"ch-class"` のアセット。ファイル実体なし。JSONで表情→画像アセットのマッピングを保持 |
| **slug** | KS スクリプトで参照するID。フラット形式（例: `forest_evening`）。プロジェクト内ユニーク |
| **Import** | 公式/マイアセットからプロジェクトに追加する操作。slug 確定タイミング |

---

## 3. 3階層分類体系

```
kind              category      subcategory       説明
──────────────────────────────────────────────────────────────
image             bg            outdoor           背景（屋外）
image             bg            indoor            背景（室内）
image             bg            fantasy           背景（ファンタジー）
image             bg            (null)            背景（未分類）
image             ch-img        (null)            キャラクター画像
image             effect        (null)            演出・エフェクト画像
image             ui            (null)            UI素材
──────────────────────────────────────────────────────────────
audio             bgm           (null)            BGM
audio             se            battle            SE（バトル）
audio             se            ui                SE（UI操作音）
audio             se            environment       SE（環境音）
audio             se            (null)            SE（未分類）
audio             voice         (null)            ボイス
──────────────────────────────────────────────────────────────
ch-class          (null)        (null)            キャラ定義（JSON）
```

### ルール

- `kind` は必須。3値: `"image"` | `"audio"` | `"ch-class"`
- `category` は kind ごとに定義。ch-class は null
- `subcategory` は任意。使わない場合は null
- 階層は **最大3段固定**

---

## 4. キャラクラス仕様

### 概念

キャラクラスは **ファイル実体を持たないJSON定義アセット**。画像アセット（kind: "image", category: "ch-img"）を参照して表情を構成する。

```
キャラクラス "hero" (kind: ch-class)
  │  metadata JSON
  ├──→ 画像アセット "hero_normal"  (kind: image, category: ch-img)
  ├──→ 画像アセット "hero_smile"   (kind: image, category: ch-img)
  └──→ 画像アセット "hero_angry"   (kind: image, category: ch-img)
```

### metadata JSON 仕様

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

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | Yes | 表示名 |
| `defaultExpression` | string | Yes | デフォルト表情のキー |
| `expressions` | `Record<string, string>` | Yes | 表情slug → 画像アセットID |

### Asset テーブル上の姿

| フィールド | 値 |
|-----------|-----|
| kind | `"ch-class"` |
| category | `null` |
| slug | `"hero"` |
| filename | `""` |
| blobPath | `""` |
| size | `0` |
| contentType | `"application/json"` |
| metadata | `{ "name": "主人公", ... }` |

### スクリプトからの解決

```
[show ch="hero" face="smile"]

1. slug "hero" → Asset (kind: ch-class)
2. metadata.expressions.smile → 画像アセットID
3. 画像アセットID → Asset (kind: image) の blobPath
4. blobPath → manifest → URL → 描画
```

---

## 5. データモデル

### 5.1 `Asset` テーブル

```prisma
model Asset {
  id          String  @id @db.VarChar(31)
  projectId   String  @map("project_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  slug        String? @db.VarChar(100)
  kind        String  @db.VarChar(30)     // "image" | "audio" | "ch-class"
  category    String? @db.VarChar(50)     // "bg" | "ch-img" | "effect" | "bgm" | "se" | "voice"
  subcategory String? @db.VarChar(50)     // "outdoor" | "indoor" | "battle" | ...
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  metadata    Json?                        // ch-class のJSON定義
  sourceType  String  @default("upload") @map("source_type") @db.VarChar(20)
  createdAt   BigInt  @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, slug])
  @@index([projectId])
  @@index([projectId, kind])
  @@index([projectId, kind, category])
  @@map("assets")
}
```

### 5.2 `UserAsset` テーブル（新規）

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
  metadata    Json?
  tags        String  @default("") @db.VarChar(500)
  createdAt   BigInt  @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, kind])
  @@map("user_assets")
}
```

### 5.3 `OfficialAsset` テーブル（拡張）

```prisma
model OfficialAsset {
  id          String  @id @db.VarChar(31)
  filename    String  @db.VarChar(255)
  kind        String  @db.VarChar(30)     // "image" | "audio"
  category    String  @db.VarChar(50)     // "bg" | "ch-img" | "bgm" | "se"
  subcategory String? @db.VarChar(50)     // "outdoor" | "fantasy" | ...
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  createdAt   BigInt  @map("created_at")

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

### 5.4 `User` モデル（リレーション追加）

```prisma
model User {
  // 既存フィールド省略
  userAssets UserAsset[]
  @@map("users")
}
```

### 5.5 廃止テーブル

| テーブル | 移行先 |
|---------|--------|
| `Character` | Asset (kind: "ch-class") の metadata |
| `Expression` | Asset metadata.expressions |
| `UserCharacter` | UserAsset (kind: "ch-class") |
| `UserExpression` | UserAsset metadata.expressions |

---

## 6. ページ構造

### 6.1 `/my-assets` — アセット管理ページ（新規）

MyPage から独立。ナビゲーションに追加。

#### タブ: 公式アセット / マイアセット

#### フィルター構造（3階層）

```
第1段: kind タブ
  [すべて] [画像] [音声] [キャラクラス]

第2段: category（kind 選択時に表示）
  画像 → [すべて] [背景] [キャラクター] [演出] [UI]
  音声 → [すべて] [BGM] [SE] [ボイス]

第3段: subcategory（category 選択時、あれば）
  背景 → [すべて] [屋外] [室内] [ファンタジー] ...
  SE   → [すべて] [バトル] [UI] [環境] ...
```

各カードに「プロジェクトに追加」ボタン → プロジェクト選択ドロップダウン。

### 6.2 MyPage の変更

- 「アセット」タブ → プロジェクトアセットの横断一覧に限定
- 「キャラクター」タブ → 廃止（アセットに統合）
- 上部に「アセット管理ページへ」リンク追加

---

## 7. API エンドポイント

### 7.1 新規

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/user-assets?kind=&category=&subcategory=` | マイアセット一覧（3階層フィルター） |
| POST | `/api/user-assets/upload` | マイアセットにアップロード |
| DELETE | `/api/user-assets/:id` | マイアセット削除 |
| POST | `/api/assets/:projectId/import-from-library` | マイアセット → プロジェクト Import |
| POST | `/api/assets/:projectId/character-class` | キャラクラス作成 |
| PUT | `/api/assets/:projectId/character-class/:slug` | キャラクラス更新 |

### 7.2 変更

| メソッド | パス | 変更内容 |
|---------|------|---------|
| GET | `/api/assets/:projectId` | `kind`, `category`, `subcategory` フィルター追加 |
| POST | `/api/assets/:projectId/upload` | kind を `"image"` / `"audio"` に変更、category 必須化 |
| POST | `/api/assets/:projectId/use-official` | sourceType: "official" 設定追加 |
| GET | `/api/official-assets` | kind/category/subcategory フィルター対応、レスポンス拡張 |
| GET | `/api/official-assets/categories` | kind+category ベースに変更 |
| DELETE | `/api/assets/:projectId/:assetId` | blobPath 参照チェックに UserAsset 追加 |

### 7.3 廃止

| メソッド | パス | 理由 |
|---------|------|------|
| GET/POST/PUT/DELETE | `/api/projects/:projectId/characters/*` | ch-class アセットに統合 |
| GET/POST | `/api/my-characters/*` | UserAsset (kind: ch-class) に統合 |

---

## 8. ユーザーフロー

### フローA: 公式アセット → プロジェクト Import

```
/my-assets「公式アセット」タブ
→ kind/category/subcategory フィルター
→ 「プロジェクトに追加」→ PJ選択
→ POST /api/assets/:projectId/use-official
→ Asset 作成（sourceType: "official"、slug 自動生成）
```

### フローB: マイアセット → プロジェクト Import

```
/my-assets「マイアセット」タブ → アップロード
→ POST /api/user-assets/upload (kind + category 指定)
→ UserAsset 作成

→ 「プロジェクトに追加」→ PJ選択
→ POST /api/assets/:projectId/import-from-library
→ Asset 作成（sourceType: "library"、slug 自動生成）
```

### フローC: エディタ直接アップロード（現行維持）

```
エディタ AssetPanel → ファイル選択
→ POST /api/assets/:projectId/upload (kind: "image", category: "bg")
→ Asset 作成（sourceType: "upload"、slug 自動生成）
```

### フローD: キャラクラス作成（新規）

```
エディタ キャラクラス管理
→ 名前・slug 入力
→ 表情追加: 表情名 + 画像アセット選択（AssetSelectModal で kind=image, category=ch-img）
→ POST /api/assets/:projectId/character-class
→ Asset 作成（kind: "ch-class"、metadata にJSON）
```

---

## 9. slug / Asset ID 仕様

- フラット形式維持: `forest_evening`, `hero`, `battle_bgm`
- 使用可能文字: `[a-z0-9_]`
- **プロジェクト内ユニーク**（`@@unique([projectId, slug])` 維持）
- 重複時は `_2`, `_3` を付与
- UserAsset には slug を持たせない（Import 時に確定）
- ch-class の slug = スクリプトでのキャラID（`[show ch="hero"]`）

---

## 10. Switch ポータビリティ

- slug ベースの参照を維持
- manifest に `assets`（slug→URL）と `characters`（slug→キャラ定義）の2セクション
- sourceType, category, subcategory はエンジン側で参照しない
- ch-class の解決: slug → metadata → expressions → 画像アセット slug → URL
