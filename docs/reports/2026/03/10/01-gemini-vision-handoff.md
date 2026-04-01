# Gemini CLI 画像詳細生成 引き継ぎ資料

## 目的

`official_assets` テーブルの `metadata.fromVision` を Gemini API の画像認識で埋める。
現在はファイル名パース（`fromFilename`）のみで、実際の画像内容に基づく説明がない。

---

## DB 接続

```
postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev
```

## テーブル: `official_assets`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | VarChar(31) | PK |
| `filename` | VarChar(255) | 元ファイル名 |
| `kind` | VarChar(30) | `"image"` / `"audio"` |
| `category` | VarChar(50) | `"bg"` / `"ch-img"` / `"ovl"` / `"bgm"` |
| `subcategory` | VarChar(50) | `"ファンタジー"` / `"学園"` 等 |
| `blob_path` | VarChar(500) | 画像パス（例: `bg/abc123.webp`） |
| `metadata` | JSONB | **ここの `fromVision` を埋める** |
| `description` | Text | 説明文（現在空） |
| `display_name` | VarChar(255) | 表示名（現在空） |

## 画像の取得方法

### ローカルファイル（推奨）

画像はローカルにもある:

```
apps/hono/public/uploads/{blob_path}
```

`blob_path` のプレフィックスとローカルディレクトリの対応:

| blob_path prefix | ローカルパス | 件数 |
|---|---|---|
| `bg/xxx.webp` | `apps/hono/public/uploads/bg/` | 293 |
| `ch/xxx.webp` | `apps/hono/public/uploads/ch/` | 297 |
| `ovl/xxx.webp` | `apps/hono/public/uploads/ovl/` | - |

例: `blob_path` = `bg/ce7c34e69401934d.webp`
→ ローカル: `apps/hono/public/uploads/bg/ce7c34e69401934d.webp`

### Gemini に渡す方法

ローカルファイルを直接読み込んで渡す:

```bash
# 絶対パスの組み立て
REPO_ROOT="<PROJECT_ROOT>"
FILE_PATH="${REPO_ROOT}/apps/hono/public/uploads/${blob_path}"
```

### Azure Blob URL（参考）

```
https://kaedevnworks.blob.core.windows.net/assets/{blob_path}
```

## 対象レコードの取得

```sql
-- 画像アセットのみ（audio は対象外）
SELECT id, category, subcategory, filename, blob_path, metadata
FROM official_assets
WHERE kind = 'image'
ORDER BY category, subcategory, filename;
```

カテゴリ別件数の確認:
```sql
SELECT category, subcategory, COUNT(*)
FROM official_assets
WHERE kind = 'image'
GROUP BY category, subcategory
ORDER BY category, subcategory;
```

## 現在の metadata 構造

`parse-asset-metadata.mjs` が生成済み:

```json
{
  "fromFilename": {
    "genre": "fantasy",
    "role": "knight",
    "gender": "man",
    "age": null,
    "trait": "brave",
    "subtype": "main"
  },
  "fromVision": null,
  "subtype": "main",
  "tags": ["fantasy", "ファンタジー", "knight", "騎士"]
}
```

### BG（背景）の fromFilename

```json
{
  "genre": "fantasy",
  "location": "forest",
  "timeOfDay": "night",
  "mood": "mystical",
  "subtype": "outdoor"
}
```

### CH（キャラクター）の fromFilename

```json
{
  "genre": "fantasy",
  "role": "knight",
  "gender": "man",
  "age": "young",
  "trait": "brave",
  "subtype": "main"
}
```

## Gemini で埋めてほしいフィールド

### `metadata.fromVision`（画像認識の結果）

**BG 用:**
```json
{
  "description_ja": "夜の森。月明かりが木々の間から差し込み、地面には苔が生えている。奥に古い石碑が見える。",
  "description_en": "A forest at night. Moonlight filters through the trees, moss covers the ground. An old stone monument is visible in the distance.",
  "location": "forest",
  "timeOfDay": "night",
  "mood": "mystical",
  "colors": ["dark green", "blue", "silver"],
  "objects": ["trees", "moss", "stone monument", "moonlight"]
}
```

**CH 用:**
```json
{
  "description_ja": "銀色の鎧を着た若い男性騎士。青い目で、短い金髪。剣を右手に持ち、自信に満ちた表情。",
  "description_en": "A young male knight in silver armor. Blue eyes, short blonde hair. Holding a sword in his right hand with a confident expression.",
  "gender": "man",
  "age": "young",
  "hair_color": "blonde",
  "eye_color": "blue",
  "outfit": "silver armor",
  "expression": "confident",
  "objects": ["sword", "armor"]
}
```

## DB 更新クエリ

```sql
-- metadata の fromVision だけを更新（他のフィールドは保持）
UPDATE official_assets
SET metadata = jsonb_set(
  COALESCE(metadata, '{}')::jsonb,
  '{fromVision}',
  $1::jsonb
)
WHERE id = $2;
```

### description / display_name も同時に埋める場合

```sql
UPDATE official_assets
SET
  metadata = jsonb_set(COALESCE(metadata, '{}')::jsonb, '{fromVision}', $1::jsonb),
  description = $2,
  display_name = $3
WHERE id = $4;
```

## 既存 CLI（参考）

```bash
# ファイル名パース → metadata.fromFilename 書き込み（Phase 1 済み）
node scripts/db/parse-asset-metadata.mjs --dry-run
node scripts/db/parse-asset-metadata.mjs --execute
```

## 処理フロー（想定）

1. `SELECT` で対象レコード取得（`kind = 'image'` かつ `metadata->>'fromVision' IS NULL`）
2. `blob_path` → 画像URL組み立て
3. Gemini API に画像URLを渡して説明生成
4. レスポンスを `fromVision` JSON に整形
5. `UPDATE` で `metadata.fromVision` + `description` + `display_name` を書き込み
6. 完了後 `sync-official-assets.mjs --execute` でAzureに同期
