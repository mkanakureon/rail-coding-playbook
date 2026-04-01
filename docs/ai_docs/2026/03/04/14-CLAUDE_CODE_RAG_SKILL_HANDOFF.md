# 14-CLAUDE_CODE_RAG_SKILL_HANDOFF

## 1. 概要
Claude Code が KaedeVN のドキュメント（10万行規模）を検索できるようにするための **MCP (Model Context Protocol) サーバー** が実装済みです。

## 2. 接続情報
- **MCP Endpoint**: `http://localhost:8080/mcp`
- **公開ツール**: `search_docs`

## 3. Claude Code での使用手順

### Step 1: Hono サーバーの起動
MCP サーバーは `apps/hono` 内で動作するため、まずサーバーを起動します。

```bash
cd apps/hono
npm run dev
```

### Step 2: Claude Code へのツール登録
Claude Code 起動時に、MCP サーバーをリンクします。

```bash
# Claude Code 起動コマンドの例
claude --mcp-url http://localhost:8080/mcp
```

### Step 3: スキルの有効化
Claude Code に対し、不明な点があれば `search_docs` ツールを使用するよう指示してください。すでに `.clauderc` や Personal Skill として設定しておくのが理想的です。

## 4. 検索エンジンの仕組み
内部では `HybridRAGService` が動作しており、意味検索（ベクトル）とキーワード検索を統合した結果を返却します。
各結果には `read_file("...")` という推奨アクションが含まれているため、Claude は検索後に迷わずファイルの中身を確認できます。

## 5. 運用上の注意
- **認証**: 現在の MCP エンドポイントは開発利便性のため認証をスキップするか、特定のトークンを必要とするよう適宜調整してください。
- **インデックス更新**: ドキュメントを追加・修正した際は、必ず `npx tsx scripts/rag-index.ts` を実行して、RAG DB を最新に保ってください。
