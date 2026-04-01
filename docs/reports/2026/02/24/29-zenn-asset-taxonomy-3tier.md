---
title: "Asset 分類リストラクチャ — カテゴリ→サブカテゴリ→タグの 3 階層設計"
emoji: "🗂"
type: "tech"
topics: ["claudecode", "typescript", "設計", "UX"]
published: false
---

## はじめに

ビジュアルノベルエンジンのアセット管理を設計するにあたり、「背景画像を選びたい」「バトルSEを探したい」「キャラクターの立ち絵を差し替えたい」といったユースケースに対応する分類体系が必要でした。

当初はフラットな `kind`（`bg`, `ch`, `bgm`, `se`, `voice`）だけで管理していましたが、アセットが増えるにつれて「室内の背景だけ見たい」「バトル用のSEだけ見たい」という要求が出てきました。さらに、キャラクターを別テーブル（Character + Expression）で管理していたため、アセットとキャラクターが別系統になり、コードが複雑化していました。

本記事では、フラットなタグ体系から **kind → category → subcategory の 3 階層** に移行した設計判断と、その UI への反映を解説します。

## 旧体制: フラットな kind

旧体制では、アセットは 5 つの `kind` で分類していました。

```
Asset テーブル
  kind: "bg" | "ch" | "bgm" | "se" | "voice"
```

これに加えて、キャラクターは別テーブルで管理していました。

```
Character テーブル  → 名前、デフォルト表情
  └── Expression テーブル  → 表情名、画像URL
```

### 問題点

1. **背景が増えると見通しが悪い**: 100 個の背景から「室内」を探すのが大変
2. **SE も同様**: 環境音とバトルSEが混在
3. **キャラクターが別系統**: アセット管理とキャラクター管理が別 UI
4. **API が複雑**: アセット取得と キャラクター取得が別エンドポイント
5. **マイライブラリの共有が面倒**: ユーザーアセットとユーザーキャラクターが別テーブル

## 新体系: 3 階層分類

新体系では、**全てをアセットとして統合**し、3 階層で分類します。

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
ch-class          (null)        (null)           キャラ定義（JSON）
```

### ルール

- `kind` は必須: `"image"` | `"audio"` | `"ch-class"`
- `category` は kind ごとに定義。ch-class は null
- `subcategory` は任意。使わない場合は null
- **階層は最大 3 段固定**。それ以上は作らない

## 設計判断: なぜ 3 階層か

### 2 階層では不十分

2 階層（kind + category）だけでは、「背景の中の屋外」と「背景の中の室内」を区別できません。SE も「バトルSE」と「UI操作音」を分けたいニーズがあります。

### 4 階層以上は過剰

4 階層にすると、「屋外」の中の「昼」と「夜」を分けられますが、それはタグやファイル名で対応すべき粒度です。分類の階層が深くなると、UI のフィルタが複雑になり、ユーザーの認知負荷が上がります。

### 3 階層 = ちょうどいい

```
kind (大分類)  → タブで切り替え
  category (中分類) → ボタングループで切り替え
    subcategory (小分類) → ドロップダウンまたはボタンで切り替え
```

それぞれの階層が UI の異なるコンポーネントに対応し、ユーザーは最大 3 クリックで目的のアセットにたどり着けます。

## キャラクラス: ファイルを持たない定義アセット

最も大きな設計変更は、キャラクターを「アセット」に統合したことです。

```
キャラクラス "hero" (Asset, kind: "ch-class")
  │
  │  metadata JSON で参照
  │
  ├──→ 画像アセット "hero_normal"  (kind: image, category: ch-img)
  ├──→ 画像アセット "hero_smile"   (kind: image, category: ch-img)
  └──→ 画像アセット "hero_angry"   (kind: image, category: ch-img)
```

キャラクラスは **ファイル実体を持たない定義アセット** です。中身は JSON のメタデータで、画像アセットへの参照を持ちます。

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

### スクリプトからの解決フロー

```
[show ch="hero" face="smile"]

1. slug "hero" → Asset (kind: ch-class) を検索
2. metadata.expressions.smile → 画像アセットID "01ASSET_SMILE_ID"
3. アセットID → Asset (kind: image) の blobPath
4. blobPath → manifest で URL 解決 → 描画
```

### メリット

| 項目 | 旧（Character テーブル） | 新（ch-class アセット） |
|------|------------------------|------------------------|
| テーブル数 | 3（Asset + Character + Expression） | 1（Asset のみ） |
| API | 別エンドポイント | 統一エンドポイント |
| マイライブラリ | UserCharacter + UserExpression | UserAsset (kind: ch-class) |
| インポート | キャラ用の専用ロジック | アセットインポートで統一 |

## データモデル: Prisma スキーマ

```prisma
model Asset {
  id          String  @id @db.VarChar(31)
  projectId   String  @map("project_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  slug        String? @db.VarChar(100)
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  createdAt   BigInt  @map("created_at")

  // 3 階層分類
  kind        String  @db.VarChar(30)     // "image" | "audio" | "ch-class"
  category    String? @db.VarChar(50)     // "bg" | "ch-img" | "bgm" | "se" ...
  subcategory String? @db.VarChar(50)     // "outdoor" | "indoor" | "battle" ...
  metadata    Json?                        // ch-class の JSON 定義など
  sourceType  String  @default("upload") @map("source_type") @db.VarChar(20)

  project     Project @relation(...)

  @@unique([projectId, slug])
  @@index([projectId])
  @@index([projectId, kind])
  @@index([projectId, kind, category])
  @@map("assets")
}
```

インデックスは 3 段階で用意しています。

- `[projectId]`: 全アセット取得
- `[projectId, kind]`: kind でフィルタ
- `[projectId, kind, category]`: kind + category でフィルタ

## マイグレーション: 旧 kind → 新 kind/category

既存データの変換テーブルです。

| 旧 kind | 新 kind | 新 category | 新 subcategory |
|---------|---------|------------|---------------|
| `bg` | `image` | `bg` | `null` |
| `ch` | `image` | `ch-img` | `null` |
| `bgm` | `audio` | `bgm` | `null` |
| `se` | `audio` | `se` | `null` |
| `voice` | `audio` | `voice` | `null` |

```sql
-- 既存データ変換
UPDATE "assets" SET category = 'bg',     kind = 'image' WHERE kind = 'bg';
UPDATE "assets" SET category = 'ch-img', kind = 'image' WHERE kind = 'ch';
UPDATE "assets" SET category = 'bgm',    kind = 'audio' WHERE kind = 'bgm';
UPDATE "assets" SET category = 'se',     kind = 'audio' WHERE kind = 'se';
UPDATE "assets" SET category = 'voice',  kind = 'audio' WHERE kind = 'voice';
```

## UI のフィルター設計

### マイアセットページ `/my-assets`

3 階層のフィルターを段階的に表示します。

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

エディタのアセット選択モーダルでは、コンテキストに応じて自動でフィルターが適用されます。

```tsx
// AssetSelectModal.tsx
type Props = {
  assetKind?: string;  // "bg" | "ch" | "bgm" | "se" | "voice"
  // ...
};
```

背景ブロックから開いた場合は `assetKind="bg"` が渡され、自動的に `kind=image, category=bg` でフィルタリングされます。

```tsx
// マイライブラリの読み込み
const fetchLibrary = async () => {
  const kind = assetKind || 'bg';
  // 旧 kind → 新 kind マッピング
  const kindMap: Record<string, string> = {
    bg: 'image', ch: 'image',
    bgm: 'audio', se: 'audio', voice: 'audio',
  };
  const resolvedKind = kindMap[kind] || kind;
  const res = await authFetch(API.userAssets.list({ kind: resolvedKind }));
  // ...
};
```

### エディタ AssetPanel

AssetPanel では、フィルターの型を定義しています。

```tsx
type FilterType = 'all' | 'bg' | 'ch' | 'bgm';
```

これを新体系に対応させるには、kind と category の組み合わせでフィルタリングする必要があります。

```typescript
// フィルター適用ロジック
function filterAssets(assets: AssetRef[], filter: FilterType): AssetRef[] {
  if (filter === 'all') return assets;

  const filterMap: Record<string, { kind: string; category?: string }> = {
    bg:  { kind: 'image', category: 'bg' },
    ch:  { kind: 'image', category: 'ch-img' },
    bgm: { kind: 'audio', category: 'bgm' },
  };

  const f = filterMap[filter];
  return assets.filter((a) =>
    a.kind === f.kind && (!f.category || a.category === f.category)
  );
}
```

## API エンドポイントの変更

全アセット系エンドポイントのクエリパラメータを拡張しました。

```
GET /api/assets/:projectId?kind=image&category=bg&subcategory=outdoor
GET /api/user-assets?kind=audio&category=se
GET /api/official-assets?kind=image&category=bg&subcategory=fantasy_outdoor
```

### キャラクラス専用 API

キャラクラスの作成・更新は専用エンドポイントで行います。

```
POST /api/assets/:projectId/ch-class
  body: { slug, name, defaultExpression, expressions: { [slug]: assetId } }
  → kind: "ch-class" の Asset を作成

PUT /api/assets/:projectId/ch-class/:slug
  body: { name?, expressions? }
  → metadata を更新
```

## エンジン manifest への影響

ゲーム実行時のアセット解決は manifest を通じて行います。manifest は 2 セクション構成です。

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

ch-class の解決はエンジン内部で 2 段階です。

```
1. manifest.characters["hero"] → expressions["smile"] → "hero_smile"
2. manifest.assets["hero_smile"] → "https://storage.../xyz789.webp"
```

## 廃止対象テーブル

| テーブル | 理由 | 移行先 |
|---------|------|--------|
| Character | kind: "ch-class" のアセットに統合 | Asset.metadata |
| Expression | ch-class の JSON expressions に統合 | Asset.metadata.expressions |
| UserCharacter | マイアセットの ch-class に統合 | UserAsset (kind: ch-class) |
| UserExpression | 同上 | UserAsset の metadata.expressions |

## 修正対象ファイル

新体系への移行で変更が必要なファイルの一覧です。

| ファイル | 変更内容 |
|---------|---------|
| `prisma/schema.prisma` | category/subcategory/metadata 追加 |
| `routes/assets.ts` | 3 階層フィルター、ch-class CRUD |
| `routes/user-assets.ts` | 同様の 3 階層対応 |
| `routes/official-assets.ts` | kind/category/subcategory 対応 |
| `my-assets/page.tsx` | 3 階層フィルター UI |
| `AssetSelectModal.tsx` | kind/category ベースの絞り込み |
| `CharacterPanel.tsx` | ch-class アセット操作に変更 |
| `WebEngine.ts` | manifest の characters セクション対応 |

## まとめ

| 設計判断 | 理由 |
|---------|------|
| フラット → 3 階層 | ユーザーが最大 3 クリックで目的のアセットに到達 |
| キャラクターをアセットに統合 | テーブル数とAPI数を削減 |
| ch-class は JSON メタデータ | ファイル実体不要。画像アセットへの参照で構成 |
| 3 階層固定 | 過剰な階層は認知負荷を上げる |
| subcategory は null 許容 | 不要な場合はスキップできる柔軟性 |

3 階層分類は、アセットの種類が多いゲーム開発で特に有効です。ポイントは「ちょうどいい粒度」を見極めること。2 階層では足りず、4 階層では過剰。UI のフィルター構造と 1:1 で対応する 3 階層が、このプロジェクトにとっての最適解でした。

---

アセットの分類体系を設計するとき、最初に考えたのは「ユーザーが何クリックで目的のアセットにたどり着けるか」でした。3 階層という結論は、UI のフィルター構造から逆算して導いたものです。キャラクターを「ファイルを持たない定義アセット」として統合したのは大きな判断でしたが、テーブル数と API 数の削減効果は予想以上でした。

　　　　　　　　　　Claude Opus 4.6
