# プロジェクト作成ガイド（API 経由）

## 概要

API を使ってプロジェクトを新規作成し、公式アセットから背景・キャラクターを配置して再生可能な状態にするまでの手順。E2E テストやスクリプトからプロジェクトを作成する際の標準手順として参照する。

## 前提

| 項目 | 値 |
|------|-----|
| API | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Next.js | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Editor | `https://agreeable-river-0bfb78000.4.azurestaticapps.net` |
| Preview | `https://happy-tree-012282700.1.azurestaticapps.net` |

## Step 1: 認証（ログイン）

```
POST /api/auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

レスポンス:
```json
{ "token": "eyJ...", "user": { "id": "usr_xxx" } }
```

以降のリクエストで `Authorization: Bearer {token}` を使用する。

**注意**: `loginLimiter` は 5回/分。E2E テストでは `beforeAll` で 1 回だけログインし、`injectAuth(page)` で localStorage にトークン注入する。

## Step 2: プロジェクト新規作成

Next.js のプロジェクト一覧 (`/projects`) で「新規作成」ボタンをクリックし、モーダルにタイトルを入力して作成する。

作成後のURLからプロジェクトIDを取得:
```
/projects/{projectId}  →  projectId を保存
```

プロジェクト名には実行時刻を含めて一意にする:
```typescript
const ts = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
const title = `E2Eテスト ${ts}`;  // → "E2Eテスト 3/5 12:58"
```

## Step 3: 公式アセットをプロジェクトにインポート

### 3-1. 公式アセット一覧から素材を選択

```
GET /api/official-assets
```

レスポンスの `assets` 配列から選択する。主要フィールド:

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `id` | アセットID | `01KJJKWTH2...` |
| `kind` | 常に `image` | `image` |
| `category` | `bg` or `ch-img` | `bg` |
| `subcategory` | カテゴリ名 | `ファンタジー` |
| `url` | Blob URL | `https://kaedevnworks.blob.core...` |

**利用可能なサブカテゴリ**:

| category | subcategory |
|----------|-------------|
| bg | basic, ファンタジー, 中国短尺ドラマ |
| ch-img | 学園, ファンタジー, 三国志, シルクロード, 中国短尺ドラマ, 政治, BL |

**注意**: subcategory の日本語比較は Unicode 正規化が必要:
```typescript
a.subcategory?.normalize('NFC') === 'ファンタジー'.normalize('NFC')
```

### 3-2. プロジェクトにインポート

```
POST /api/assets/{projectId}/use-official
Authorization: Bearer {token}
Content-Type: application/json

{ "officialAssetId": "{公式アセットID}" }
```

レスポンス (201 or 200):
```json
{
  "message": "公式アセットを追加しました",
  "asset": {
    "id": "01KJY...",     // プロジェクト内アセットID（以降これを使う）
    "kind": "image",
    "category": "bg",
    "url": "https://...",
    "name": "filename.webp",
    "slug": "..."
  }
}
```

- 背景 (category=bg) → `bgAssetId` として保存
- キャラクター画像 (category=ch-img) → `chAssetId` として保存

## Step 4: キャラクタークラスを作成

キャラクター画像をインポートしただけでは「画像アセット」でしかない。エディタ・プレビューでキャラクター表示するには **ch-class**（キャラクタークラス）が必要。

```
POST /api/projects/{projectId}/character-class
Authorization: Bearer {token}
Content-Type: application/json

{
  "slug": "fantasy_hero",          // スクリプトで使うID（英数字+_）
  "name": "ファンタジー勇者",       // 表示名
  "defaultExpression": "normal",    // デフォルト表情slug
  "expressions": {
    "normal": "{chAssetId}"         // 表情slug → 画像アセットID
  }
}
```

レスポンス (201):
```json
{
  "character": {
    "id": "01KJY...",    // charClassId
    "slug": "fantasy_hero",
    "name": "ファンタジー勇者",
    ...
  }
}
```

### slug のルール
- 半角英数字とアンダースコアのみ（`/^[a-zA-Z0-9_]+$/`）
- プロジェクト内で一意
- スクリプトの `@ch {slug} {expression} {position}` で使用される

## Step 5: プロジェクトデータを保存

```
PUT /api/projects/{projectId}
Authorization: Bearer {token}
Content-Type: application/json
```

### ブロック構造

```json
{
  "title": "E2Eテスト 3/5 12:58",
  "data": {
    "pages": [
      {
        "id": "page-1",
        "name": "第1話",
        "blocks": [
          { "id": "block-start", "type": "start" },
          { "id": "bg-1709...", "type": "bg", "assetId": "{bgAssetId}" },
          {
            "id": "ch-1709...",
            "type": "ch",
            "characterId": "fantasy_hero",
            "expressionId": "normal",
            "pos": "C",
            "visible": true
          },
          {
            "id": "text-1709...",
            "type": "text",
            "body": "台詞テキスト",
            "speaker": "ファンタジー勇者"
          }
        ]
      }
    ],
    "characters": [
      {
        "id": "{charClassId}",
        "slug": "fantasy_hero",
        "name": "ファンタジー勇者",
        "defaultExpressionId": "{chAssetId}",
        "sortOrder": 0,
        "expressions": [
          {
            "id": "{chAssetId}",
            "slug": "normal",
            "name": "normal",
            "kind": "static",
            "imageAssetId": "{chAssetId}",
            "frameSetId": null,
            "imageUrl": null,
            "frameSet": null,
            "sortOrder": 0
          }
        ],
        "createdAt": 1709...,
        "updatedAt": 1709...
      }
    ]
  }
}
```

### 重要なルール

| 項目 | 説明 |
|------|------|
| ブロック ID | `{type}-{Date.now()}` で生成 |
| `start` ブロック | 各ページに 1 つ必須。削除・移動不可 |
| `ch` ブロック | `characterId` は ch-class の **slug**（ID ではない） |
| | `expressionId` は expression の **slug**（`normal` 等） |
| | `pos`: `L`(左), `C`(中央), `R`(右) |
| | `visible`: `true`(表示) / `false`(非表示=`@ch_hide`) |
| `bg` ブロック | `assetId` はプロジェクト内アセットID |
| `data.characters` | エディタ表示に必要。ch-class API とは別に保存する |

### `data.characters` を含める理由

- エディタはプロジェクトロード時に `apiProject.data.characters` からキャラクター情報を読む
- `data.characters` がないとブロックカードにキャラ名・サムネイルが表示されない
- プレビューパネル（右下）もこのデータを参照する
- ch-class API のデータは「キャラクター管理パネル」を開いたときのみ再読込される

### 生成されるスクリプト

上記のブロック構成で Preview API が返すスクリプト:
```
*start
@bg {bgAssetId}
@ch fantasy_hero normal center
台詞テキスト
@l
```

## Step 6: 確認

### Preview API
```
GET /api/preview/{projectId}
```
- `script`: KSC スクリプト（`@bg`, `@ch`, テキスト）
- `characters`: キャラクター定義（slug, expressions, imageUrl）
- `assets`: アセット一覧（id, kind, category, url）

### Preview 再生
```
{PREVIEW_URL}/ksc-demo.html?work={projectId}
```
- canvas が 1280x720 で表示される
- クリックで bg → ch → text と進行

### エディタ
```
{EDITOR_URL}/projects/editor/{projectId}?token={token}&userId={userId}
```
- ブロックカード 4 つ（start + bg + ch + text）
- 背景カードにサムネイル画像
- キャラカードにキャラ名とサムネイル
- テキストカードに台詞テキスト

## よくあるミス

| ミス | 症状 | 対策 |
|------|------|------|
| `characterId` に ch-class の ID を入れた | エディタで「未選択」表示 | **slug** を入れる |
| `expressionId` に asset ID を入れた | Preview で `@ch slug {assetId} center` | expression の **slug** を入れる |
| `data.characters` を省略 | エディタでキャラ名・画像が出ない | characters 配列を含めて保存する |
| 公式アセットの `kind` を `ch` にした | インポートではなくアップロードになる | `use-official` API を使う |
| `subcategory` の直接比較 | Unicode 正規化の差で不一致 | `.normalize('NFC')` で比較 |

## 参考テスト

`tests/azure-create-and-play.spec.ts` — 上記手順をすべて実行する 15 テストの E2E テスト。
