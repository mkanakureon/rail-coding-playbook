# 公式アセット検索強化 計画書

## 目的

エディタの公式アセット選択画面に「テキスト検索」「タグフィルタ」「セマンティック検索」を追加し、作者が直感的に画像を探せるようにする。

## 前提

- 公式アセット: BG 293件 + CH 297件 = 590件
- Gemini で `metadata.fromVision`（description_ja/en, tags, 属性）を生成中
- Embedding 基盤は `packages/ai-gateway` + `PrismaVectorStore` に実装済み
- 現在のUIはサブカテゴリチップ + 画像グリッドのみ

---

## Phase 1: テキスト検索 + 説明表示

### 1-1. API: search パラメータ追加

**ファイル**: `apps/hono/src/routes/official-assets.ts`

`GET /api/official-assets?search=夜の森&kind=image&category=bg`

```
検索対象（OR）:
  - description (Text カラム)
  - metadata->'fromVision'->>'description_ja'
  - metadata->>'tags' (配列を文字列化して ILIKE)
  - filename
```

590件に対する `ILIKE '%keyword%'` は十分高速（<10ms）。

### 1-2. API: レスポンスに説明文を追加

現在のレスポンス:
```json
{ "id", "kind", "category", "url", "name", "displayName", "description", "isFree" }
```

追加:
```json
{
  "descriptionJa": "夜の森。月明かりが...",
  "tags": ["fantasy", "forest", "night"],
  "displayName": "夜の神秘的な森"
}
```

### 1-3. UI: 検索バー + 説明表示

**ファイル**: `apps/editor/src/components/AssetSelectModal.tsx`

- カテゴリチップの上に検索入力欄を追加
- 300ms デバウンスで API 呼び出し
- サムネ下に `displayName` or `descriptionJa`（1行 truncate）を表示
- ホバー時にツールチップで全文表示

---

## Phase 2: タグフィルタ UI

### 2-1. API: タグ一覧エンドポイント

**ファイル**: `apps/hono/src/routes/official-assets.ts`

`GET /api/official-assets/tags?kind=image&category=bg`

```json
{
  "tagGroups": {
    "location": [
      { "value": "forest", "label": "森", "count": 15 },
      { "value": "castle", "label": "城", "count": 8 }
    ],
    "timeOfDay": [
      { "value": "night", "label": "夜", "count": 22 },
      { "value": "sunset", "label": "夕暮れ", "count": 12 }
    ],
    "mood": [
      { "value": "dark", "label": "暗い", "count": 18 }
    ]
  }
}
```

fromVision + fromFilename のデータを集約。

### 2-2. UI: タグチップ（複数選択）

- サブカテゴリの下にタググループを横スクロールで表示
- BG: location / timeOfDay / mood
- CH: gender / role / age / trait
- 複数選択可（AND 検索）
- テキスト検索と併用可能

```
[🔍 ________________________________]
[すべて] [ファンタジー] [学園] ...
場所: [森] [城] [酒場] [洞窟] ...
時間: [昼] [夜] [夕暮れ] ...
```

### 2-3. API: タグフィルタ対応

`GET /api/official-assets?kind=image&category=bg&tags=forest,night`

```sql
WHERE metadata->'fromVision'->>'location' = 'forest'
  AND metadata->'fromVision'->>'timeOfDay' = 'night'
```

---

## Phase 3: セマンティック検索

### 3-1. Embedding 生成スクリプト

**ファイル**: `scripts/db/generate-asset-embeddings.mjs`

- 全 590 件の `description_ja` + `tags` を結合してテキスト化
- `GoogleAIEmbeddingClient` (text-embedding-004, 768次元) で embedding 生成
- `official_assets.metadata.embedding` に保存（JSONB）
- バッチ処理（20件ずつ）、レート制限対応

```
入力テキスト例（BG）:
"ファンタジー 背景 森 夜 神秘的 屋外 夜の森。月明かりが木々の間から差し込み..."

入力テキスト例（CH）:
"ファンタジー キャラクター 騎士 男性 若い 勇敢 銀色の鎧を着た若い男性騎士..."
```

### 3-2. API: セマンティック検索エンドポイント

**ファイル**: `apps/hono/src/routes/official-assets.ts`

`GET /api/official-assets?search=寂しい場所&mode=semantic&kind=image&category=bg`

処理フロー:
1. クエリテキストを embedding 化（GoogleAI API 1回）
2. DB から全 embedding を取得（590件、キャッシュ可能）
3. コサイン類似度でランク付け
4. top 20 を返却

**キャッシュ戦略**:
- サーバー起動時に全 embedding をメモリにロード（590 × 768 × 4bytes ≈ 1.8MB）
- 検索時は API 呼び出し（クエリ embedding）+ メモリ内計算のみ
- アセット更新時にキャッシュ無効化

### 3-3. UI: 検索モード切り替え

- デフォルト: キーワード検索（Phase 1）
- トグルで「AI検索」に切替 → セマンティック検索
- 作者の使い分け:
  - 「森」→ キーワード検索（タグに「森」があるものが即ヒット）
  - 「寂しい雰囲気の場所」→ AI検索（意味的に近い画像がヒット）

---

## 実装順序

| Step | 内容 | ファイル | 依存 |
|------|------|---------|------|
| 1 | API: search + レスポンス拡張 | `official-assets.ts` | fromVision 完了待ち |
| 2 | UI: 検索バー + 説明表示 | `AssetSelectModal.tsx` | Step 1 |
| 3 | API: タグ一覧 + フィルタ | `official-assets.ts` | Step 1 |
| 4 | UI: タグチップ | `AssetSelectModal.tsx` | Step 3 |
| 5 | CLI: embedding 生成 | `scripts/db/generate-asset-embeddings.mjs` | fromVision 完了 |
| 6 | API: セマンティック検索 | `official-assets.ts` | Step 5 |
| 7 | UI: AI検索トグル | `AssetSelectModal.tsx` | Step 6 |

## 必要な環境変数

```
# 既存（ai-gateway で使用中）
GOOGLE_AI_API_KEY=...   # Gemini embedding API
```

## 見積もり

- Phase 1（テキスト検索）: API + UI で 2ファイル変更
- Phase 2（タグフィルタ）: API 追加 + UI 追加
- Phase 3（セマンティック）: CLI 1本 + API 追加 + UI 追加
- 前提: Gemini の fromVision 生成が 590件完了していること
