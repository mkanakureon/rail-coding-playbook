# `@kaedevn/ai-gateway` — LLM プロバイダ抽象の最小実装

シリーズ: 11-documentation-plan / 関連: 20-llm-feature-pipeline

## この文書の狙い

OpenAI / Anthropic / Google を **同じインターフェース** で叩ける薄い抽象を、**SDK なし・fetch だけ** で実装する方法を、本リポジトリの `packages/ai-gateway/` から解説する。`createClient(provider, config)` の 1 行でプロバイダ切り替え可能にする factory パターンの教科書例。

---

## 1. なぜプロバイダ抽象か

### 1-1. SDK 直叩きの問題

```ts
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey });
const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
});
```

これだと:
- **OpenAI に密結合** — Anthropic に切り替えるだけで全 call site を直す
- 各 SDK が **微妙に違う API**（`messages` vs `system` vs `prompt`）
- **モックが面倒** — テスト時に SDK 全体をモックする
- レスポンス型が **プロバイダ依存**

### 1-2. 抽象を入れる利点

```ts
import { createClient } from '@kaedevn/ai-gateway';

const client = createClient('openai', { apiKey });
const result = await client.generate({ model, systemPrompt, userPrompt, jsonMode: true });
```

- **1 行でプロバイダ切替**
- 全プロバイダ共通の `GenerateResult` 型
- **mock プロバイダ**でテスト容易
- レスポンス型が安定

---

## 2. このリポジトリの実装

### 2-1. パッケージ構造

```
packages/ai-gateway/src/
├── factory.ts                       ← createClient / createEmbeddingClient
├── types.ts                         ← Provider / LLMClient / EmbedParams ...
├── providers/
│   ├── openai.ts                    LLM
│   ├── anthropic.ts                 LLM
│   ├── google.ts                    LLM (Vertex AI)
│   ├── google-ai.ts                 LLM (Generative AI)
│   ├── mock.ts                      テスト用
│   ├── openai-embeddings.ts         Embedding
│   ├── google-ai-embeddings.ts      Embedding
│   └── mock-embeddings.ts           Embedding テスト用
└── index.ts                         エクスポート
```

### 2-2. 共通インターフェース — `types.ts`

```ts
export type Provider = 'openai' | 'anthropic' | 'google' | 'google-ai';

export interface GenerateParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  content: string;
  usage: { tokensIn: number; tokensOut: number };
  model: string;
  provider: Provider;
}

export interface LLMClient {
  readonly provider: Provider;
  generate(params: GenerateParams): Promise<GenerateResult>;
}

export interface LLMClientConfig {
  apiKey: string;
  defaultModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
}
```

ポイント:
- **`generate()` 1 メソッドだけ** に絞る（過剰抽象を避ける）
- `jsonMode` は **必須プロパティ**（毎回明示）
- `usage` で **トークン消費** を共通化（コスト計測用）
- `provider` を `readonly` で固定

### 2-3. Factory — `factory.ts`

```ts
export function createClient(
  provider: Provider | 'mock',
  config?: LLMClientConfig
): LLMClient {
  if (provider === 'mock') return new MockClient();

  if (!config) {
    throw new Error(`LLMClientConfig is required for provider "${provider}"`);
  }

  switch (provider) {
    case 'openai':    return new OpenAIClient(config);
    case 'anthropic': return new AnthropicClient(config);
    case 'google':    return new GoogleClient(config);
    case 'google-ai': return new GoogleAIClient(config);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

export function createEmbeddingClient(
  provider: 'openai' | 'google-ai' | 'mock',
  config?: LLMClientConfig
): EmbeddingClient {
  if (provider === 'mock') return new MockEmbeddingClient();
  if (!config) throw new Error(`config required`);
  if (provider === 'google-ai') return new GoogleAIEmbeddingClient(config);
  return new OpenAIEmbeddingClient(config);
}
```

ポイント:
- **`mock` は config 不要**（テスト時の摩擦を最小化）
- **switch で全プロバイダ網羅**（exhaustiveness）
- **default で `Unknown provider` 例外**（型システムで防げる場合も実行時で検出）

### 2-4. 1 プロバイダ実装 — OpenAI

```ts
export class OpenAIClient implements LLMClient {
  readonly provider = 'openai' as const;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: LLMClientConfig) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel ?? 'gpt-4o-mini';
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 1;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const model = params.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
    };

    if (params.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // リトライループ
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        // ... レスポンス処理 ...
        return { content, usage, model, provider: 'openai' };
      } catch (e) { /* retry */ }
    }
    throw lastError;
  }
}
```

ポイント:
- **`fetch` 直叩き** — 公式 SDK 不使用（依存ゼロ）
- リトライ機構を内蔵
- `provider = 'openai' as const` で型安全
- `defaultModel` でフォールバック

### 2-5. Mock プロバイダ — テスト用

```ts
export class MockClient implements LLMClient {
  readonly provider = 'openai' as const;

  async generate(params: GenerateParams): Promise<GenerateResult> {
    return {
      content: 'mocked response',
      usage: { tokensIn: 10, tokensOut: 20 },
      model: 'mock',
      provider: 'openai',
    };
  }
}
```

テスト時に:

```ts
const client = createClient('mock');     // config 不要
const result = await client.generate({ ... });
expect(result.content).toBe('mocked response');
```

**LLM API なしで** ロジック層をテストできる。

---

## 3. 使い方

### 3-1. 基本

```ts
import { createClient } from '@kaedevn/ai-gateway';

const client = createClient('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultModel: 'claude-opus-4-7',
});

const result = await client.generate({
  model: 'claude-opus-4-7',
  systemPrompt: 'あなたは小説家です。',
  userPrompt: 'シーンを書いて',
  jsonMode: false,
  maxTokens: 4000,
});

console.log(result.content);
console.log(`使用トークン: ${result.usage.tokensIn + result.usage.tokensOut}`);
```

### 3-2. プロバイダ切り替え

```ts
// 開発時は安いモデル
const dev = createClient('openai', { apiKey, defaultModel: 'gpt-4o-mini' });

// 本番は精度優先
const prod = createClient('anthropic', { apiKey, defaultModel: 'claude-opus-4-7' });

// 切り替えは 1 行
const client = process.env.NODE_ENV === 'production' ? prod : dev;
```

### 3-3. Embedding 用

```ts
import { createEmbeddingClient } from '@kaedevn/ai-gateway';

const embClient = createEmbeddingClient('openai', { apiKey });
const result = await embClient.embed({ texts: ['hello world'] });
// result.embeddings[0] が 1536 次元の number[]
```

### 3-4. テスト

```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@kaedevn/ai-gateway';

describe('my feature', () => {
  it('should call LLM', async () => {
    const client = createClient('mock');  // ← 鍵不要
    const result = await client.generate({ ... });
    expect(result.content).toBe('mocked response');
  });
});
```

---

## 4. なぜそうするか（優位性）

### 4-1. SDK 不使用 = 依存ゼロ

`openai`, `@anthropic-ai/sdk`, `@google/generative-ai` の **3 つの SDK が node_modules に入る** とサイズが膨れる。`fetch` 直叩きなら **依存ゼロ**、ビルドも速い。

このリポジトリでは SDK バージョンの追従コストもゼロ。

### 4-2. `generate()` 1 メソッドの最小性

複雑な API（streaming, tool use, files, vision 等）を全てインターフェースに含めると、**1 プロバイダで実装できない機能** が出る。最小公約数 `generate()` に絞ることで、**全プロバイダで同じ動作** を保証。

特殊機能が必要になったら、その時に **別メソッド** を追加（YAGNI）。

### 4-3. mock プロバイダがファーストクラス

```ts
createClient('mock')  // config 不要
```

テストでよくやる「SDK の vi.mock」が不要。**プロバイダの 1 つとして mock を実装** する設計。

### 4-4. リトライ・タイムアウトが共通

各プロバイダ実装が:
```ts
this.timeoutMs = config.timeoutMs ?? 30_000;
this.maxRetries = config.maxRetries ?? 1;
```

を独立して持つ → **プロバイダ越しに同じ運用設定**。OpenAI だけ retry が違う、みたいな事故が起きない。

### 4-5. `usage` の共通化でコスト管理が一元化

```ts
const result = await client.generate({...});
metrics.recordTokens(result.provider, result.usage);
```

プロバイダごとの **トークン消費** を統一フォーマットで記録できる。コスト分析が容易。

### 4-6. Provider 型で exhaustiveness

```ts
type Provider = 'openai' | 'anthropic' | 'google' | 'google-ai';

switch (provider) {
  case 'openai': ...
  case 'anthropic': ...
  case 'google': ...
  case 'google-ai': ...
  // 新プロバイダを Provider に足したら、ここに case 追加が型エラーで強制される
}
```

新プロバイダ追加時に **対応忘れがコンパイル時に検出**。

---

## 5. 自分のプロジェクトへの移植手順

### Step 1: パッケージ作成

```
packages/your-ai-gateway/
├── src/
│   ├── factory.ts
│   ├── types.ts
│   ├── providers/
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── mock.ts
│   └── index.ts
└── package.json
```

### Step 2: 型定義

```ts
export type Provider = 'openai' | 'anthropic';

export interface LLMClient {
  generate(params: GenerateParams): Promise<GenerateResult>;
}
```

### Step 3: 1 プロバイダだけ実装

最初から全プロバイダ作らない。**OpenAI だけ** 動くようにする:

```ts
export class OpenAIClient implements LLMClient {
  async generate(params) {
    const res = await fetch('https://api.openai.com/...', {...});
    return parseOpenAIResponse(await res.json());
  }
}
```

### Step 4: factory

```ts
export function createClient(provider, config) {
  switch (provider) {
    case 'openai': return new OpenAIClient(config);
  }
}
```

### Step 5: mock 追加

```ts
export class MockClient implements LLMClient {
  async generate() {
    return { content: 'mock', usage: {tokensIn:0, tokensOut:0}, ...};
  }
}
```

ここまでで **テスト可能 + 1 プロバイダで動く** 状態。

### Step 6: 必要になったプロバイダを追加

Anthropic / Google を 1 つずつ追加。各プロバイダは `LLMClient` を実装するだけなので、**他コードへの影響なし**。

---

## 6. アンチパターン

### NG-1. 全プロバイダ同時実装

→ 1 つも動かないまま行き詰まる。**1 プロバイダ動いてから次** に進む。

### NG-2. メソッドを増やしすぎる

`stream()`, `chat()`, `complete()`, `tool_use()` ... → 全プロバイダ実装が困難。**`generate()` に絞り、必要なら拡張**。

### NG-3. プロバイダ固有の機能を共通インターフェースに混ぜる

```ts
// NG: Anthropic にしかない vision を全プロバイダに要求
interface LLMClient {
  generate(...)
  generateWithImage(...)  // 全実装が必要になる
}
```

→ プロバイダ固有は **派生クラス** で:

```ts
class AnthropicClient extends BaseClient {
  generateWithImage(...) { ... }  // Anthropic だけ
}
```

### NG-4. SDK を使う

→ 依存が増える、SDK バージョン追従コスト。**fetch で十分**。

### NG-5. mock を後回し

→ テストが書けない、本番依存テストが flaky。**mock をファーストクラス** で。

---

## まとめ

- **`createClient(provider, config)` の 1 行でプロバイダ切替**
- 共通インターフェース `LLMClient.generate()` 1 メソッドに絞る
- **fetch 直叩き、SDK 不使用**で依存ゼロ
- **mock プロバイダ**をテスト第一級市民に
- リトライ・タイムアウト・usage を共通化
- Provider 型 + switch で **新プロバイダ追加時の対応漏れを型検出**

「LLM プロバイダ抽象」の教科書例。**100 行のコードで** OpenAI / Anthropic / Google を統一インターフェース化できる。SDK 直叩きを卒業する第一歩。
