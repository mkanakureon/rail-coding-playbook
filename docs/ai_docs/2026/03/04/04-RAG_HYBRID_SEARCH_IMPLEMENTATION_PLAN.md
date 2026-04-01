# 04-RAG_HYBRID_SEARCH_IMPLEMENTATION_PLAN

## 1. データベース分離戦略
メインデータベースの負荷を避け、RAG専用の `kaedevn_rag` データベースを構築する。

## 2. 実装ステップ

### Step 1: インフラ構築
- Docker Compose で Postgres イメージを `ankane/pgvector` に変更。
- RAG専用DB作成用の初期化SQL (`01-create-rag-db.sql`) を配備。

### Step 2: データベース初期化 (`scripts/init-rag-db.ts`)
- `pgvector` 拡張の有効化。
- `rag_chunks` テーブルの作成（768次元ベクトル、tsvector、ハッシュ列含む）。

### Step 3: インデクサ CLI (`scripts/rag-index.ts`)
- `docs/**/*.md` のスキャンと H2/H3 単位でのチャンク化。
- `content_hash` による差分更新機能。

### Step 4: ハイブリッド検索エンジン (`hybrid-rag.ts`)
- ベクトル検索とキーワード検索のマージロジック。
- スコア正規化と再順位付け（Rerank）。

### Step 5: API 公開
- `/api/rag-hybrid/search` エンドポイントの実装。
