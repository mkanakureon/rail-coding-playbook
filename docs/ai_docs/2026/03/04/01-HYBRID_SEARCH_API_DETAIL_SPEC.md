# 98-HYBRID_SEARCH_API_DETAIL_SPEC

## 1. データベースアーキテクチャ
既存のメインDBから分離し、RAG専用のデータベースを構築する。

### 1.1 接続設定
- **DB名**: `kaedevn_rag`
- **拡張**: `pgvector` を有効化。
- **接続クライアント**: `pg` (node-postgres) を使用し、Prismaを通さず高速かつ低レイヤーな制御を行う（ハイブリッドクエリの複雑性に対応するため）。

### 1.2 スキーマ定義 (`rag_chunks` テーブル)
| カラム名 | 型 | 説明 |
|:---|:---|:---|
| `id` | UUID / BIGSERIAL | 主キー |
| `doc_path` | TEXT | ファイルの相対パス |
| `heading_path` | TEXT | H1 > H2 > H3 形式の見出しパス |
| `content` | TEXT | チャンク本文 |
| `content_tsv` | TSVECTOR | 全文検索用ベクトル (English + Japanese 'simple') |
| `embedding` | VECTOR(1536) | OpenAI/Gemini用ベクトル |
| `content_hash` | VARCHAR(64) | 差分更新判定用（SHA-256） |
| `updated_at` | TIMESTAMPTZ | 最終更新日時 |

---

## 2. 検索ロジック (Hybrid Engine)

### 2.1 ハイブリッドクエリの構造
以下の2つのクエリを1つの関数内で実行し、TypeScript側でマージする。

1.  **Semantic Search (ベクトル)**:
    ```sql
    SELECT id, 1 - (embedding <=> $1) AS vector_score 
    FROM rag_chunks 
    ORDER BY vector_score DESC LIMIT $2
    ```
2.  **Keyword Search (全文検索)**:
    ```sql
    SELECT id, ts_rank(content_tsv, plainto_tsquery('simple', $1)) AS keyword_score
    FROM rag_chunks
    WHERE content_tsv @@ plainto_tsquery('simple', $1)
    ORDER BY keyword_score DESC LIMIT $2
    ```

### 2.2 スコア・マージ・アルゴリズム
- **正規化**: 各スコアを 0〜1 にスケール。
- **重み付け**: `final_score = (vector_score * 0.6) + (keyword_score * 0.4)`
- **リランク機能**: 
    - `doc_path` や `heading_path` に検索語が含まれる場合、`final_score * 1.2` の加点。
    - 同一ドキュメントからのヒットは最大3件に制限。

---

## 3. APIエンドポイント定義

### `POST /api/rag/hybrid-search`
エージェントが「知識」を検索するためのメインゲートウェイ。

- **Request Body**:
  ```json
  {
    "query": "認証の仕様について",
    "limit": 5,
    "sections": ["docs/01_in_specs"]
  }
  ```
- **Response Body**:
  ```json
  {
    "results": [
      {
        "doc_path": "docs/AUTH.md",
        "content": "...",
        "score": 0.89,
        "match_type": "hybrid",
        "recommended_action": "read_file('docs/AUTH.md')"
      }
    ]
  }
  ```
