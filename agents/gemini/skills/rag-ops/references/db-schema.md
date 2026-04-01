# RAG Database Schema

## rag_chunks テーブル
ドキュメントの各セクション（チャンク）を保存するメインテーブル。

| カラム名 | 型 | 説明 |
|:---|:---|:---|
| `id` | BIGSERIAL | 主キー |
| `doc_path` | TEXT | ファイルの相対パス |
| `heading_path` | TEXT | H1 > H2 > H3 形式の見出し階層 |
| `chunk_index` | INT | ファイル内での順序 |
| `content` | TEXT | 本文 |
| `content_tsv` | TSVECTOR | 全文検索用 |
| `embedding` | VECTOR(1536) | OpenAIエンベディング |
| `content_hash` | VARCHAR(64) | 差分更新判定用の SHA-256 |
| `updated_at` | TIMESTAMPTZ | 最終更新日時 |
