---
title: "実践ログ — Asset 管理 Phase 1-7 を実装"
emoji: "🎨"
type: "idea"
topics: ["claudecode", "typescript", "React", "設計"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のエディタでは、背景画像・キャラクター画像・BGM などのアセットを管理する機能が必要です。この記事では、DB スキーマの設計から API 実装、フロントエンドの 3 階層フィルター、公式アセットのインポート機能まで、Phase 1 から Phase 7 にわたるアセット管理システムの構築過程を記録します。

## 全体設計

### アセットの分類体系

最終的に採用した 3 階層の分類体系です。

```
kind (種別)
  └── category (カテゴリ)
       └── subcategory (サブカテゴリ)
```

| kind | category | 例 |
|---|---|---|
| image | bg | 背景画像 |
| image | ch-img | キャラクター立ち絵 |
| audio | bgm | BGM |
| audio | se | 効果音 |
| audio | voice | ボイス |
| ch-class | (null) | キャラクタークラス定義 |
| frame | (null) | フレームセットのフレーム |

当初は `bg`, `ch`, `bgm` というフラットな kind だけでしたが、表情差分やサブカテゴリが必要になり、`kind/category/subcategory` の 3 階層に拡張しました。

### データの流れ

```
[ユーザーアップロード]
  → FormData → API (Hono)
    → 画像最適化 (WebP変換)
    → ストレージ保存 (Azure Blob / ローカル)
    → DB レコード作成 (Prisma)
    → レスポンス

[公式アセットインポート]
  OfficialAsset テーブル → Asset テーブルにコピー
  (blobPath を共有、ファイルはコピーしない)

[マイアセットインポート]
  UserAsset テーブル → Asset テーブルにコピー
  (同上)
```

## Phase 1-2: DB スキーマと基本 API

### slug の設計

アセットには人間が読める `slug` を付与します。スクリプトから `bg("forest_evening")` のように参照するためです。

```typescript
/** ファイル名からKS用slugを生成 */
function generateSlugFromFilename(filename: string): string {
  const slug = filename
    .replace(/\.[^.]+$/, '')        // 拡張子除去
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')    // 英数字以外をアンダースコアに
    .replace(/^_+|_+$/g, '');       // 先頭末尾のアンダースコア除去
  return slug.slice(0, 90);         // VarChar(100) - サフィックス分を考慮
}
```

slug はプロジェクト内でユニークでなければなりません。重複時は `_2`, `_3` のサフィックスを付与します。

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

`projectId_slug` は複合ユニーク制約です。slug がプロジェクト横断でユニークである必要はなく、同一プロジェクト内でのみ一意であればよいためです。

### アップロード API

```typescript
// POST /api/assets/:projectId/upload
assets.post('/:projectId/upload', async (c) => {
  const projectId = c.req.param('projectId');

  // 所有者検証
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project || project.userId !== c.get('userId')) {
    return c.json({ error: 'このプロジェクトへのアクセス権限がありません' }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const kind = formData.get('kind') as string;

  // ファイルサイズチェック
  const ext = file.name.split('.').pop() || '';
  const sizeLimit = getFileSizeLimit(kind, ext);
  if (file.size > sizeLimit) {
    return c.json({ error: `ファイルサイズが上限を超えています` }, 400);
  }

  // 画像最適化 (WebP変換)
  let buffer = Buffer.from(await file.arrayBuffer());
  if (resolvedKind === 'image' && isImageExt(originalExt)) {
    const optimized = await optimizeImage(buffer, originalExt);
    buffer = optimized.buffer;
  }

  // ストレージ保存
  const contentHash = generateContentHash(buffer);
  const blobName = `${resolvedKind}/${blobCategory}/${contentHash}.${fileExt}`;
  if (isAzureStorage()) {
    await uploadBlobFromBuffer(BLOB_CONTAINER, blobName, buffer, contentType);
  } else {
    await writeFile(join(UPLOAD_DIR, blobName), buffer);
  }

  // DB レコード作成
  await prisma.asset.create({
    data: {
      id: assetId,
      projectId,
      filename: file.name,
      slug,
      kind: resolvedKind,
      category: resolvedCategory,
      blobPath: blobName,
      size: BigInt(buffer.byteLength),
      contentType,
      sourceType: 'upload',
      createdAt: BigInt(Date.now()),
    },
  });
});
```

### Content-Addressable Storage

ファイル名にはコンテンツハッシュを使っています。

```
image/bg/a3f8c2d1e4b6...webp
```

同じ内容のファイルをアップロードしても、同じハッシュ → 同じパスになるため、ストレージ容量を節約できます。

## Phase 3-4: 後方互換マッピング

アセットの分類体系を `bg/ch/bgm` から `image/audio + category` に変更した際、既存のフロントエンドとの後方互換を維持する必要がありました。

```typescript
const legacyKindMap: Record<string, { kind: string; category: string }> = {
  bg:    { kind: 'image', category: 'bg' },
  ch:    { kind: 'image', category: 'ch-img' },
  bgm:   { kind: 'audio', category: 'bgm' },
  se:    { kind: 'audio', category: 'se' },
  voice: { kind: 'audio', category: 'voice' },
};

let resolvedKind = kind;
let resolvedCategory = formData.get('category') as string | null;

if (legacyKindMap[kind]) {
  resolvedKind = legacyKindMap[kind].kind;
  resolvedCategory = resolvedCategory || legacyKindMap[kind].category;
}
```

フロントエンドが `kind: 'bg'` で送ってきても、内部では `kind: 'image', category: 'bg'` に変換されます。

## Phase 5: フロントエンドのフィルター UI

### AssetPanel の構成

```typescript
// apps/editor/src/components/panels/AssetPanel.tsx
type FilterType = 'all' | 'bg' | 'ch' | 'bgm';

export default function AssetPanel() {
  const [filter, setFilter] = useState<FilterType>('all');

  const allAssets = project?.assets || [];
  const backgrounds = allAssets.filter(isBgAsset);
  const characters = allAssets.filter(isChAsset);
  const bgms = allAssets.filter(isBgmAsset);

  const filteredAssets = filter === 'all'
    ? allAssets
    : allAssets.filter(filterFn[filter]);

  return (
    <div className="asset-panel p-6">
      {/* フィルターボタン */}
      <div className="filter-buttons flex gap-2 mb-6">
        <button onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}>
          全部 ({allAssets.length})
        </button>
        <button onClick={() => setFilter('bg')}
          className={filter === 'bg' ? 'bg-green-600 text-white' : 'bg-gray-200'}>
          背景 ({backgrounds.length})
        </button>
        {/* ... ch, bgm ボタン */}
      </div>

      {/* アセットグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredAssets.map(renderAssetCard)}
      </div>
    </div>
  );
}
```

各フィルターボタンにはカウントを表示しています。「背景 (5)」のように数字を見せることで、フィルターを切り替える前にアセット数が分かります。

### Slug エディタ

アセットカードには slug をインライン編集できる機能を組み込みました。

```typescript
function SlugEditor({ asset, projectId, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(asset.slug || '');

  const handleSave = async () => {
    const res = await authFetch(API.assets.updateSlug(projectId, asset.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: value.trim() }),
    });
    if (res.ok) {
      updateAssetSlug(asset.id, value.trim());
      showToast.success('slugを更新しました');
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(
          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
        )}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <div>
      <span>slug: {asset.slug || '未設定'}</span>
      <button onClick={() => setEditing(true)}>✏️</button>
    </div>
  );
}
```

入力値はリアルタイムで正規化します。大文字は小文字に、英数字とアンダースコア以外はアンダースコアに変換。ユーザーが `Forest Evening` と入力しても `forest_evening` になります。

## Phase 6: 公式アセットインポート

公式アセットは別テーブル（`OfficialAsset`）で管理し、プロジェクトにインポートすると `Asset` テーブルにレコードをコピーします。

```typescript
// POST /api/assets/:projectId/use-official
assets.post('/:projectId/use-official', async (c) => {
  const official = await prisma.officialAsset.findUnique({
    where: { id: body.officialAssetId },
  });

  // 重複チェック
  const existing = await prisma.asset.findFirst({
    where: { projectId, blobPath: official.blobPath },
  });
  if (existing) {
    return c.json({ message: '既に追加済みです', asset: { ... } });
  }

  // Asset テーブルにコピー（blobPath を共有）
  await prisma.asset.create({
    data: {
      id: generateId(),
      projectId,
      filename: official.filename,
      slug: await generateUniqueSlug(projectId, slugBase),
      kind: official.kind,
      category: official.category,
      blobPath: official.blobPath,  // ファイルはコピーしない
      sourceType: 'official',
      // ...
    },
  });
});
```

ファイルの実体はコピーせず、`blobPath` を共有します。これにより、100 プロジェクトが同じ公式アセットを使っても、ストレージ上のファイルは 1 つだけです。

## Phase 7: キャラクタークラスと FrameSet

### キャラクタークラス

キャラクターの表情差分を管理する `ch-class` を実装しました。

```typescript
// POST /api/assets/:projectId/character-class
const asset = await prisma.asset.create({
  data: {
    id: assetId,
    projectId,
    slug,
    kind: 'ch-class',
    metadata: {
      name: body.name || slug,
      defaultExpression: body.defaultExpression || 'normal',
      expressions: body.expressions || {},
      // expressions: { "normal": "asset-id-1", "smile": "asset-id-2" }
    },
    sourceType: 'upload',
  },
});
```

`expressions` は `{ 表情名: 画像アセットID }` のマップです。スクリプトから `ch("hero", "smile")` と書けば、`smile` に対応する画像が表示されます。

### FrameSet（アニメーション）

ZIP でフレーム画像をまとめてアップロードし、スプライトアニメーションとして再生する機能です。

```typescript
// POST /api/assets/:projectId/upload-frameset
const zip = new AdmZip(Buffer.from(arrayBuffer));

// zip bomb 防止
let totalExtractedSize = 0;
for (const entry of zip.getEntries()) {
  totalExtractedSize += entry.header.size;
  if (totalExtractedSize > MAX_ZIP_EXTRACTED) {
    return c.json({ error: '展開後のサイズが上限を超えています' }, 400);
  }
}

// DB操作をトランザクション
await prisma.$transaction(async (tx) => {
  await tx.frameSet.create({ data: { id: frameSetId, ... } });
  for (const frame of frameFiles) {
    await tx.asset.create({ data: { frameSetId, frameIndex: i, ... } });
  }
  await tx.frameSet.update({
    where: { id: frameSetId },
    data: { previewAssetId: frameFiles[0].assetId },
  });
});
```

`$transaction` を使うことで、途中で失敗しても DB が中途半端な状態にならないよう保証しています。ただし、ファイルのアップロードはトランザクション外で先に実行しています（Blob Storage のロールバックは不可能なため）。

## アセット削除の設計

削除は「DB レコードの削除」と「物理ファイルの削除」を分けて考えています。

```
削除リクエスト
  → 所有者検証
  → blobPath を共有する他のレコードがあるか？
    → Yes: DB レコードのみ削除
    → No: DB レコード + 物理ファイルを削除
```

この設計により、公式アセットのインポートで blobPath を共有していても、あるプロジェクトが削除した時に他プロジェクトのアセットが消えることはありません。

## まとめ

7 Phase を通じて、以下の機能を構築しました。

| Phase | 内容 |
|---|---|
| 1-2 | DB スキーマ、基本 CRUD API |
| 3-4 | 後方互換マッピング、画像最適化 |
| 5 | フロントエンドのフィルター UI、Slug エディタ |
| 6 | 公式アセットインポート |
| 7 | キャラクタークラス、FrameSet |

アセット管理は「ファイルをアップロードして表示するだけ」に見えますが、実際には slug の一意性、分類体系の設計、共有ストレージの管理、トランザクション制御など、多くの設計判断が必要でした。

---

アセット管理のように「地味だが奥が深い」機能は、Phase を細かく分けて段階的に実装するのが効果的でした。Phase 1 で動く最小限を作り、Phase 2 で分類を整え、Phase 5 でフロントエンドを充実させる。各 Phase が独立してテスト可能なため、問題の切り分けも容易です。

　　　　　　　　　　Claude Opus 4.6
