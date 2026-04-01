# packages/ai-gateway - LLM クライアント抽象化

## 概要

複数の LLM プロバイダ（OpenAI, Anthropic, Google Vertex AI, Google Gemini）を統一インターフェースで利用するための抽象化レイヤー。テキスト生成とベクトル埋め込みの両方をサポート。

## ディレクトリ構成

```
packages/ai-gateway/
├── src/
│   ├── types.ts                      # インターフェース定義
│   ├── factory.ts                    # プロバイダファクトリ
│   ├── providers/
│   │   ├── openai.ts                 # OpenAI API クライアント
│   │   ├── anthropic.ts              # Anthropic API クライアント
│   │   ├── google.ts                 # Google Vertex AI
│   │   ├── google-ai.ts             # Google AI Gemini
│   │   ├── mock.ts                   # テスト用モック
│   │   ├── openai-embeddings.ts     # OpenAI 埋め込み
│   │   ├── google-ai-embeddings.ts  # Google 埋め込み
│   │   └── mock-embeddings.ts       # モック埋め込み
│   └── index.ts                      # 公開 API (18行)
├── __tests__/
│   ├── factory.test.ts
│   ├── mock.test.ts
│   ├── embedding-factory.test.ts
│   └── mock-embeddings.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 主要インターフェース

### LLMClient

```typescript
interface LLMClient {
  generate(params: GenerateParams): Promise<GenerateResult>;
}

interface GenerateParams {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

interface GenerateResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}
```

### EmbeddingClient

```typescript
interface EmbeddingClient {
  embed(params: EmbedParams): Promise<EmbedResult>;
}

interface EmbedParams {
  model: string;
  input: string | string[];
}

interface EmbedResult {
  embeddings: number[][];
  model: string;
  tokensUsed: number;
}
```

## プロバイダ一覧

| プロバイダ | ファイル | 用途 |
|-----------|---------|------|
| OpenAI | openai.ts | GPT-4o, GPT-4o-mini 等 |
| Anthropic | anthropic.ts | Claude Sonnet, Claude Opus 等 |
| Google Vertex AI | google.ts | Gemini (GCP 経由) |
| Google AI | google-ai.ts | Gemini (API キー経由) |
| Mock | mock.ts | テスト用 |

### 埋め込みプロバイダ

| プロバイダ | ファイル | モデル |
|-----------|---------|-------|
| OpenAI | openai-embeddings.ts | text-embedding-3-small 等 |
| Google AI | google-ai-embeddings.ts | embedding-001 等 |
| Mock | mock-embeddings.ts | テスト用 |

## ファクトリ

```typescript
// テキスト生成
const client = createLLMClient('openai', { apiKey: '...' });
const result = await client.generate({ model: 'gpt-4o-mini', messages: [...] });

// 埋め込み
const embedder = createEmbeddingClient('openai', { apiKey: '...' });
const result = await embedder.embed({ model: 'text-embedding-3-small', input: '...' });
```

## 依存関係

### 外部ライブラリ
- `@google-cloud/vertexai` — Google Vertex AI
- `@google/generative-ai` — Google AI Gemini
- `@google-genai` — Google GenAI

### 被依存
- `apps/hono` (AI 執筆支援、RAG)

## 使用箇所

- `apps/hono/src/routes/assist.ts` — 4段階 AI 執筆支援パイプライン
  - Stage 1 (章プロット): gpt-4o-mini
  - Stage 2 (話プロット): gpt-4o-mini
  - Stage 3 (本文生成): claude-sonnet
  - Stage 4 (.ks 変換): TypeScript テンプレート（LLM 不要）
- `apps/hono/src/lib/assist/hybrid-rag.ts` — RAG ベクトル検索

## テスト

- factory.test.ts — プロバイダ生成テスト
- mock.test.ts — モッククライアントテスト
- embedding-factory.test.ts — 埋め込みファクトリテスト
- mock-embeddings.test.ts — モック埋め込みテスト
