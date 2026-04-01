---
name: rag-search
description: Use when searching docs/ for design intent, past decisions, or implementation history via hybrid vector+keyword search. Also triggers index update on "RAG更新", "インデックス更新". Triggers on "設計意図", "過去の実装", "仕様書検索", "rag search", "ドキュメント検索".
---

# RAG ドキュメント検索スキル

モノレポの `docs/` 配下にある Markdown ドキュメント（10万行以上）をベクトル検索 + キーワード検索のハイブリッドで検索するシステム。

## いつ使うか

- 設計意図・過去の実装判断を調べるとき
- 「なぜこうなっているか」を知りたいとき
- 仕様書・レポート・インシデント記録を探すとき
- Grep/Glob では見つけにくい概念的な検索が必要なとき

## 前提条件

- PostgreSQL (pgvector) が `127.0.0.1:5432` で稼働中（DB名: `kaedevn_rag`）
- `RAG_DATABASE_URL` と `OPENAI_API_KEY` が `.env` または `apps/hono/.env` に設定済み
- インデックスが作成済み（未作成の場合は「インデックス更新」を実行）

## 使い方

### 1. CLI で検索（推奨）

```bash
# 直接検索スクリプトを実行
npx tsx scripts/cli/rag/test-rag-search.ts
```

検索クエリをカスタマイズする場合は、スクリプト内の `queries` 配列を変更する。

### 2. MCP エンドポイント経由で検索（認証不要）

Hono API サーバーが起動中の場合:

```bash
# tools/list — 利用可能なツール一覧
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","id":1}' | jq .

# tools/call — search_docs で検索実行
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","id":2,"params":{"name":"search_docs","arguments":{"query":"検索したい内容","topK":5}}}' | jq .
```

### 3. REST API 経由で検索（認証必要）

```bash
curl -s http://localhost:8080/api/rag/search \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"検索したい内容","topK":5}' | jq .
```

### 4. インデックス更新（手動）

ドキュメントを追加・更新した後にインデックスを手動で最新化する:

```bash
npx tsx scripts/cli/rag/rag-index.ts
```

- 差分更新対応（SHA-256 ハッシュで変更検出）。変更のないファイルはスキップされる
- **自動更新**: `./scripts/dev-start.sh` でサーバー起動時にバックグラウンドで自動実行される

| ユーザーの表現 | 動作 |
|---|---|
| "RAG更新" / "インデックス更新" | `npx tsx scripts/cli/rag/rag-index.ts` を実行 |
| "RAG再構築" / "インデックス全削除" | DB 初期化 → インデックス再作成 |

### 5. DB 初期化（初回 or 再構築）

```bash
npx tsx scripts/cli/rag/init-rag-db.ts
```

## 検索パラメータ

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| `query` | (必須) | 検索クエリ（自然言語可） |
| `topK` | 5 | 返す結果の最大数 |
| `vectorWeight` | 0.6 | ベクトル検索の重み（0〜1、残りがキーワード検索） |

## アーキテクチャ

```
scripts/cli/rag/rag-index.ts          → docs/**/*.md を chunk 化 → embedding → PostgreSQL (pgvector)
apps/hono/src/lib/assist/hybrid-rag.ts  → vector search + keyword search → merge → rank
apps/hono/src/routes/mcp.ts             → POST /mcp (認証不要、MCP プロトコル)
apps/hono/src/routes/rag-hybrid.ts      → POST /api/rag/search (認証必須、REST API)
```

## 検索結果の活用

結果の `doc_path` を使って Read ツールでファイルを読む:

```
結果例: doc_path = "docs/09_reports/2026/03/04/03-GAP-COUNTERMEASURE-PLAN.md"
→ Read ツールでそのファイルを読んで詳細を確認する
```

## 関連ファイル

- `scripts/cli/rag/init-rag-db.ts` — DB 初期化
- `scripts/cli/rag/rag-index.ts` — インデックス作成・更新
- `scripts/cli/rag/test-rag-search.ts` — CLI テスト検索
- `apps/hono/src/lib/assist/hybrid-rag.ts` — HybridRAGService
- `apps/hono/src/routes/mcp.ts` — MCP エンドポイント（認証不要）
- `apps/hono/src/routes/rag-hybrid.ts` — REST API エンドポイント（認証必要）
- `packages/ai-gateway/` — Embedding クライアント抽象化
