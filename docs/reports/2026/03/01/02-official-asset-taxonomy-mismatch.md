# 公式アセット テーブルの taxonomy 不整合

**日付**: 2026-03-01
**症状**: 管理画面 `/admin/assets` で画像が表示されない

---

## 原因: 2つの taxonomy（分類体系）が混在

`official_assets` テーブルに対して、作成元によって異なる `kind`/`category` の使い方をしていた。

### Taxonomy A: Admin 一括アップロード（本番環境のデータ）

`admin.ts` の `POST /api/admin/official-assets/upload`

```
kind = 用途 (bg / ch / bgm)
category = サブフォルダ名 (ファンタジー, 学園, BL, ...)
```

```sql
-- 本番 DB
 kind | category       | count
------+----------------+-------
 bg   | ファンタジー   |    40
 ch   | ファンタジー   |    68
 ch   | 学園           |    65
```

### Taxonomy B: ゲスト作成コード（ローカルのデータ）

`auth.ts` の `POST /api/auth/guest` 内で公式アセットを検索する際に使用

```
kind = メディア種別 (image / audio)
category = 用途 (bg / ch-img)
```

```sql
-- ローカル DB (修正前)
 kind  | category | count
-------+----------+-------
 image | bg       |     1
 image | ch-img   |   267
```

### 不整合の影響

| コード | 検索条件 | 本番で動く？ | ローカル(旧)で動く？ |
|--------|----------|:---:|:---:|
| `auth.ts` ゲスト作成 | `kind='image', category='bg'` | NG (0件) | OK |
| `admin/assets` ページ `isImageKind()` | `kind === 'bg' \|\| kind === 'ch'` | OK | NG (image) |
| `admin/assets` タブフィルタ | `kind='bg'` | OK | NG (image) |
| `official-assets.ts` 公式API | `kind` パラメータ | 条件次第 | 条件次第 |

## 根本原因

**同じテーブルに対して、2つの分類体系が設計ドキュメントなしに混在した。**

- `assets` テーブル（プロジェクト単位）は `kind=image/audio` + `category=bg/ch-img` の「メディア種別」方式
- Admin アップロードは `kind=bg/ch/bgm` の「用途」方式で `official_assets` に挿入
- `auth.ts` は `assets` テーブルと同じ方式で `official_assets` を検索
- 誰が正しいか定義されていなかったため、書いたコードごとに違う方式を使っていた

## 修正内容

### 方針: Admin アップロード方式（用途ベース）に統一

理由: 本番データが既にこの形式で数百件存在し、サブカテゴリーも活用されているため。

### 実施した修正

| 対象 | 修正 |
|------|------|
| ローカル DB | `kind='image'` → `kind='bg'`/`'ch'` に UPDATE |
| `auth.ts:489-494` | `kind: 'image', category: 'bg'` → `kind: 'bg'` |
| `admin/assets/page.tsx` `isImageKind()` | `'image'` を追加（防御的対応） |

### 未対応（今後の課題）

| 対象 | 状態 |
|------|------|
| `official-assets.ts` 公式API | テストが `kind=image` で検索 → 要更新 |
| `AssetSelectModal.tsx` | `kindMap` が `image`/`audio` を使用 |
| E2E テスト | `kind='image'` を期待 → 要更新 |

## 教訓

- **テーブルの分類体系（taxonomy）は最初に定義してドキュメント化する**
- 同じテーブルに複数のコードパスから挿入する場合、enum 制約や CHECK 制約で値を制限する
- 本番とローカルで異なるデータ投入方法を使うと、スキーマ上は同じでもデータの意味が異なる
