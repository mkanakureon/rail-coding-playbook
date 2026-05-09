# RAG 検索と RAG システム — このリポジトリの実装解説

作成日: 2026-04-25  
シリーズ: 01-guardrails / 02-ts-techniques / 03-typescript-with-genai / 04-document-implementation-workflow / 本書

## この文書の目的

`CLAUDE.md` の「作業前の RAG 検索（習慣）」を支える RAG システムが、このリポジトリでは **自前で実装されている**。本書は:

1. **第 1 部** — RAG とは何か（一般論）
2. **第 2 部** — このリポジトリでの RAG システムの実装
3. **第 3 部** — 検索の使い方
4. **第 4 部** — なぜ自前で持っているか（優位性）

---

# 第 1 部 — RAG とは何か

## 1-1. RAG = Retrieval-Augmented Generation

【一行で言うと】LLM に「外部ドキュメントを検索した結果」を読ませて回答させる手法。

LLM 単体の問題:
- 学習時点までの知識しかない
- このリポジトリ固有の事情は知らない（どの命令を採用したか、なぜ Capacitor を捨てたか、等）
- 「もっともらしいウソ」を返す（ハルシネーション）

これを解決するのが RAG:

```
(1) ユーザーの質問 → 検索 → 関連ドキュメントを取得
(2) 質問 + 取得ドキュメント → LLM → 回答
```

つまり LLM の前段に **検索エンジン** を置く構造。

## 1-2. ベクトル検索（vector search / semantic search）

【一行で言うと】「文章の意味」を 1536 次元のベクトルに変換し、近いものを返す検索。

仕組み:

```
"Capacitor を採用しなかった理由" 
  ↓ embedding model（OpenAI text-embedding-3-small 等）
[0.012, -0.043, 0.087, ..., 0.005]  ← 1536 次元のベクトル
  ↓ 全ドキュメントのベクトルと cosine 距離を比較
最も近いチャンクを返す
```

**強み**: 「Capacitor」という単語がなくても「ハイブリッドアプリ採用却下」のような **意味的に近い文書を返せる**。  
**弱み**: 固有名詞や型名のような **完全一致が必要な検索が苦手**（"BG_SET" を検索しても周辺概念が混じる）。

## 1-3. キーワード検索（keyword / full-text search）

【一行で言うと】「単語の一致」で検索する古典的手法。PostgreSQL の `tsvector` がよく使われる。

```sql
-- "Capacitor" を含むドキュメントを `ts_rank` で順位付け
SELECT *, ts_rank(content_tsv, plainto_tsquery('Capacitor')) AS score
FROM rag_chunks
WHERE content_tsv @@ plainto_tsquery('Capacitor')
ORDER BY score DESC;
```

**強み**: 完全一致・固有名詞・型名・コマンド名に強い。  
**弱み**: 「同じ意味だが別の語」を引けない（"Capacitor" を検索しても "ハイブリッドアプリ" は出ない）。

## 1-4. ハイブリッド検索 — 両者の良いとこどり

両者を **同時に走らせて重み付けで合算** すると、両方の弱点を消せる:

```
final_score = vector_score × 0.6 + keyword_score × 0.4
```

このリポジトリも **ハイブリッド** を採用している（後述）。

---

# 第 2 部 — このリポジトリの RAG システム実装

## 2-1. 全体像

```
                                              ┌─────────────────────┐
                                              │  PostgreSQL          │
                                              │  (kaedevn_rag DB)    │
                                              │  + pgvector ext      │
                                              │                       │
                                              │  ┌─ rag_chunks ─┐   │
                                              │  │ doc_path      │   │
docs/**/*.md                                  │  │ heading_path  │   │
   │                                          │  │ content       │   │
   │ scripts/cli/rag/rag-index.ts             │  │ content_tsv   │ ← keyword index
   ├─ chunk 化（H1/H2/H3 単位）                │  │ embedding     │ ← HNSW index
   ├─ SHA-256 ハッシュで差分検出              │  │ content_hash  │   │
   ├─ OpenAI embedding API → 1536 次元         │  └───────────────┘   │
   └─ INSERT / UPDATE                         └─────────────────────┘
                                                          ▲
                                                          │
   apps/hono/src/lib/assist/hybrid-rag.ts                 │
   ├─ vectorSearch()  ← cosine 距離                        │
   ├─ keywordSearch() ← ts_rank                            │
   ├─ mergeResults()  ← 重み付け合算                       │
   └─ doc_path 単位の偏り抑制（maxPerDoc）                 │
                                                          │
   apps/hono/src/routes/mcp.ts        ← Claude Code 用（MCP プロトコル、認証不要）
   apps/hono/src/routes/rag-hybrid.ts ← REST API（認証必須）
```

## 2-2. データベーススキーマ — `rag_chunks` 一枚岩

`scripts/cli/rag/init-rag-db.ts` 抜粋:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_path     TEXT NOT NULL,        -- "docs/09_reports/2026/04/21/01-...md"
  heading_path TEXT NOT NULL,        -- "Phase 1 計画書 > 4. スケジュール > Week 1"
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,        -- 元のマークダウン本文
  content_tsv  TSVECTOR,             -- 全文検索用（自動生成）
  embedding    VECTOR(1536),         -- pgvector の型、OpenAI の embedding
  content_hash VARCHAR(64) NOT NULL, -- SHA-256（差分更新用）
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ベクトル検索用 HNSW index
CREATE INDEX idx_chunks_emb_hnsw 
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 全文検索用 GIN index
CREATE INDEX idx_chunks_tsv 
  ON rag_chunks USING gin(content_tsv);

-- content 更新時に tsvector を自動再計算するトリガ
CREATE TRIGGER tsv_update BEFORE INSERT OR UPDATE ON rag_chunks
  FOR EACH ROW EXECUTE FUNCTION rag_chunks_tsv_trigger();
```

設計のポイント:
- **1 テーブル**で済ませている。ドキュメントメタは別テーブルにせず、`doc_path` 文字列で識別
- `embedding VECTOR(1536)` は OpenAI `text-embedding-3-small` の次元
- **HNSW** は近似近傍探索（ANN）のアルゴリズム。pgvector 0.5+ で利用可能、十万チャンクでも秒未満
- **GIN index** は Postgres 標準の全文検索インデックス
- `content_hash` で **差分更新** を実現（同じ内容なら再 embedding しない = OpenAI 課金削減）

## 2-3. インデクサ — `scripts/cli/rag/rag-index.ts`

ドキュメント → チャンク → embedding → DB の流れ。

### chunking（chunk 化）

`docs/**/*.md` を **H1 / H2 / H3 単位** で分割（`rag-index.ts` の `chunkMarkdown()`）:

```ts
function chunkMarkdown(filePath: string, content: string): Chunk[] {
  // H1/H2/H3 が来たら現在のバッファを flush して新しい chunk を開始
  // heading_path は "H1 > H2 > H3" 形式で保持
}
```

**なぜ heading 単位か**:
- 100 行の md を丸ごと embedding すると意味がぼやける（「Phase 1 計画書」というラベルだけが強くなる）
- セクション単位だと「**4. スケジュール > Week 1**」のような **粒度の細かい意味ベクトル** が作れる
- ユーザーへの検索結果に `heading_path` を返せば、どこを読めばいいか一目でわかる

### embedding 生成

```ts
import { createEmbeddingClient } from '@kaedevn/ai-gateway';
const client = createEmbeddingClient('openai', { apiKey });
const result = await client.embed({ texts: [chunk.content] });
// result.embeddings[0] が 1536 次元のベクトル
```

`@kaedevn/ai-gateway` で OpenAI / Anthropic / Google の embedding API を抽象化（`packages/ai-gateway/`）。

### 差分更新

```ts
const hash = createHash('sha256').update(chunk.content).digest('hex');
// DB に同じ doc_path/chunk_index で content_hash が一致するレコードがあればスキップ
```

これで:
- 全 docs を再インデックスする時間が **数十秒〜数分**で済む
- 課金される OpenAI embedding API のコールは **変更チャンク分のみ**

## 2-4. ハイブリッド検索 — `HybridRAGService`

`apps/hono/src/lib/assist/hybrid-rag.ts` の `search()`:

```ts
async search(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
  const { topK = 5, vectorWeight = 0.6, maxPerDoc = 3 } = options;
  const keywordWeight = 1 - vectorWeight;

  // 1. クエリを embedding に変換
  const embedResult = await this.embeddingClient.embed({ texts: [query] });
  const queryEmbedding = embedResult.embeddings[0];

  // 2. 並列で 2 種類の検索
  const [vectorRows, keywordRows] = await Promise.all([
    this.vectorSearch(queryEmbedding, topK * 2),   // 各々 topK の 2 倍取る
    this.keywordSearch(query, topK * 2)
  ]);

  // 3. 正規化 + 重み付け合算
  const merged = this.mergeResults(vectorRows, keywordRows, vectorWeight, keywordWeight, query);

  // 4. 1 ドキュメントあたり maxPerDoc に制限（同じ doc が結果を独占しないように）
  // 5. topK にスライス
  return finalResults;
}
```

検索の特徴:
- **2 検索を並列実行**（`Promise.all`）— レイテンシは遅いほうの検索に律速
- **正規化** — それぞれの最大スコアを 1.0 に正規化してから加算（スケールが違う 2 種を合算するため）
- **`maxPerDoc`** — 1 ドキュメントから最大 3 チャンクまで（長文ドキュメントが結果を独占するのを防ぐ）
- **`topK * 2` 取って絞り込み** — 重複・偏り除去で減るため、多めに取って後で削る

### ベクトル検索クエリ

```sql
SELECT id, doc_path, heading_path, content,
       1 - (embedding <=> $1::vector) AS score
FROM rag_chunks
ORDER BY score DESC LIMIT $2;
```

`<=>` は pgvector の **cosine distance 演算子**。`1 - distance` で類似度（0〜1）になる。

### キーワード検索クエリ

```sql
SELECT id, doc_path, heading_path, content,
       ts_rank(content_tsv, plainto_tsquery('simple', $1)) AS score
FROM rag_chunks
WHERE content_tsv @@ plainto_tsquery('simple', $1)
ORDER BY score DESC LIMIT $2;
```

`plainto_tsquery('simple', ...)` は **simple 設定**（語幹処理なし）。日本語にも対応するため英語形態素解析を切っている。

## 2-5. 公開エンドポイント

| エンドポイント | パス | 認証 | 用途 |
|---|---|---|---|
| MCP | `POST /mcp` | 不要 | **Claude Code から MCP プロトコルで呼ぶ** |
| REST | `POST /api/rag/search` | Bearer 必須 | アプリ内・サーバー間の検索 |

### MCP エンドポイント — Claude Code 専用

`apps/hono/src/routes/mcp.ts`:

```ts
mcp.post('/', async (c) => {
  const { method, params, id } = await c.req.json();
  // ...
  if (method === 'tools/call' && params.name === 'search_docs') {
    const results = await rag.search(args.query, { topK: args.topK || 5 });
    return c.json({
      id,
      result: { content: [{ type: 'text', text: formattedText }] },
    });
  }
});
```

応答フォーマット:

```
[Score: 0.87] docs/09_reports/2026/04/21/01-phase1-...-plan.md
Heading: Phase 1 計画書 > 4. スケジュール > Week 1
Excerpt: Day 1 から Day 5 までは VM 本体の opcode 移植...
Recommended: read_file("docs/09_reports/2026/04/21/01-phase1-...-plan.md")
---
[Score: 0.71] ...
```

`Recommended: read_file(...)` を返すことで、Claude Code は **次にどのファイルを Read すべきか** を即座に判断できる。

---

# 第 3 部 — 検索の使い方

## 3-1. CLAUDE.md が推奨する curl

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "id": 1,
    "params": {
      "name": "search_docs",
      "arguments": { "query": "Capacitor 却下理由", "topK": 5 }
    }
  }' | jq .
```

API 未起動時は `Grep` で `docs/` を検索（`grep -r "Capacitor" docs/`）。

## 3-2. ツール一覧（MCP の標準）

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","id":1}' | jq .
```

このリポジトリでは現状 `search_docs` のみ。今後増やす可能性あり。

## 3-3. インデックス更新

```bash
# 差分更新（変更チャンクのみ embedding）
npx tsx scripts/cli/rag/rag-index.ts

# 全削除して作り直し
npx tsx scripts/cli/rag/init-rag-db.ts
npx tsx scripts/cli/rag/rag-index.ts
```

ただし `./scripts/dev-start.sh` で API サーバ起動時に **自動でバックグラウンド実行** されるので、通常は手動で叩かない。

## 3-4. 検索パラメータの調整

| パラメータ | デフォルト | 効果 |
|---|---|---|
| `query` | （必須） | 検索クエリ（自然言語可） |
| `topK` | 5 | 返す結果の最大数 |
| `vectorWeight` | 0.6 | ベクトル / キーワード の比率（0=完全キーワード、1=完全ベクトル） |
| `maxPerDoc` | 3 | 1 ドキュメントから返す最大チャンク数 |

経験則:
- **概念検索（「設計意図」「却下理由」）** → `vectorWeight: 0.7〜0.8`
- **固有名詞検索（型名・コマンド名）** → `vectorWeight: 0.3〜0.4`
- **デフォルト 0.6** はバランス型

## 3-5. 良いクエリの書き方

| 悪い例 | 良い例 |
|---|---|
| `"VRM"` | `"VRM の表情が動かない原因"` |
| `"課金"` | `"Apple StoreKit のレシート検証フロー"` |
| `"バグ"` | `"Live2D 初期化失敗の根本原因"` |

ベクトル検索は **「意図」**を読むので、自然な質問形式の方がヒット率が高い。

---

# 第 4 部 — なぜ自前で持っているか（優位性）

## 4-1. 「外部 SaaS RAG」と比較した利点

| 観点 | 外部 SaaS（Pinecone, Weaviate Cloud 等） | 自前（このリポジトリ） |
|---|---|---|
| データ所在 | 外部（送信） | ローカル PostgreSQL |
| 機密性 | API key 漏洩リスク | DB の所有権はローカル |
| コスト | 月額固定 + リクエスト課金 | OpenAI embedding 課金のみ（差分更新で激減） |
| 検索速度 | ネットワーク往復あり | ローカル DB → 同一プロセス内 |
| カスタマイズ | API 制約内 | SQL とコードを直接書ける |
| 再現性（OSS 化） | 不可 | リポジトリ丸ごと再現可 |

## 4-2. ハイブリッド検索を選んだ実利

ベクトル単体・キーワード単体ではこんな失敗をする:

| 検索クエリ | ベクトルのみ | キーワードのみ | ハイブリッド |
|---|:---:|:---:|:---:|
| `"BG_SET の実装場所"` | △ 周辺概念で薄まる | ◎ 完全一致 | ◎ |
| `"Capacitor 却下理由"` | ◎ 意図で引ける | △ "Capacitor" 単語が無い文書を逃す | ◎ |
| `"配信プラットフォーム選定"` | ◎ | × 完全一致が無い | ◎ |
| `"@bg コマンド"` | △ | ◎ | ◎ |

ハイブリッドは **「絶対外さない」** を取りに行く設計。重み 0.6:0.4 はこの実観測から決まった経験値。

## 4-3. 「heading 単位 chunk」で得られる結果の可読性

検索結果に `heading_path` を返すことで:

```
[Score: 0.87] docs/09_reports/2026/04/21/01-phase1-...-plan.md
Heading: Phase 1 計画書 > 4. スケジュール > Week 1
```

**ファイル名 + 階層** が出るので、Claude/人間が「どのセクションか」を即把握できる。LLM のコンテキストを節約しながら、必要なら `read_file` で詳細を取りに行ける。

## 4-4. 差分更新で OpenAI 課金が抑えられる

```ts
const hash = createHash('sha256').update(chunk.content).digest('hex');
if (existing && existing.content_hash === hash) {
  // skip — 再 embedding しない
}
```

ドキュメント 10 万行・1 万チャンク超えのプロジェクトで、毎日全件 embedding すると月数百ドル。差分更新で **数ドル** に抑えられる。

## 4-5. MCP 経由で Claude Code が「ツール」として呼べる

Claude Code は MCP（Model Context Protocol）対応。`/mcp` を `claude-code` の MCP サーバーとして登録すると、**Claude Code が自分で `search_docs` ツールを呼ぶ判断** ができる。

つまり:

```
ユーザー: "Capacitor を却下した理由は？"
  ↓ Claude Code が判断
  ↓ search_docs("Capacitor 却下理由") を自動コール
  ↓ 結果を読んで回答
```

ユーザーは「RAG を使え」と指示しなくても良い。**規約（CLAUDE.md）+ MCP ツール提供** で「作業前の RAG 検索」を Claude Code が自発的にやる。

## 4-6. CLAUDE.md との連動 — 「習慣」として定着

CLAUDE.md:

> **作業前の RAG 検索（習慣）**  
> まとまった作業の前に `docs/` を RAG 検索する（設計→仕様書、バグ修正→インシデント、文書→前例、デプロイ→障害経緯）。

これが効くのは、**RAG が動く前提でルールが書かれている**から。RAG が無いとこのルールは「絵に描いた餅」になる。**実装 → 規約 → AI の習慣化** の三段が揃って初めて「壊れない仕組み」になる。

## 4-7. 文書ワークフローと相互強化

このリポジトリの文書ワークフロー（前書 04）と組み合わさると、**指数関数的に効く**:

- 計画書・設計書・postmortem を **意思決定ログ込みで日付フォルダに凍結**
- それが RAG にインデックスされる
- 半年後、同じ題目を再検討するときに **RAG が「過去の判断」を返してくる**
- AI / 人間どちらも、過去議論を踏まえて議論を進められる

「**文書を書く文化** + **RAG で検索可能にする**」がペアで回ると、組織記憶が永続化される。

---

# まとめ

## RAG とは

LLM の前段に **検索エンジン** を置き、外部ドキュメントを取得 → LLM に渡して回答させる。

## このリポジトリでの実装

- **PostgreSQL + pgvector** で 1 テーブルにベクトルと全文を併存
- **ハイブリッド検索**（ベクトル 0.6 + キーワード 0.4）
- **heading 単位の chunk**（H1/H2/H3）で結果の可読性が高い
- **MCP エンドポイント** で Claude Code が自動利用
- **差分更新**（SHA-256）で OpenAI 課金を抑制

## 使い方の最小セット

```bash
# 1. 検索（API 経由）
curl -s -X POST http://localhost:8080/mcp -H "Content-Type: application/json" \
  -d '{"method":"tools/call","id":1,"params":{"name":"search_docs","arguments":{"query":"検索したい内容","topK":5}}}' | jq .

# 2. インデックス更新（差分）
npx tsx scripts/cli/rag/rag-index.ts

# 3. API 未起動時は grep フォールバック
grep -r "キーワード" docs/
```

## 優位性（再現したい人へ）

1. 自前持ちで **データ漏れない・課金安い・カスタマイズ自由**
2. ハイブリッド検索で **概念検索と固有名詞検索の両方に強い**
3. MCP 経由で **AI が自発的に呼ぶ**
4. CLAUDE.md と連動して **習慣化**
5. 文書ワークフローと相互強化で **組織記憶が永続化**

外部 SaaS よりも、PostgreSQL + pgvector + 100 行程度のコードで自前構築するほうが、**長期的にはコスト・自由度・統合の深さ全てで勝つ**。
