# 09-RAG_SYSTEM_OPERATIONS_MANUAL

## 1. はじめに
本ドキュメントは、モノレポ内ドキュメント検索のための「ハイブリッドRAGシステム」を運用するための最新マニュアルです。

## 2. 環境セットアップ

### 2.1 データベースの起動
ポート競合を避けるため、RAG用コンテナは **5433** ポートを使用します。

```bash
docker-compose down
docker-compose up -d
```

### 2.2 環境変数の確認
`apps/hono/.env` およびルートの `.env` に以下が正しく設定されていることを確認してください。

```env
RAG_DATABASE_URL="postgresql://kaedevn:<YOUR_DB_PASSWORD>@127.0.0.1:5433/kaedevn_rag"
OPENAI_API_KEY="<YOUR_OPENAI_API_KEY>..." # エンベディング生成に使用
```

## 3. 運用手順

### 3.1 データベースの初期化
RAG専用DB内のテーブルおよび `pgvector` インデックスを構築します。

```bash
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/init-rag-db.ts
```

### 3.2 インデックスの作成・更新
`docs/**/*.md` をスキャンし、OpenAIの `text-embedding-3-small` モデルでベクトル化します。

```bash
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/rag-index.ts
```
※ `content_hash` 管理により、変更のあったファイルのみが高速に更新されます。

### 3.3 検索の実行
```bash
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/test-rag-search.ts
```

## 4. エージェント連携
Claude Code や Gemini CLI は、API エンドポイント `POST /api/rag-hybrid/search` を通じてこの知識ベースを活用できます。
詳細は `14-CLAUDE_CODE_RAG_SKILL_HANDOFF.md` を参照してください。
