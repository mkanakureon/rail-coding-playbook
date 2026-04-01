# editor-json → ブロックエディタ インポート検討資料

**日付**: 2026-03-11
**対象**: `projects/fantasy_generated/output/20260311_161005/editor-json/`

---

## 1. 生成データの概要

| 項目 | 値 |
|------|-----|
| ページ数 | 15（5章 × 3話） |
| キャラクター | 3体（ルカ, ヨルダ, 勇者） |
| 背景依存 | 3種（bg_field, bg_forest, bg_indoor） |
| ブロック数/ページ | 約30〜50 |

### ストーリー構成（5章）

1. 枯れた泉と旅立ち（起）
2. 毒霧の森と番人（承1）
3. 涸れ谷の交渉（承2）
4. 大樹の病巣と過去の罪（転）
5. 再生の儀式とそれぞれの夜明け（結）

---

## 2. 現状のギャップ分析

### 2-1. assetId が仮参照（致命的）

**現状**: bg ブロックの `assetId` が `$bg:dried_spring` のようなプレースホルダー

```json
{ "id": "bg-2", "type": "bg", "assetId": "$bg:dried_spring" }
```

**必要**: プロジェクトにインポートされた実在アセットの ID（slug）

**manifest.json の bgDependencies**:
| slug | officialAssetId | 実際の画像 |
|------|----------------|-----------|
| bg_field | 01KJK93SXJDZA4TNZGGDDRHPWZ | 草原 |
| bg_forest | 01KJK93TF5NXWEMS2619Q0N73Y | 森 |
| bg_indoor | 01KJK93TRCCGFJH9ABGKKF30X2 | 室内 |

**問題**: page-001 だけで `$bg:dried_spring`, `$bg:luca_hut_night`, `$bg:elder_house_morning` の 3 種類を使っているが、manifest には 3 種の汎用背景しかない。全15ページの背景バリエーションを 3 枚にマッピングする必要がある。

### 2-2. キャラクター不一致

**characters.json に定義**: luca, yolda, fantasy_hero（各 normal 表情のみ）

**page-001 で使用**: luca, **elder**（未定義）

→ `elder` が characters.json に存在しない。他のページにも未定義キャラが出る可能性あり。

### 2-3. 表情（expressionId）が存在しない

characters.json では `normal` 表情しか定義されていないが、ブロック内では多数の表情を使用:

```
surprised, thinking, determined, worried, anxious, serious, calm, ...
```

→ 全て `normal` にフォールバックするか、表情を追加定義する必要がある。

### 2-4. 非標準プロパティ

エディタが認識しないプロパティが含まれている:

| ブロック型 | 非標準プロパティ | 処理方針 |
|-----------|----------------|---------|
| bg | `timeContext`, `weather`, `cameraAngle` | 除去（メタ情報として別途保存可） |
| ch | `emotionDetail`, `action` | 除去 |
| text | `isThought`, `emotion`, `tone`, `wait` | 除去（`wait` は将来対応候補） |

→ エディタ API は未知プロパティを無視するため、**そのまま送っても壊れないが、余分なデータが残る**。

### 2-5. ブロック ID の一意性

現状 `start-1`, `bg-2`, `text-3` のような連番。15ページ間で衝突する可能性あり。

→ インポート時に `{type}-{Date.now()}-{連番}` で再採番すべき。

---

## 3. インポート方針（2案）

### 案A: 最小変換（3背景 + 3キャラ、表情 normal 固定）

手持ちの公式アセット 3 背景 + 3 キャラ（各 normal のみ）でそのまま流し込む。

**変換ルール**:
1. `$bg:*` → 場面に応じて `bg_field` / `bg_forest` / `bg_indoor` にマッピング
2. 未定義キャラ（elder 等）→ `fantasy_hero`（汎用）にフォールバック
3. 全 expressionId → `normal` に統一
4. 非標準プロパティ → 除去
5. ブロック ID → 再採番

**メリット**: すぐ動く、API 呼び出し少ない
**デメリット**: 全シーン同じ表情、背景の使い分けが粗い

### 案B: アセット拡充 + 変換（推奨）

公式アセットのバリエーションを活用し、背景・表情を豊かにする。

**手順**:
1. 公式アセット一覧を取得（`GET /api/official-assets`）
2. 背景: 使える背景をできるだけマッピング（夜景、室内、森など）
3. キャラ表情: 公式アセットに表情バリエーションがあれば追加
4. 不足キャラ: elder 等 → 既存キャラの1つを代用 or 新たに公式アセットから追加
5. 変換スクリプトでマッピングテーブルに基づき変換
6. API で一括投入

**メリット**: ビジュアル的に豊か
**デメリット**: マッピング作業が必要

---

## 4. 実装計画（案A ベース、段階的に案B へ拡張）

### Phase 1: 変換スクリプト作成

```
scripts/import-editor-json.ts
```

**処理フロー**:
1. manifest.json, characters.json, page-*.json を読み込み
2. マッピングテーブルで assetId を変換
3. 未定義キャラをフォールバック
4. expressionId を `normal` に統一
5. 非標準プロパティを除去
6. ブロック ID を再採番
7. API 形式の JSON を出力

### Phase 2: API 投入

```bash
# 1. ログイン
TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | jq -r .token)

# 2. プロジェクト作成
PROJECT_ID=$(curl -s -X POST $API_URL/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"ファンタジー - 泉の癒し手"}' | jq -r .project.id)

# 3. 公式アセットインポート
curl -X POST $API_URL/api/assets/$PROJECT_ID/use-official ...

# 4. キャラクタークラス作成
curl -X POST $API_URL/api/projects/$PROJECT_ID/character-class ...

# 5. ページ・ブロック一括保存
curl -X PUT $API_URL/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -d @converted-project.json
```

### Phase 3: 検証

- エディタで全15ページが表示される
- プレビューで再生できる
- リンク切れ（背景なし、キャラなし）がない

---

## 5. 背景マッピングテーブル（案A 暫定）

page-001 の分析を元にした暫定マッピング:

| 生成上の背景 | マッピング先 | 理由 |
|-------------|------------|------|
| `$bg:dried_spring` | bg_field | 屋外・村の泉 |
| `$bg:luca_hut_night` | bg_indoor | 室内・ルカの小屋 |
| `$bg:elder_house_morning` | bg_indoor | 室内・長老の家 |
| `$bg:forest_*` | bg_forest | 森系 |
| `$bg:valley_*`, `$bg:mountain_*` | bg_field | 屋外系 |
| その他屋内 | bg_indoor | デフォルト |
| その他屋外 | bg_field | デフォルト |

→ 全ページの背景スラグを洗い出して確定する必要あり。

---

## 6. 必要な事前調査

| 調査項目 | 目的 |
|---------|------|
| 全ページの `$bg:*` 一覧 | 背景マッピングテーブル完成 |
| 全ページの characterId 一覧 | 未定義キャラの特定 |
| 全ページの expressionId 一覧 | 表情フォールバック表 |
| 公式アセット背景の全一覧 | 案B で使えるバリエーション |
| 公式アセットキャラの表情一覧 | 案B で表情追加可否 |

---

## 7. 見積り

| フェーズ | 作業量 |
|---------|-------|
| Phase 1（変換スクリプト） | 新規 1 ファイル、約 150 行 |
| Phase 2（API 投入） | スクリプト実行 |
| Phase 3（検証） | エディタ・プレビュー確認 |
| 合計 | 約 30 分 |
