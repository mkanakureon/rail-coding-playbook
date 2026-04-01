# Asset管理 実装計画書

- 作成日: 2026-02-23
- ステータス: Draft
- 前提: [仕様書 v2](./09-asset-management-spec.md) / [設計書 v2](./10-asset-management-design.md) / [分類リストラクチャ](./11-asset-taxonomy-restructure-spec.md)

---

## 1. 現状整理

### 既存テーブル・エンドポイント

| 区分 | 既存 | 状態 |
|------|------|------|
| `Asset` | id, projectId, filename, slug, kind(bg/ch/bgm/se/voice/frame), blobPath, size, contentType, frameSetId, frameIndex | **変更必要** — kind 再編 + category/subcategory/metadata/sourceType 追加 |
| `OfficialAsset` | id, filename, kind, category, blobPath, size, contentType | **変更必要** — subcategory + 表示系カラム追加, kind/category 再編 |
| `Character` + `Expression` | キャラ定義 + 表情マッピング | **廃止対象** — ch-class アセットに統合 |
| `UserCharacter` + `UserExpression` | ユーザー個人のキャラ定義 | **廃止対象** — UserAsset (kind: ch-class) に統合 |
| `POST /assets/:pj/upload` | 画像/音声アップロード | **変更必要** — kind/category 新体系対応 |
| `POST /assets/:pj/use-official` | 公式 → PJ Import | **変更必要** — sourceType 設定追加 |
| `GET /official-assets` | 公式一覧 | **変更必要** — 3階層フィルター + レスポンス拡張 |
| `/api/projects/:pj/characters/*` | キャラCRUD | **廃止対象** |
| MyPage | 4タブ (PJ/アセット/キャラ/プロフィール) | **変更必要** — キャラタブ廃止, アセットタブ簡素化 |
| AssetSelectModal | 2タブ (マイ/公式) | **変更必要** — 3タブ化 |

### 未実装

| 区分 | 内容 |
|------|------|
| `UserAsset` テーブル | 新規作成 |
| `/api/user-assets/*` | マイアセット CRUD + アップロード |
| `/api/assets/:pj/import-from-library` | マイ → PJ Import |
| `/api/assets/:pj/character-class` | ch-class CRUD |
| `/my-assets` ページ | アセット管理ページ（独立） |
| manifest `characters` セクション | ch-class → 画像URL 解決 |

---

## 2. フェーズ構成

```
Phase 1  DB スキーマ変更（非破壊・追加のみ）
  ↓
Phase 2  データマイグレーション（kind 再編 + Character → ch-class 変換）
  ↓
Phase 3  新規 API（UserAsset CRUD, import-from-library, ch-class CRUD）
  ↓
Phase 4  既存 API 改修（kind/category フィルター, sourceType, レスポンス拡張）
  ↓
Phase 5  フロントエンド — /my-assets ページ新規作成
  ↓
Phase 6  エディタ統合（AssetSelectModal 3タブ化, CharacterClassPanel）
  ↓
Phase 7  manifest 統合（characters セクション追加）
  ↓
Phase 8  旧テーブル廃止（Character, Expression, UserCharacter, UserExpression DROP）
```

### 依存関係

- Phase 2 は Phase 1 の完了が必須
- Phase 3・4 は Phase 2 の完了が必須（新 kind 体系前提）
- Phase 5 は Phase 3 の完了が必須（UserAsset API が必要）
- Phase 6 は Phase 3・4 の完了が必須
- Phase 7 は Phase 3 の完了が必須（ch-class データが必要）
- Phase 8 は Phase 2〜7 の全完了 + 検証後

---

## 3. Phase 1 — DB スキーマ変更

### 目標

既存データ・機能を壊さず、新カラム・テーブルを追加する。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 1-1 | Asset テーブルに `category`, `subcategory`, `metadata`, `source_type` カラム追加 | `schema.prisma` |
| 1-2 | Asset に複合インデックス追加 (`project_id, kind`), (`project_id, kind, category`) | `schema.prisma` |
| 1-3 | `UserAsset` テーブル新規作成 | `schema.prisma` |
| 1-4 | `User` モデルに `userAssets` リレーション追加 | `schema.prisma` |
| 1-5 | `OfficialAsset` テーブルに `subcategory`, `display_name`, `description`, `thumbnail_path`, `sort_order`, `download_count`, `is_free` カラム追加 | `schema.prisma` |
| 1-6 | OfficialAsset に複合インデックス追加 (`kind, category, subcategory`) | `schema.prisma` |
| 1-7 | `prisma migrate dev` 実行・確認 | CLI |

### 検証

- [x] マイグレーション成功
- [x] 既存データ（Asset, OfficialAsset）が保全されている
- [x] 新カラムはデフォルト値で埋まっている（source_type = 'upload'）
- [x] アプリが正常起動する（既存 API がエラーにならない）

---

## 4. Phase 2 — データマイグレーション

### 目標

旧 kind 体系を新 kind/category 体系に変換。Character → ch-class アセットに変換。

### タスク

| # | タスク | 方法 |
|---|--------|------|
| 2-1 | Asset の kind 再編: `bg` → `image`/`bg`, `ch` → `image`/`ch-img`, `bgm` → `audio`/`bgm`, `se` → `audio`/`se`, `voice` → `audio`/`voice`, `frame` → `image`/`effect` | SQL UPDATE |
| 2-2 | OfficialAsset の kind/category 再編: 旧 category → subcategory に移動、新 kind/category 設定 | SQL UPDATE |
| 2-3 | Character + Expression → Asset (kind: `ch-class`) 変換スクリプト作成 | TypeScript スクリプト |
| 2-4 | UserCharacter + UserExpression → UserAsset (kind: `ch-class`) 変換スクリプト作成 | TypeScript スクリプト |
| 2-5 | 変換スクリプト実行 | CLI |

### 2-1 SQL 詳細

```sql
UPDATE "assets" SET category = 'bg',     kind = 'image' WHERE kind = 'bg';
UPDATE "assets" SET category = 'ch-img', kind = 'image' WHERE kind = 'ch';
UPDATE "assets" SET category = 'effect', kind = 'image' WHERE kind = 'frame';
UPDATE "assets" SET category = 'bgm',    kind = 'audio' WHERE kind = 'bgm';
UPDATE "assets" SET category = 'se',     kind = 'audio' WHERE kind = 'se';
UPDATE "assets" SET category = 'voice',  kind = 'audio' WHERE kind = 'voice';
```

### 2-3 変換ロジック

```typescript
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
      category: null,
      filename: '',
      blobPath: '',
      size: 0n,
      contentType: 'application/json',
      metadata: {
        name: char.name,
        defaultExpression: defaultExprSlug,
        expressions,
      },
      sourceType: 'upload',
      createdAt: char.createdAt,
    },
  });
}
```

### 検証

- [x] 全 Asset の kind が `image` / `audio` / `ch-class` のいずれかになっている
- [x] category が正しく設定されている（null の ch-class 以外は非 null）
- [x] Character の数 = 新規作成された ch-class Asset の数
- [x] slug, blobPath が変更されていない（既存参照が壊れない）
- [x] 既存 API（GET /assets/:pj）が新 kind 体系でも動作する

---

## 5. Phase 3 — 新規 API

### 目標

UserAsset CRUD、マイ → PJ Import、ch-class CRUD を追加する。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 3-1 | `user-assets.ts` ルート新規作成 | `apps/hono/src/routes/user-assets.ts` |
| 3-2 | `GET /api/user-assets` — マイアセット一覧（kind/category/subcategory フィルター） | `user-assets.ts` |
| 3-3 | `POST /api/user-assets/upload` — マイアセットにアップロード（kind + category 指定） | `user-assets.ts` |
| 3-4 | `DELETE /api/user-assets/:id` — マイアセット削除（blobPath 参照チェック） | `user-assets.ts` |
| 3-5 | `POST /api/assets/:pj/import-from-library` — マイ → PJ Import | `assets.ts` |
| 3-6 | `POST /api/assets/:pj/character-class` — ch-class 作成 | `assets.ts` |
| 3-7 | `PUT /api/assets/:pj/character-class/:slug` — ch-class 更新 | `assets.ts` |
| 3-8 | ルート登録 | `apps/hono/src/index.ts` |

### 3-5 import-from-library 仕様

```
POST /api/assets/:projectId/import-from-library
Body: { userAssetId: string }

処理:
1. UserAsset を取得（認証ユーザー所有チェック）
2. blobPath をそのまま共有（ファイルコピーしない）
3. filename から slug 自動生成（プロジェクト内ユニーク）
4. Asset 作成（sourceType: "library", kind/category を UserAsset から引き継ぎ）
```

### 3-6 ch-class 作成バリデーション

- slug: `[a-z0-9_]`、プロジェクト内ユニーク
- expressions の各 assetId: 同プロジェクトに存在し、kind=image, category=ch-img
- defaultExpression が expressions のキーに含まれる

### 検証

- [x] UserAsset アップロード → 一覧に表示
- [x] UserAsset 削除（他テーブル参照なし → blob 削除、参照あり → blob 維持）
- [x] マイ → PJ Import → Asset 作成（slug 生成、blobPath 共有）
- [x] ch-class 作成 → metadata に JSON
- [x] ch-class slug 重複 → 409
- [x] ch-class expressions に不正 assetId → 400
- [x] 認証・認可（他ユーザーの UserAsset 操作 → 403）

---

## 6. Phase 4 — 既存 API 改修

### 目標

既存エンドポイントを3階層分類に対応させる。後方互換を維持。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 4-1 | `GET /api/assets/:pj` に kind/category/subcategory クエリパラメータ追加 | `assets.ts` |
| 4-2 | `POST /api/assets/:pj/upload` の kind を新体系に対応（`image`/`audio` + category 必須化） | `assets.ts` |
| 4-3 | `POST /api/assets/:pj/use-official` に `sourceType: "official"` 設定追加 | `assets.ts` |
| 4-4 | `GET /api/official-assets` を kind/category/subcategory フィルター対応 | `official-assets.ts` |
| 4-5 | `GET /api/official-assets/categories` を kind + category ベースに変更 | `official-assets.ts` |
| 4-6 | `DELETE /api/assets/:pj/:id` の blobPath 参照チェックに UserAsset 追加 | `assets.ts` |
| 4-7 | `GET /api/official-assets` レスポンスに displayName, description, subcategory 追加 | `official-assets.ts` |

### 4-2 後方互換

エディタからのアップロードは現在 kind = `"bg"` / `"ch"` 等で送信している。
移行期間中は旧 kind も受け付けて内部変換する:

```typescript
// 後方互換マッピング
const kindMap: Record<string, { kind: string; category: string }> = {
  bg:    { kind: 'image', category: 'bg' },
  ch:    { kind: 'image', category: 'ch-img' },
  bgm:   { kind: 'audio', category: 'bgm' },
  se:    { kind: 'audio', category: 'se' },
  voice: { kind: 'audio', category: 'voice' },
};
```

### 検証

- [x] `GET /assets/:pj?kind=image` → image のみ返却
- [x] `GET /assets/:pj?kind=image&category=bg` → image/bg のみ
- [x] 旧 kind (`bg`) でのアップロード → 内部変換され image/bg として保存
- [x] 新 kind (`image` + category `bg`) でのアップロード → 正常
- [x] use-official → sourceType が `"official"` に設定される
- [x] Asset 削除時、同 blobPath の UserAsset があれば blob は残る
- [x] official-assets レスポンスに新フィールド含む

---

## 7. Phase 5 — /my-assets ページ

### 目標

MyPage から独立したアセット管理ページを作成する。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 5-1 | `/my-assets` ページ新規作成（レイアウト + 2タブ: 公式/マイ） | `apps/next/app/(private)/my-assets/page.tsx` |
| 5-2 | 3階層フィルターコンポーネント（KindFilter → CategoryFilter → SubcategoryFilter） | 同上 or コンポーネント分割 |
| 5-3 | 公式アセットタブ: グリッド表示 + 「プロジェクトに追加」ボタン + PJ 選択ドロップダウン | 同上 |
| 5-4 | マイアセットタブ: アップロード機能 + グリッド表示 + 削除 + 「プロジェクトに追加」 | 同上 |
| 5-5 | API クライアント関数追加（getUserAssets, uploadUserAsset, deleteUserAsset, importFromLibrary） | `apps/next/lib/api.ts` |
| 5-6 | 型定義追加（UserAssetItem, CharacterClassMetadata） | `apps/next/lib/api.ts` |
| 5-7 | ナビゲーションに `/my-assets` リンク追加 | レイアウト or ナビコンポーネント |
| 5-8 | MyPage の「アセット」タブ簡素化（PJアセット横断一覧に限定）、「キャラクター」タブ廃止 | `mypage/page.tsx` |

### コンポーネント構造

```
MyAssetsPage
├── PageHeader
├── TabBar [公式アセット | マイアセット]
│
├── (共通) AssetFilterBar
│   ├── KindFilter   [すべて] [画像] [音声] [キャラクラス]
│   ├── CategoryFilter  (kind 依存で動的表示)
│   └── SubcategoryFilter (category 依存で動的表示)
│
├── (公式タブ)
│   └── AssetGrid
│       └── OfficialAssetCard
│           ├── サムネイル + 名前 + kind/category バッジ
│           └── 「プロジェクトに追加」→ PJ選択ドロップダウン
│
└── (マイタブ)
    ├── UploadButton (kind + category 選択 → ファイル選択)
    └── AssetGrid
        └── UserAssetCard
            ├── サムネイル + 名前 + kind/category バッジ
            ├── 削除ボタン
            └── 「プロジェクトに追加」→ PJ選択ドロップダウン
```

### 検証

- [x] 公式タブ: 3階層フィルターで絞り込み可能
- [x] 公式タブ: 「プロジェクトに追加」→ PJ 選択 → Import 成功
- [x] マイタブ: アップロード（kind + category 指定）→ 一覧表示
- [x] マイタブ: 削除 → 一覧から消える
- [x] マイタブ: 「プロジェクトに追加」→ Import 成功
- [x] ナビゲーションからアクセス可能

---

## 8. Phase 6 — エディタ統合

### 目標

エディタの AssetSelectModal を3タブ化。CharacterPanel を ch-class ベースに変更。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 6-1 | AssetSelectModal を3タブ化: [プロジェクト] [公式] [マイライブラリ] | `AssetSelectModal.tsx` |
| 6-2 | マイライブラリタブ: UserAsset 一覧 + 選択時 import-from-library 実行 | `AssetSelectModal.tsx` |
| 6-3 | 公式タブ: kind/category/subcategory フィルター対応 | `AssetSelectModal.tsx` |
| 6-4 | CharacterPanel → CharacterClassPanel に変更 | `CharacterPanel.tsx` |
| 6-5 | ch-class 一覧: `GET /assets/:pj?kind=ch-class` | `CharacterClassPanel.tsx` |
| 6-6 | ch-class 新規作成: slug + name + 表情追加 UI | `CharacterClassPanel.tsx` |
| 6-7 | ch-class 編集: 表情の追加・削除・画像変更 | `CharacterClassPanel.tsx` |
| 6-8 | 表情の画像選択に AssetSelectModal (kind=image, category=ch-img) を使用 | `CharacterClassPanel.tsx` |

### 検証

- [x] AssetSelectModal の3タブが機能する
- [x] マイライブラリから選択 → Import → プロジェクトアセットとして使用可能
- [x] ch-class 作成 → スクリプトで `[show ch="slug"]` が機能
- [x] ch-class 編集 → 表情追加・変更が反映される

---

## 9. Phase 7 — manifest 統合

### 目標

manifest に `characters` セクションを追加し、ch-class → 画像URL の2段階解決を実現する。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| 7-1 | manifest 生成に characters セクション追加 | `apps/hono/src/routes/projects.ts` or manifest 生成箇所 |
| 7-2 | WebEngine で characters セクション対応 | `packages/web/src/engine/WebEngine.ts` |
| 7-3 | `[show ch="slug" face="expr"]` の解決: manifest.characters → expressions → manifest.assets → URL | エンジン内部 |

### manifest 形式

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

### 検証

- [x] manifest に assets + characters の2セクションが出力される
- [x] `[show ch="hero" face="smile"]` → hero_smile の画像が表示される
- [x] face 省略時 → defaultExpression の画像が表示される

---

## 10. Phase 8 — 旧テーブル廃止

### 目標

全フェーズ完了・検証後に旧テーブルを DROP する。

### 前提条件

- Phase 2〜7 が全て完了
- 既存のキャラクター操作が ch-class ベースで動作確認済み
- エンジン（Web + Switch）で ch-class 解決が動作確認済み

### タスク

| # | タスク |
|---|--------|
| 8-1 | Character テーブル DROP |
| 8-2 | Expression テーブル DROP |
| 8-3 | UserCharacter テーブル DROP |
| 8-4 | UserExpression テーブル DROP |
| 8-5 | `apps/hono/src/routes/characters.ts` ルート削除 |
| 8-6 | `apps/next/lib/api.ts` から Character/Expression 関連型・関数削除 |
| 8-7 | エディタから旧 CharacterPanel 参照削除 |
| 8-8 | `/api/my-characters/*` エンドポイント削除 |

### 検証

- [x] 旧エンドポイントが 404 を返す
- [x] 新エンドポイント（ch-class）が正常動作
- [x] エディタ・MyPage から旧キャラ操作 UI が消えている
- [x] prisma migrate が正常完了

---

## 11. 修正対象ファイル一覧

| # | ファイル | Phase | 種別 | 変更内容 |
|---|---------|-------|------|---------|
| 1 | `apps/hono/prisma/schema.prisma` | 1, 8 | 変更 | UserAsset 追加, Asset/OfficialAsset 拡張, 旧テーブル削除 |
| 2 | マイグレーションスクリプト | 2 | **新規** | kind 変換 + Character → ch-class 変換 |
| 3 | `apps/hono/src/routes/user-assets.ts` | 3 | **新規** | UserAsset CRUD + upload |
| 4 | `apps/hono/src/routes/assets.ts` | 3, 4 | 変更 | import-from-library, ch-class CRUD, kind/category フィルター |
| 5 | `apps/hono/src/routes/official-assets.ts` | 4 | 変更 | 3階層フィルター, レスポンス拡張 |
| 6 | `apps/hono/src/index.ts` | 3 | 変更 | user-assets ルート登録 |
| 7 | `apps/next/app/(private)/my-assets/page.tsx` | 5 | **新規** | アセット管理ページ |
| 8 | `apps/next/lib/api.ts` | 5, 8 | 変更 | UserAsset 型 + API 関数追加, 旧型削除 |
| 9 | ナビゲーションコンポーネント | 5 | 変更 | `/my-assets` リンク追加 |
| 10 | `apps/next/app/(private)/mypage/page.tsx` | 5 | 変更 | キャラタブ廃止, アセットタブ簡素化 |
| 11 | `apps/editor/src/components/AssetSelectModal.tsx` | 6 | 変更 | 3タブ化 |
| 12 | `apps/editor/src/components/CharacterPanel.tsx` | 6 | 変更 | ch-class ベースに書き換え |
| 13 | `packages/web/src/engine/WebEngine.ts` | 7 | 変更 | manifest characters セクション対応 |
| 14 | `apps/hono/src/routes/projects.ts` | 7 | 変更 | manifest 生成に characters 追加 |
| 15 | `apps/hono/src/routes/characters.ts` | 8 | 削除 | 旧キャラルート廃止 |

---

## 12. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| kind 変換で既存スクリプト参照が壊れる | エンジンが bg/ch 等で検索して見つからない | Phase 2 の検証で slug/blobPath 保全を確認。エンジンは slug ベースなので kind 変更の影響なし |
| blobPath 共有での誤削除 | Import 元の素材が消える | 3テーブル（Asset/UserAsset/OfficialAsset）の参照チェック関数を実装 |
| Character → ch-class 変換漏れ | 一部キャラが表示されない | 変換前後の件数比較 + slug 一覧の diff で検証 |
| エディタとの後方互換 | 旧 kind でのアップロードが失敗 | Phase 4 で旧 kind → 新 kind の内部変換マップを維持 |
| Phase 8（旧テーブル DROP）のタイミング | ロールバック不能 | 全フェーズ完了後、十分な検証期間を置いてから実行 |

---

## 13. 実装順序のまとめ

```
[Phase 1] schema.prisma 変更 + migrate
    ↓
[Phase 2] SQL + スクリプトで既存データ変換
    ↓
[Phase 3] user-assets.ts 新規, assets.ts に ch-class/import 追加
    ↓  同時並行可 ↓
[Phase 4] assets.ts, official-assets.ts 改修
    ↓
[Phase 5] /my-assets ページ + api.ts 型追加
    ↓  同時並行可 ↓
[Phase 6] AssetSelectModal 3タブ化 + CharacterClassPanel
    ↓
[Phase 7] manifest characters セクション + WebEngine 対応
    ↓
[Phase 8] 旧テーブル DROP（検証期間後）
```
