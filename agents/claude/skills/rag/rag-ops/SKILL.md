---
name: rag-ops
description: モノレポ内ドキュメント検索（RAG）の初期化、インデックス更新、およびハイブリッド検索の実行。プロジェクトの設計仕様や過去の履歴を高速に検索する必要がある場合に使用する。
---

# RAG Operations (rag-ops)

このスキルは、KaedeVN モノレポのハイブリッドRAGシステムを管理・運用するためのものです。

## 1. 環境設定
RAGシステムは専用のデータベースを使用します。ポート競合を避けるため、以下の設定を前提とします。

- **Host/Port**: `127.0.0.1:5433`
- **Database**: `kaedevn_rag`
- **Env Var**: `RAG_DATABASE_URL`, `OPENAI_API_KEY`

## 2. 基本ワークフロー

### 2.1 データベース初期化 (Init)
新しくDBを構築、またはスキーマをリセットする場合に実行します。
`pgvector` 拡張の有効化と `rag_chunks` テーブルの作成が行われます。

```bash
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/init-rag-db.ts
```

### 2.2 ドキュメントのインデックス作成・更新 (Index)
`docs/**/*.md` の最新状態をDBに反映します。差分更新に対応しており、変更があったファイルのみ処理されます。

```bash
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/rag-index.ts
```

### 2.3 知識ベースの検索 (Search)
プロジェクトの仕様や設計意図を検索します。

```bash
# テストスクリプトによる検索（CLI）
PGHOST=127.0.0.1 PGPORT=5433 npx tsx scripts/test-rag-search.ts
```

## 3. リファレンス
詳細な仕様については以下を参照してください。
- [DB定義](references/db-schema.md)
- [API仕様](references/search-api.md)
