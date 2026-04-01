# azure-create-and-play.spec.ts テスト仕様書

## 概要

プロジェクト新規作成から再生・エディタ確認までの E2E テスト。公式アセット（ファンタジー）を使用してプロジェクトを構築し、全レイヤーで正常動作を検証する。

- **ファイル**: `tests/azure-create-and-play.spec.ts`
- **テスト数**: 15
- **実行時間**: 約 57 秒
- **実行方法**: `npx playwright test tests/azure-create-and-play.spec.ts --config=playwright.azure.config.ts`

## テスト対象サービス

| サービス | URL | 役割 |
|---------|-----|------|
| API (Hono) | `ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` | 認証、アセット、プロジェクト管理 |
| Next.js | `ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` | マイページ、プロジェクト一覧/詳細 |
| Editor (SWA) | `agreeable-river-0bfb78000.4.azurestaticapps.net` | ブロック編集画面 |
| Preview (SWA) | `happy-tree-012282700.1.azurestaticapps.net` | KSC エンジンによる再生 |

## テスト一覧

### Phase 1: 公式アセット取得

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 01 | 公式アセットからファンタジー背景・キャラクターIDを取得 | API | `GET /api/official-assets` からファンタジーの bg, ch-img を各1つ選択 |

### Phase 2: プロジェクト新規作成

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 02 | マイページを開いて新規作成ボタンが見える | UI | `/mypage` で「新規作成」ボタン表示 |
| 03 | 新規作成 → プロジェクト詳細ページに遷移 | UI | モーダル入力 → `/projects/{id}` に遷移、projectId 取得 |

### Phase 3: 公式アセットインポート + キャラクタークラス作成

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 04 | 公式背景アセットをインポート | API | `POST /api/assets/{pid}/use-official` → 201, bgAssetId 取得 |
| 05 | 公式キャラクターアセットをインポート | API | `POST /api/assets/{pid}/use-official` → 201, chAssetId 取得 |
| 06 | キャラクタークラスを作成 | API | `POST /api/projects/{pid}/character-class` → 201, slug=`fantasy_hero` |

### Phase 4: プロジェクトデータ保存

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 07 | プロジェクトに bg + ch + text ブロックを保存 | API | `PUT /api/projects/{pid}` → 200, 4ブロック（start+bg+ch+text）+ characters |

### Phase 5: Preview API 検証

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 08 | Preview API がスクリプトを返す | API | `@bg`, `@ch fantasy_hero normal center`, テキスト, characters 配列 |

### Phase 6: Preview 再生

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 09 | Preview で canvas が表示される | UI | canvas 要素の表示、サイズ 1280x720 |
| 10 | Preview でクリック進行してもクラッシュしない | UI | 3回クリックして進行、canvas が壊れない |

### Phase 7: エディタ検証

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 11 | エディタでブロック一覧が表示される | UI | `.block-card` が 4 つ以上 |
| 12 | 背景ブロックにサムネイルが表示される | UI | 「背景」バッジのカード内に `<img>` が存在 |
| 13 | キャラブロックにサムネイルが表示される | UI | 「キャラ」バッジのカードに「ファンタジー勇者」と `<img>` |
| 14 | テキストブロックの台詞が表示される | UI | 「テキスト」バッジのカードに台詞テキスト |

### Phase 8: プロジェクト詳細

| # | テスト名 | 種別 | 検証内容 |
|---|---------|------|---------|
| 15 | プロジェクト詳細ページにタイトルとボタンが表示される | UI | タイトル、「エディタで編集」「プレビュー」ボタン |

## データフロー

```
公式アセット (official_assets テーブル)
  ├── BG: category=bg, subcategory=ファンタジー
  └── CH: category=ch-img, subcategory=ファンタジー
       │
       ▼ use-official API
プロジェクトアセット (assets テーブル)
  ├── bgAssetId (sourceType=official)
  └── chAssetId (sourceType=official)
       │
       ▼ character-class API
キャラクタークラス (assets テーブル, kind=ch-class)
  └── slug=fantasy_hero, expressions={normal: chAssetId}
       │
       ▼ PUT /api/projects/{id}
プロジェクトデータ (projects.data JSON)
  ├── pages[0].blocks
  │   ├── start
  │   ├── bg (assetId=bgAssetId)
  │   ├── ch (characterId=slug, expressionId=slug, visible=true)
  │   └── text (body, speaker)
  └── characters[] ← エディタ表示用
       │
       ▼ GET /api/preview/{id}
KSC スクリプト
  ├── @bg {bgAssetId}
  ├── @ch fantasy_hero normal center
  └── テキスト\n@l
```

## 認証パターン

- **API 呼び出し**: `beforeAll` で 1 回だけ `POST /api/auth/login` → `authToken` 取得
- **ブラウザ**: `injectAuth(page)` で `/login` にアクセス後、`localStorage` に `authToken` / `currentUserId` をセット
- **loginLimiter (5/min)** を消費しないため、フォームログインは使わない
- **エディタ**: URL パラメータで `?token={token}&userId={userId}` を渡す

## スクリーンショット

テスト実行時に `test-results/` に保存される:

| ファイル | 内容 |
|---------|------|
| `create-play-02-mypage.png` | マイページ |
| `create-play-03-detail.png` | 新規作成後の詳細 |
| `create-play-09-preview.png` | Preview canvas |
| `create-play-10-after-click.png` | クリック後の Preview |
| `create-play-11-editor.png` | エディタ全体 |
| `create-play-12-bg-block.png` | 背景ブロック |
| `create-play-13-ch-block.png` | キャラブロック |
| `create-play-14-text-block.png` | テキストブロック |
| `create-play-15-detail.png` | プロジェクト詳細 |

## 設計上の注意点

### プロジェクトは削除しない

テスト完了後もプロジェクトを残す。手動で確認できるようにするため。プロジェクト名にタイムスタンプ（`E2Eテスト 3/5 12:58`）を含めて識別する。

### `data.characters` の必要性

ch-class API でキャラクタークラスを作成しても、エディタは **`data.characters`** からキャラクター情報を読み込む。`PUT /api/projects` でプロジェクトデータを保存する際に `characters` 配列を含めないと、エディタのブロックカードにキャラ名・サムネイルが表示されない。

### ch ブロックの characterId / expressionId

- `characterId`: ch-class の **slug**（`fantasy_hero`）。ID ではない
- `expressionId`: expression の **slug**（`normal`）。asset ID ではない
- Preview API (`generateKSCScript`) は `charIdToSlug` マップで ID→slug 変換するので asset ID でも動くが、エディタは slug で直接 `characters.find(c => c.slug === block.characterId)` するため slug が正しい

### Unicode 正規化

公式アセットの `subcategory`（`ファンタジー` 等）は API レスポンスと TypeScript ソースで Unicode 正規化形式が異なる場合がある。`.normalize('NFC')` で比較する。
