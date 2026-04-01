---
name: rag-ops
description: モノレポ内ドキュメント検索（RAG）の初期化、インデックス更新、およびハイブリッド検索の実行。プロジェクトの設計仕様や過去の履歴を高速に検索する必要がある場合に使用する。
---
# RAG ドキュメント検索 Skill (rag-ops)

モノレポの `docs/` 配下にある大量の Markdown ドキュメントから、設計意図や過去の実装判断をベクトル検索とキーワード検索（ハイブリッド）で探し出すための手順書です。

## いつ使うか
- ユーザーから「過去の実装を調べて」「設計意図を探して」「仕様書検索」と指示されたとき
- Grep（文字の一致）では見つけにくい概念的な検索が必要なとき
- ユーザーから「RAG更新」「インデックス更新」と指示されたとき

## 前提条件
- PostgreSQL (pgvector) が `127.0.0.1:5432` で稼働中（DB名: `kaedevn_rag`）
- `RAG_DATABASE_URL` と `OPENAI_API_KEY`（または `GEMINI_API_KEY`）が環境変数に設定済みであること

## 手順

### 1. インデックスの更新（RAG更新）
ドキュメントが追加・更新された後、検索を最新の状態にするためのコマンドです。（自動で差分のみ更新されます）

```bash
npx tsx scripts/cli/rag/rag-index.ts
```

※「インデックス全削除して再構築して」と言われた場合は、先に初期化を行います。
```bash
npx tsx scripts/cli/rag/init-rag-db.ts
```

### 2. 検索の実行
過去の設計や仕様を調べる際は、CLIの検索スクリプトを編集して実行するのが最も手軽です。

```bash
# クエリをカスタマイズして実行
npx tsx scripts/cli/rag/test-rag-search.ts
```
※スクリプト内の `queries` 配列をユーザーの質問内容（例：「RPGマップの保存フォーマットは？」）に書き換えてから実行してください。

### 3. API経由での検索（高度な用途）
Hono API サーバーが起動中の場合、MCP（Model Context Protocol）経由で認証不要の検索も可能です。

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","id":1,"params":{"name":"search_docs","arguments":{"query":"検索したい内容","topK":5}}}' | jq .
```

## 検索結果の活用
検索結果には関連するファイルのパス（`doc_path`）が含まれます。
検索結果の要約だけで判断できない場合は、**必ずそのファイルを `read_file` ツールで読み込んで**詳細を確認し、ユーザーに報告してください。

## 関連ファイル
- `scripts/cli/rag/init-rag-db.ts` — DB 初期化
- `scripts/cli/rag/rag-index.ts` — インデックス作成・更新
- `scripts/cli/rag/test-rag-search.ts` — CLI テスト検索
- `apps/hono/src/lib/assist/hybrid-rag.ts` — HybridRAGService
