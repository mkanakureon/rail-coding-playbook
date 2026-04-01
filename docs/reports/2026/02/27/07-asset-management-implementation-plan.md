# アセット管理 実装計画書 v3

- 作成日: 2026-02-27
- ステータス: Ready
- 前提: [仕様書 v2](../../02/23/09-asset-management-spec.md) / [設計書 v2](../../02/23/10-asset-management-design.md) / [実装計画 v2](../../02/23/12-asset-management-plan.md)

---

## 1. 現状ステータス

v2 計画書 (2026-02-23) の 8 フェーズに対する進捗:

| Phase | 内容 | 状態 | 備考 |
|-------|------|------|------|
| 1 | DB スキーマ変更 | **完了** | Asset/UserAsset/OfficialAsset 全カラム追加済み |
| 2 | データマイグレーション | **未実行** | スクリプト作成済み、本番未適用 |
| 3 | 新規 API | **完了** | user-assets CRUD, import-from-library, ch-class CRUD |
| 4 | 既存 API 改修 | **完了** | kind/category フィルター、後方互換マッピング |
| 5 | /my-assets ページ | **完了** | 2タブ (公式/マイ)、3階層フィルター、Upload/Import |
| 6 | エディタ統合 | **部分完了** | AssetSelectModal 3タブ化済み、CharacterPanel 未変更 |
| 7 | manifest 統合 | **部分完了** | API 側 characters セクション生成済み、エンジン側未対応 |
| 8 | 旧テーブル廃止 | **未着手** | Phase 2〜7 完了後 |

### 完了済み (着手不要)

- `schema.prisma`: Asset/UserAsset/OfficialAsset 全カラム・テーブル・インデックス
- `user-assets.ts`: GET/POST/DELETE 全エンドポイント
- `assets.ts`: import-from-library, ch-class CRUD, kind/category フィルター, 後方互換
- `official-assets.ts`: kind/category/subcategory フィルター
- `/my-assets` ページ: 公式/マイタブ、3階層フィルター、Upload/Import
- `AssetSelectModal.tsx`: 3タブ (プロジェクト/公式/マイライブラリ)
- MyPage: キャラクタータブ廃止済み
- ナビゲーション: `/my-assets` リンク追加済み
- manifest API: `assets` + `characters` セクション生成済み

---

## 2. 残タスク一覧

残り **5 タスク**。以下の順で実施する。

```
[A] データマイグレーション実行 (Phase 2)
  ↓
[B] CharacterPanel → CharacterClassPanel 変換 (Phase 6)
  ↓
[C] エンジン manifest.characters 対応 (Phase 7)
  ↓
[D] 一気通貫テスト (Phase 2-7 検証)
  ↓
[E] 旧テーブル廃止 (Phase 8) — 検証期間後
```

---

## 3. タスク A — データマイグレーション実行

### 目標

既存 DB データを新 kind/category 体系に変換 + Character → ch-class 変換。

### 前提

スクリプトは作成済み:
- `apps/hono/src/scripts/migrate-asset-taxonomy.ts`

### 手順

| # | 手順 | コマンド |
|---|------|---------|
| A-1 | ローカル DB でスクリプト実行 | `npx tsx apps/hono/src/scripts/migrate-asset-taxonomy.ts` |
| A-2 | 変換結果を検証 | 下記 SQL で件数確認 |
| A-3 | 本番 DB にスクリプト実行 | Azure Container 経由 |

### A-2 検証 SQL

```sql
-- kind 変換の確認
SELECT kind, category, COUNT(*) FROM assets GROUP BY kind, category;
-- 期待: image/bg, image/ch-img, audio/bgm, audio/se, audio/voice, ch-class/null

-- ch-class 変換の確認
SELECT COUNT(*) FROM assets WHERE kind = 'ch-class';
-- 期待: Character テーブルの件数と一致

-- 旧 kind が残っていないか
SELECT COUNT(*) FROM assets WHERE kind IN ('bg', 'ch', 'bgm', 'se', 'voice', 'frame');
-- 期待: 0

-- OfficialAsset の変換確認
SELECT kind, category, COUNT(*) FROM official_assets GROUP BY kind, category;
-- 期待: image/bg, image/ch-img, audio/bgm
```

### リスク

| リスク | 対策 |
|--------|------|
| slug/blobPath が変わってエンジンが壊れる | スクリプトは kind/category のみ変更。slug/blobPath は不変 |
| Character → ch-class 変換漏れ | 変換前後の COUNT 比較で検証 |
| ロールバック不能 | ローカルで先行実行して検証。本番は pg_dump でバックアップ後に実行 |

---

## 4. タスク B — CharacterPanel → CharacterClassPanel 変換

### 目標

エディタの CharacterPanel を ch-class アセットベースに書き換える。

### 現状

`apps/editor/src/components/panels/CharacterPanel.tsx` が旧 API (`/api/projects/:id/characters`) を使用。

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| B-1 | CharacterPanel のデータソースを変更: `GET /api/assets/:pj?kind=ch-class` | `CharacterPanel.tsx` |
| B-2 | 新規作成を ch-class API に変更: `POST /api/assets/:pj/character-class` | `CharacterPanel.tsx` |
| B-3 | 編集を ch-class API に変更: `PUT /api/assets/:pj/character-class/:slug` | `CharacterPanel.tsx` |
| B-4 | 表情の画像選択に AssetSelectModal (kind=image, category=ch-img) を使用 | `CharacterPanel.tsx` |
| B-5 | 削除を Asset 削除 API に変更: `DELETE /api/assets/:pj/:id` | `CharacterPanel.tsx` |
| B-6 | CharacterEditModal も同様に ch-class 対応 | `CharacterEditModal.tsx` |

### データ構造の変化

```
【旧】
Character {
  id, slug, name, defaultExpressionId
  expressions: Expression[] { id, slug, imageAssetId }
}

【新】
Asset (kind: ch-class) {
  id, slug, kind: "ch-class"
  metadata: {
    name: string,
    defaultExpression: string,       // slug ベース（ID ではない）
    expressions: Record<string, string>  // 表情slug → 画像アセットID
  }
}
```

### 検証

- [ ] ch-class 一覧が CharacterPanel に表示される
- [ ] 新規作成 → ch-class Asset が作成される
- [ ] 表情追加 → AssetSelectModal で画像選択 → metadata に反映
- [ ] 表情削除 → metadata から削除
- [ ] ch-class 削除 → Asset から削除
- [ ] 旧 Character API を呼んでいないこと (Network タブで確認)

---

## 5. タスク C — エンジン manifest.characters 対応

### 目標

KSC / KS スクリプトの `showChar("hero", "smile", ...)` でキャラ画像を manifest から解決する。

### 現状

- manifest API は `characters` セクションを出力済み
- エンジン側 (WebEngine / KscHostAdapter) は manifest.characters を読まない

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| C-1 | manifest 読み込み時に characters セクションをパース・保持 | `packages/web/src/engine/WebEngine.ts` or マニフェストローダー |
| C-2 | `chSet(name, pose, pos, fadeMs)` で name → characters[name] → expressions[pose] → assets[slug] → URL を解決 | レンダリング層 |
| C-3 | pose 省略時に defaultExpression を使用 | 同上 |
| C-4 | manifest.characters が存在しない場合は従来どおり slug 直接参照にフォールバック | 同上 |

### 解決フロー

```
chSet("hero", "smile", "center")
  1. manifest.characters["hero"] → { defaultExpression: "normal", expressions: { "smile": "hero_smile" } }
  2. expressions["smile"] → "hero_smile"
  3. manifest.assets["hero_smile"] → "https://storage.../image/ch-img/xyz789.webp"
  4. URL を PixiJS に渡して描画
```

### 検証

- [ ] manifest に characters セクションがあるプロジェクトでキャラ表示が動作する
- [ ] characters セクションがないプロジェクト（旧データ）でもフォールバックで動作する
- [ ] defaultExpression が正しく使われる

---

## 6. タスク D — 一気通貫テスト

### 目標

Phase 2〜7 の全機能が連携動作することを確認。

### テストシナリオ

| # | シナリオ | 手順 | 期待結果 |
|---|---------|------|---------|
| D-1 | 背景アップロード → PJ Import → エンジン表示 | マイアセットにアップロード → PJ に Import → KSC で `setBg("slug")` | 背景が表示される |
| D-2 | キャラ画像 → ch-class 作成 → エンジン表示 | ch-img アップロード → ch-class 作成 → KSC で `showChar("hero", "smile")` | キャラが表示される |
| D-3 | 公式 Import → PJ 一覧 | 公式アセット → PJ に追加 → PJ アセット一覧確認 | kind/category が正しい |
| D-4 | マイ → 複数 PJ Import | 同じマイアセットを PJ-A, PJ-B に Import | 両 PJ に独立した slug |
| D-5 | PJ アセット削除 → マイ残存 | PJ アセット削除 → マイアセット一覧確認 | UserAsset は残る |
| D-6 | エディタ AssetSelectModal 3タブ | プロジェクト/公式/マイライブラリ切り替え | 各タブで正しく表示・選択・Import |
| D-7 | manifest 一気通貫 | ch-class 作成 → プレビュー → characters セクション確認 | assets + characters 両方出力 |

---

## 7. タスク E — 旧テーブル廃止

### 前提条件

- タスク A〜D が全て完了
- 本番で 1 週間以上の検証期間
- 旧 Character API を呼んでいるクライアントがゼロであること

### タスク

| # | タスク | ファイル |
|---|--------|---------|
| E-1 | `characters.ts` ルート削除 | `apps/hono/src/routes/characters.ts` |
| E-2 | `my-characters` エンドポイント削除 | `apps/hono/src/routes/` |
| E-3 | ルート登録解除 | `apps/hono/src/index.ts` |
| E-4 | Character / Expression モデル DROP | `schema.prisma` + `prisma migrate dev` |
| E-5 | UserCharacter / UserExpression モデル DROP | `schema.prisma` + `prisma migrate dev` |
| E-6 | api.ts から Character/Expression 関連型・関数を削除 | `apps/next/lib/api.ts` |
| E-7 | エディタから旧 Character 参照の残骸を削除 | `apps/editor/src/` |

### 検証

- [ ] 旧エンドポイント `/api/projects/:pj/characters` が 404
- [ ] 新エンドポイント ch-class が正常動作
- [ ] `prisma migrate` 成功
- [ ] アプリ全体が正常起動

---

## 8. 修正対象ファイル一覧

| # | ファイル | タスク | 種別 | 変更内容 |
|---|---------|-------|------|---------|
| 1 | (本番 DB) | A | 実行 | `migrate-asset-taxonomy.ts` 実行 |
| 2 | `apps/editor/src/components/panels/CharacterPanel.tsx` | B | 変更 | ch-class API ベースに書き換え |
| 3 | `apps/editor/src/components/CharacterEditModal.tsx` | B | 変更 | ch-class metadata 形式に対応 |
| 4 | `packages/web/src/engine/` (該当ファイル) | C | 変更 | manifest.characters 読み込み + 2段階解決 |
| 5 | `apps/hono/src/routes/characters.ts` | E | 削除 | 旧キャラルート廃止 |
| 6 | `apps/hono/prisma/schema.prisma` | E | 変更 | Character/Expression/UserCharacter/UserExpression DROP |
| 7 | `apps/next/lib/api.ts` | E | 変更 | 旧 Character 型・関数削除 |
| 8 | `apps/hono/src/index.ts` | E | 変更 | 旧ルート登録解除 |

---

## 9. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| マイグレーション実行で既存データ破損 | エンジン・エディタが動作不能 | ローカル先行実行 + 本番 pg_dump バックアップ |
| CharacterPanel 書き換えで編集不能 | エディタでキャラ管理不能 | 旧 API は残したまま新 UI を先にリリース。切り替え確認後に旧 API 廃止 |
| manifest.characters 未対応のまま ch-class 運用 | キャラが表示されない | フォールバック: characters セクションなしなら slug 直接参照 |
| 旧テーブル DROP 後のロールバック不能 | 完全なデータ喪失 | Phase 8 は全タスク完了 + 1週間検証後。DROP 前に全データ export |

---

## 10. 実行順序まとめ

```
[A] データマイグレーション実行
│   ├── ローカル実行 + 検証 SQL
│   └── 本番実行 (pg_dump → スクリプト実行 → 検証)
│
├──→ [B] CharacterPanel → ch-class 変換 (エディタ)
│         └── CharacterEditModal 書き換え
│
├──→ [C] エンジン manifest.characters 対応
│         └── chSet 解決ロジック + フォールバック
│
└──→ [D] 一気通貫テスト (7 シナリオ)
          │
          └── 検証期間 (1週間)
                │
                └── [E] 旧テーブル廃止
```

A は B・C の前提。B と C は並行可能。D は B・C 完了後。E は D 完了 + 検証期間後。
