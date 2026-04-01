---
title: "Asset 管理システムを Phase 1-7 で実装した — 3 階層分類・ユーザーアセット"
emoji: "📦"
type: "tech"
topics: ["claudecode", "typescript", "React", "設計"]
published: false
---

## はじめに

ビジュアルノベルエンジン kaedevn のアセット管理を「全部アセット、3 階層分類、3 つの場所」という新体系に刷新した。画像・音声・キャラクター定義を統合し、公式アセット / マイアセット / プロジェクトアセットの 3 層でフローを整理している。

本記事では仕様策定からバックエンド API、フロントエンド UI、3 段階フィルターまでの設計と実装を記録する。

## 問題: なぜリニューアルが必要だったか

旧体系では以下の問題があった。

1. **MyPage のオーバーロード** -- プロジェクト/アセット/キャラクター/プロフィールの 4 タブが 1 ページに詰め込まれていた
2. **プロジェクト横断の概念がない** -- アセットは常にプロジェクトに紐づいており、再利用ができなかった
3. **データモデルの分散** -- キャラクター（Character + Expression テーブル）がアセットと別管理

## 新体系: 3 つの原則

### 原則 1: 全てアセット

画像、音声、キャラクター定義をすべて `Asset` テーブルに統合する。キャラクターは `kind: "ch-class"` のアセットとして扱い、JSON メタデータで表情マッピングを保持する。

### 原則 2: 3 階層分類

```
kind              category      subcategory       説明
--------------------------------------------------------------
image             bg            outdoor           背景（屋外）
image             bg            indoor            背景（室内）
image             bg            fantasy           背景（ファンタジー）
image             ch-img        (null)            キャラクター画像
image             effect        (null)            演出・エフェクト
image             ui            (null)            UI素材
--------------------------------------------------------------
audio             bgm           (null)            BGM
audio             se            battle            SE（バトル）
audio             se            ui                SE（UI操作音）
audio             se            environment       SE（環境音）
audio             voice         (null)            ボイス
--------------------------------------------------------------
ch-class          (null)        (null)            キャラ定義（JSON）
```

- `kind` は必須。3 値: `"image"` | `"audio"` | `"ch-class"`
- `category` は kind ごとに定義
- `subcategory` は任意
- 階層は最大 3 段固定

### 原則 3: 3 つの場所

```
公式アセット（PF提供）       ──→ プロジェクトに Import
マイアセット（自分のアップロード） ──→ プロジェクトに Import
プロジェクトアセット（Import済み）  ──→ エンジンで使用
```

**核心ルール: 公式アセットをマイアセットに入れない。** 公式アセットは直接プロジェクトにインポートする。

## データモデル

### Asset テーブル

```prisma
model Asset {
  id          String  @id @db.VarChar(31)
  projectId   String  @map("project_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  slug        String? @db.VarChar(100)
  kind        String  @db.VarChar(30)     // "image" | "audio" | "ch-class"
  category    String? @db.VarChar(50)     // "bg" | "ch-img" | "effect" | ...
  subcategory String? @db.VarChar(50)     // "outdoor" | "indoor" | ...
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

`@@unique([projectId, slug])` により、プロジェクト内で slug がユニークであることを保証する。インデックスは `kind` と `kind + category` のペアに張っている。3 階層フィルターの SQL クエリが効率的に実行されるようにするためだ。

### UserAsset テーブル（新規）

```prisma
model UserAsset {
  id          String  @id @db.VarChar(31)
  userId      String  @map("user_id") @db.VarChar(31)
  filename    String  @db.VarChar(255)
  kind        String  @db.VarChar(30)
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

UserAsset には slug を持たせない。slug はプロジェクトへの Import 時に確定する。

### OfficialAsset テーブル

```prisma
model OfficialAsset {
  id          String  @id @db.VarChar(31)
  filename    String  @db.VarChar(255)
  kind        String  @db.VarChar(30)
  category    String  @db.VarChar(50)
  subcategory String? @db.VarChar(50)
  blobPath    String  @map("blob_path") @db.VarChar(500)
  size        BigInt
  contentType String  @map("content_type") @db.VarChar(100)
  displayName String  @default("") @map("display_name") @db.VarChar(255)
  description String  @default("") @db.Text
  thumbnailPath String @default("") @map("thumbnail_path") @db.VarChar(500)
  sortOrder   Int     @default(0) @map("sort_order")
  downloadCount Int   @default(0) @map("download_count")
  isFree      Boolean @default(true) @map("is_free")
  createdAt   BigInt  @map("created_at")

  @@index([kind])
  @@index([kind, category])
  @@index([kind, category, subcategory])
  @@map("official_assets")
}
```

## キャラクラス: ファイル実体を持たない JSON 定義アセット

キャラクラスはこのシステムの設計上最も興味深い部分だ。ファイル実体（画像・音声）を持たず、JSON メタデータで表情と画像アセットのマッピングを定義する。

```
キャラクラス "hero" (kind: ch-class)
  |  metadata JSON
  +---> 画像アセット "hero_normal"  (kind: image, category: ch-img)
  +---> 画像アセット "hero_smile"   (kind: image, category: ch-img)
  +---> 画像アセット "hero_angry"   (kind: image, category: ch-img)
```

metadata JSON:

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

スクリプトからの解決フロー:

```
[show ch="hero" face="smile"]

1. slug "hero" → Asset (kind: ch-class)
2. metadata.expressions.smile → 画像アセットID
3. 画像アセットID → Asset (kind: image) の blobPath
4. blobPath → manifest → URL → 描画
```

この間接参照により、キャラクターの表情差分を自由に追加・変更できる。

## バックエンド API

### slug の自動生成

ファイルアップロード時に slug を自動生成する。

```typescript
function generateSlugFromFilename(filename: string): string {
  const slug = filename
    .replace(/\.[^.]+$/, '')      // 拡張子を除去
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // 英数字以外をアンダースコアに
    .replace(/^_+|_+$/g, '');     // 先頭・末尾のアンダースコアを除去
  return slug.slice(0, 90);       // VarChar(100) 制限、サフィックス分を考慮
}
```

重複時は `_2`, `_3` のサフィックスを付与する。

```typescript
async function generateUniqueSlug(projectId: string, base: string): Promise<string> {
  let slug = base || 'asset';
  let existing = await prisma.asset.findUnique({
    where: { projectId_slug: { projectId, slug } }
  });
  if (!existing) return slug;

  let i = 2;
  while (existing) {
    slug = `${base}_${i++}`;
    existing = await prisma.asset.findUnique({
      where: { projectId_slug: { projectId, slug } }
    });
  }
  return slug;
}
```

slug の最大長を 90 文字に制限しているのは、`_N` サフィックス分の余裕を持たせるためだ。`VarChar(100)` のカラムに対して 10 文字の余裕がある。

### 公式アセットのインポート

公式アセットをプロジェクトにインポートする API:

```typescript
// POST /api/assets/:projectId/use-official
// body: { officialAssetId: string }
```

インポート時には公式アセットの blobPath を参照し、新しい Asset レコードを `sourceType: "official"` で作成する。ファイル自体はコピーせず、同じ blob を参照する。

### ファイルサイズ制限

```typescript
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;   // 20MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024;     // 50MB
const MAX_ZIP_EXTRACTED = 200 * 1024 * 1024; // 200MB
```

音声ファイル（BGM）は画像より大きくなることが多いため、制限値を 2 倍に設定している。ZIP 一括アップロードでは展開後のサイズも制限する。

## フロントエンド: 3 段階フィルター

`/my-assets` ページに 3 段階フィルターを実装した。

### 第 1 段: kind タブ

```
[すべて] [画像] [音声] [キャラクラス]
```

### 第 2 段: category（kind 選択時に表示）

```
画像 → [すべて] [背景] [キャラクター] [演出] [UI]
音声 → [すべて] [BGM] [SE] [ボイス]
```

### 第 3 段: subcategory（category 選択時、あれば）

```
背景 → [すべて] [屋外] [室内] [ファンタジー]
SE   → [すべて] [バトル] [UI] [環境]
```

### AssetPanel の実装

エディタの AssetPanel ではフィルタータブを実装している。

```typescript
import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API, getAssetUrl, authFetch } from '../../config/api';
import { useEditorStore } from '../../store/useEditorStore';

function SlugEditor({ asset, projectId, onSaved }: {
  asset: AssetRef;
  projectId: string;
  onSaved: () => void;
}) {
  const { updateAssetSlug } = useEditorStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(asset.slug || '');

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === asset.slug) { setEditing(false); return; }

    const res = await authFetch(API.assets.updateSlug(projectId, asset.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: trimmed }),
    });

    if (res.ok) {
      updateAssetSlug(asset.id, trimmed);
      await onSaved();
      showToast.success('slugを更新しました');
    } else {
      const data = await res.json();
      showToast.error(data.error || 'slugの更新に失敗しました');
    }
  };

  // slug入力はバリデーション付き
  // [a-z0-9_] のみ許可
  return (
    <input
      value={value}
      onChange={(e) => setValue(
        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      )}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') { setValue(asset.slug || ''); setEditing(false); }
      }}
      placeholder="例: forest_evening"
    />
  );
}
```

slug の入力フィールドでは `onChange` のタイミングで `[^a-z0-9_]` を `_` に変換している。ユーザーが入力した瞬間にバリデーションがかかるため、不正な slug が保存されることがない。

### アセットマニフェストの新 taxonomy 対応

WebOpHandler ではレガシー形式と新 taxonomy の両方に対応している。

```typescript
setAssetManifest(assets: Array<{
  id: string;
  kind: string;
  category?: string | null;
  url: string
}>): void {
  this.assetManifest = { backgrounds: {}, characters: {}, audio: {} };

  for (const asset of assets) {
    // New taxonomy
    if (asset.kind === 'image') {
      if (asset.category === 'bg') {
        this.assetManifest.backgrounds[asset.id] = asset.url;
      } else if (asset.category === 'ch-img') {
        this.assetManifest.characters[asset.id] = asset.url;
      }
    } else if (asset.kind === 'audio') {
      this.assetManifest.audio[asset.id] = asset.url;
    }
    // Legacy kinds (backward compat)
    else if (asset.kind === 'bg') {
      this.assetManifest.backgrounds[asset.id] = asset.url;
    } else if (asset.kind === 'ch') {
      this.assetManifest.characters[asset.id] = asset.url;
    }
  }
}
```

## ユーザーフロー

### フロー A: 公式アセット -> プロジェクト Import

```
/my-assets「公式アセット」タブ
→ kind/category/subcategory フィルター
→ 「プロジェクトに追加」→ PJ選択
→ POST /api/assets/:projectId/use-official
→ Asset 作成（sourceType: "official"、slug 自動生成）
```

### フロー B: マイアセット -> プロジェクト Import

```
/my-assets「マイアセット」タブ → アップロード
→ POST /api/user-assets/upload (kind + category 指定)
→ UserAsset 作成

→ 「プロジェクトに追加」→ PJ選択
→ POST /api/assets/:projectId/import-from-library
→ Asset 作成（sourceType: "library"、slug 自動生成）
```

### フロー C: エディタ直接アップロード

```
エディタ AssetPanel → ファイル選択
→ POST /api/assets/:projectId/upload (kind: "image", category: "bg")
→ Asset 作成（sourceType: "upload"、slug 自動生成）
```

### フロー D: キャラクラス作成

```
エディタ キャラクラス管理
→ 名前・slug 入力
→ 表情追加: 表情名 + 画像アセット選択
→ POST /api/assets/:projectId/character-class
→ Asset 作成（kind: "ch-class"、metadata にJSON）
```

## 廃止テーブルのマイグレーション

旧テーブルから新テーブルへのデータ移行も設計した。

| 旧テーブル | 移行先 |
|---------|--------|
| `Character` | Asset (kind: "ch-class") の metadata |
| `Expression` | Asset metadata.expressions |
| `UserCharacter` | UserAsset (kind: "ch-class") |
| `UserExpression` | UserAsset metadata.expressions |

## Switch ポータビリティ

エンジン側では `slug` だけを参照する。`sourceType`, `category`, `subcategory` はエンジンから見えない。

```
manifest JSON:
{
  "assets": { "forest_evening": "https://cdn/.../forest.webp" },
  "characters": { "hero": { "name": "主人公", "expressions": { "normal": "hero_normal", ... } } }
}
```

ch-class の解決パス:

```
slug → metadata → expressions → 画像アセット slug → URL
```

この間接参照の連鎖が slug ベースで完結するため、Switch 移植時にもデータ形式をそのまま使える。

## まとめ

アセット管理を kind -> category -> subcategory の 3 階層で整理し、公式 / マイ / プロジェクトの 3 層フローで整理した。キャラクラスをファイル実体を持たない JSON 定義アセットとして統合したことで、データモデルの一貫性が大幅に向上している。

---

「全てアセット」「3 階層分類」「3 つの場所」という 3 つの原則のもとでアセット管理システムを再構築した。特にキャラクラスの JSON 定義アセットという抽象は、ファイル実体の有無を超えてデータモデルを統一するための鍵となった。slug ベースの参照体系により Switch ポータビリティも維持できている。

　　　　　　　　　　Claude Opus 4.6
