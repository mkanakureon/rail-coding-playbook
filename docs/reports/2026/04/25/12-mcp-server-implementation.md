# MCP サーバーを自前で立てる方法

シリーズ: 11-documentation-plan / 関連: 05-rag-search-system / 08-cli-via-ai-prompts

## この文書の狙い

Claude Code / Cursor が「自分の RAG」「自分の DB」「自分の API」を使えるようにするには **MCP（Model Context Protocol）サーバー** を立てる必要がある。Anthropic SDK の MCP は重く感じるが、**実体は単純な JSON-RPC over HTTP**。このリポジトリは **Hono で 80 行** で実装している。本書はその全体像と、自分のプロジェクトへの移植手順を書く。

---

## 1. MCP とは何か（一般論）

### 1-1. プロトコルの実体

MCP（Model Context Protocol）は Anthropic が公開している仕様で、**LLM クライアント（Claude Code / Cursor / Claude Desktop 等）が外部ツールを呼び出すための共通プロトコル**。

中身は JSON-RPC 2.0 over HTTP（または stdio）。**サーバー側は 2 つのメソッドに応えるだけ**:

```
POST /mcp
Body: { "method": "tools/list",  "id": 1 }
Body: { "method": "tools/call",  "id": 2, "params": { "name": "...", "arguments": {...} } }
```

### 1-2. 「ツール」の概念

LLM 側から見ると、MCP サーバーが提供する **ツール** は **関数呼び出し** に見える:

```
名前:        search_docs
説明:        ドキュメント検索
入力スキーマ: { query: string, topK?: number }
```

これを `tools/list` で取得し、ユーザーが「Capacitor 却下理由を教えて」と言ったら、LLM は **自分で `search_docs("Capacitor 却下理由")` を呼ぶ判断** をする。

### 1-3. 公式 SDK との関係

Anthropic 公式の `@modelcontextprotocol/sdk` を使うと:
- stdio / SSE / WebSocket 等の transport が自動
- handshake / capabilities 交換を抽象化

しかし **HTTP POST だけで完結する場合**、SDK は不要。生のエンドポイントを生やすほうが軽量。本リポジトリはこちらの選択。

---

## 2. このリポジトリでの実装

### 2-1. 全 80 行 — `apps/hono/src/routes/mcp.ts`

```ts
import { Hono } from 'hono';
import { createEmbeddingClient } from '@kaedevn/ai-gateway';
import { HybridRAGService } from '../lib/assist/hybrid-rag.js';

const mcp = new Hono();

mcp.post('/', async (c) => {
  const body = await c.req.json();
  const { method, params, id } = body;

  const connectionString = process.env.RAG_DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!connectionString || !apiKey) {
    return c.json({ error: 'RAG configuration missing' }, 500);
  }

  const embClient = createEmbeddingClient('openai', { apiKey });
  const rag = new HybridRAGService(embClient, connectionString);

  try {
    // ── tools/list ──
    if (method === 'tools/list') {
      return c.json({
        id,
        result: {
          tools: [{
            name: 'search_docs',
            description: 'KaedeVNモノレポのドキュメントをハイブリッド検索する。',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '検索クエリ（自然言語可）' },
                topK: { type: 'number', default: 5 },
              },
              required: ['query'],
            },
          }],
        },
      });
    }

    // ── tools/call ──
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      if (name === 'search_docs') {
        const results = await rag.search(args.query, { topK: args.topK || 5 });
        const formattedText = results.map(r =>
          `[Score: ${r.final_score.toFixed(2)}] ${r.doc_path}\n` +
          `Heading: ${r.heading_path}\n` +
          `Excerpt: ${r.content.substring(0, 500)}\n` +
          `Recommended: read_file("${r.doc_path}")`
        ).join('\n---\n');

        return c.json({
          id,
          result: { content: [{ type: 'text', text: formattedText }] },
        });
      }
    }

    return c.json({ id, error: { code: -32601, message: 'Method not found' } }, 404);
  } catch (err: any) {
    return c.json({ id, error: { code: -32603, message: err.message } }, 500);
  } finally {
    await rag.close();
  }
});

export default mcp;
```

たったこれだけ。

### 2-2. ルート登録 — `apps/hono/src/index.ts`

```ts
import mcp from './routes/mcp.js';
// ...
app.route('/mcp', mcp); // MCP endpoint — outside /api/* to avoid authMiddleware
```

**`/api/*` の外側にマウント** されているのが重要。Claude Code は MCP 呼び出しに認証ヘッダを渡せないため、**認証ミドルウェアを通さない位置**に置く。

### 2-3. レスポンスの「Recommended」パターン

このリポジトリの実装で特徴的なのは、レスポンステキストに以下の 1 行を **必ず埋め込む** こと:

```
Recommended: read_file("docs/09_reports/2026/04/21/01-...md")
```

これは LLM に対する **誘導** で、**「次に Read ツールでこのファイルを開け」** というヒント。Claude Code は Read を持っているので、MCP の結果を読んだあと自動で原典を取りに行く。

つまり MCP は **「あなたが読むべきパスはここ」を返す検索エンジン**として位置付けられている。RAG の chunk 全文を返すのではなく、**ファイルパスを優先** する設計。

### 2-4. JSON-RPC エラーコード

```ts
{ code: -32601, message: 'Method not found' }   // 未知のメソッド
{ code: -32603, message: err.message }          // 内部エラー
```

JSON-RPC 2.0 標準のエラーコード。LLM 側が「機能ない」と理解しやすい。

---

## 3. 使い方

### 3-1. ツール一覧取得

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","id":1}' | jq .
```

レスポンス:

```json
{
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_docs",
        "description": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### 3-2. ツール呼び出し

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "id": 2,
    "params": {
      "name": "search_docs",
      "arguments": { "query": "Capacitor 却下理由", "topK": 5 }
    }
  }' | jq .
```

### 3-3. Claude Code への登録

Claude Code 側の MCP 設定（プロジェクト or ユーザー設定）に追加:

```json
{
  "mcpServers": {
    "kaedevn-search": {
      "url": "http://localhost:8080/mcp",
      "transport": "http"
    }
  }
}
```

これで Claude Code が **`search_docs` を自分の判断で呼ぶ** ようになる。

### 3-4. Claude Code 側の挙動

```
ユーザー: 「Capacitor を却下した理由を教えて」
   ↓
Claude Code が tools/list で取得済みのツール一覧から search_docs を発見
   ↓
search_docs("Capacitor 却下理由") を自動コール
   ↓
レスポンスの "Recommended: read_file(...)" を読んで原典を Read
   ↓
原典を要約して回答
```

ユーザーは「RAG 検索しろ」と指示しなくて良い。

---

## 4. なぜそうするか（優位性）

### 4-1. 公式 SDK 不要 — Hono 80 行で完結

公式 `@modelcontextprotocol/sdk` を使うと:
- stdio / SSE 対応のため複雑
- TypeScript 依存が増える
- handshake / capabilities 交換のオーバーヘッド

HTTP POST だけで完結するなら、**生エンドポイントが圧倒的に軽い**。Hono なら 80 行、Express でも 100 行未満。

### 4-2. 認証境界の外側に置く意味

Claude Code は MCP 呼び出しに **任意のヘッダを乗せられない**（実装によっては認証情報を渡せる版もあるが、汎用的ではない）。`/mcp` を `/api/*` の外側に置くことで:
- 認証ミドルウェアを通さない
- ローカル開発時に「鍵なしで叩ける」
- 本番ではファイアウォール / VPN で制御

このトレードオフを分かった上で、**ローカル開発の生産性を取った**。

### 4-3. Recommended パターンで LLM のコンテキストを節約

検索結果の chunk 全文を返すと:
- LLM のコンテキストが食われる
- 1 検索で 5 件 × 500 文字 = 2,500 トークン

代わりに `Recommended: read_file(...)` を返すと:
- LLM は **必要なファイルだけ Read で取りに行く**
- 検索段階のレスポンスは **タイトル + 抜粋 + パス** で済む
- 結果として **コンテキスト効率が 3〜5 倍**

### 4-4. 1 ツールに絞った思想

このリポジトリは MCP に **1 ツール（search_docs）しか公開していない**。理由:
- ツールが多いと LLM が選択を間違える
- 「迷ったら検索 → 結果のパスを Read」の **1 経路** に集約
- 必要になってからツールを足す（YAGNI）

将来の拡張案:
- `get_project_state` — 現在のプロジェクト状態を返す
- `run_test` — 特定テストを実行
- `query_db` — DB 状態を返す

---

## 5. 自分のプロジェクトへの移植手順

### Step 1: ルートを生やす

Hono / Express / Next.js Route Handler どれでも良い。POST で JSON を受け取り、`method` と `params.name` で分岐するだけ。

```ts
// 最小骨格
app.post('/mcp', async (c) => {
  const { method, params, id } = await c.req.json();

  if (method === 'tools/list') {
    return c.json({ id, result: { tools: [...] } });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    // 各ツールの実装
  }
});
```

### Step 2: ツール定義を書く

最小要素は **`name` / `description` / `inputSchema`**。`description` を読んで LLM が「いつ呼ぶか」を判断するので、**ユースケースを明示**:

```jsonc
{
  "name": "search_docs",
  "description": "ドキュメント検索。設計意図や過去の判断を調べたい時に使う。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "検索クエリ（自然言語可）" }
    },
    "required": ["query"]
  }
}
```

### Step 3: ツール実装

`tools/call` 内で `params.name` を分岐し、本物のロジックを呼ぶ:

```ts
if (name === 'search_docs') {
  const results = await yourRagService.search(args.query);
  return c.json({
    id,
    result: { content: [{ type: 'text', text: formatResults(results) }] },
  });
}
```

レスポンスの `content` は配列で、複数の `text` を返せる。

### Step 4: Recommended 文字列を仕込む

検索系ツールなら必ず:

```ts
const formatted = results.map(r =>
  `${r.title}\n${r.excerpt}\n` +
  `Recommended: read_file("${r.path}")`
).join('\n---\n');
```

**`read_file("...")` が魔法の文字列**。Claude Code はこれを読んで自動で Read する。

### Step 5: Claude Code に登録

プロジェクトルートの `.mcp.json` または `~/.config/claude-code/config.json`:

```json
{
  "mcpServers": {
    "myproject": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

### Step 6: 確認

Claude Code を起動 → `/mcp` コマンドで一覧表示 → 自分のツールが出ていれば OK。

---

## まとめ

- **MCP は単なる JSON-RPC over HTTP** — Hono 80 行で実装可能
- **`/api/*` の外** に置くと Claude Code から認証なしで叩ける（ローカル用）
- **`Recommended: read_file(...)`** を返してコンテキスト節約
- **1 ツールに絞る** ほうが LLM の選択ミスが減る
- 公式 SDK 不要、`tools/list` と `tools/call` の 2 メソッドで完結

「自分のプロジェクトの DB / 文書 / API を Claude Code に使わせたい」なら、**1 時間で MCP サーバーが立つ**。これが Claude Code を **「あなたのプロジェクト固有のオペレーター」** に変える鍵。
