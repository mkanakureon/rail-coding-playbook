# LLM をユーザー機能に組み込む — assist パッケージのフルパイプライン

シリーズ: 11-documentation-plan / 関連: 05-rag-search-system / 15-ai-metadata-api / 21-llm-gateway-abstraction

## この文書の狙い

**「LLM を使ったユーザー向け機能」** をプロダクトに組み込む際の、**設定ファイル → chunk → embedding → DB → 検索 → プロンプト → Claude API → 構造化出力** のフルパイプラインを、本リポジトリの assist パッケージから解説する。AI 連携の「外側を作る」教科書例。

---

## 1. assist パッケージとは何か

### 1-1. 役割

`apps/hono/src/lib/assist/` は **作者向けの執筆支援機能**:
- 作品設定（世界観・キャラ・プロット）を YAML+Markdown で管理
- 設定を chunk 化 → ベクトル DB に保存
- 「執筆」リクエスト時に関連 chunk を検索 → プロンプトを合成 → Claude API
- 戻り値（自然文）を `.ks` スクリプトに変換

### 1-2. ユーザーから見た流れ

```
作者: docs/projects/{id}/settings/ に設定ファイル群を置く
   ↓ (RAG インデックス化)
作者: 「第 3 話のシーン 2 を書いて」
   ↓
assist: 関連設定を引いてプロンプト合成 → Claude → 自然文を返す
   ↓
assist: 自然文を解析 → @bg, @ch, @text 等のスクリプトに変換
   ↓
作者: エディタで確認・編集
```

LLM がリポジトリ機能の **裏側で動く** 設計。

---

## 2. パイプライン全体図

```
┌──────────────────────────────────────────────────┐
│  1. 設定ファイル (md + YAML frontmatter)         │
│     docs/projects/{id}/settings/                 │
│     ├─ overview.md / world.md / characters.md    │
│     └─ history.md / plot.md / episodes.md        │
└────────────────┬─────────────────────────────────┘
                 │ md-parser.ts
┌────────────────▼─────────────────────────────────┐
│  2. WorkSetting オブジェクト（types.ts）         │
│     { overview, characters[], plot[], ... }      │
└────────────────┬─────────────────────────────────┘
                 │ chunker.ts
┌────────────────▼─────────────────────────────────┐
│  3. Chunk[] — character / world / overview ...  │
└────────────────┬─────────────────────────────────┘
                 │ vector-store.ts (OpenAI embedding)
┌────────────────▼─────────────────────────────────┐
│  4. PostgreSQL + pgvector に保存                 │
│     差分更新（content_hash）                     │
└────────────────┬─────────────────────────────────┘
                 │ ユーザー要求
┌────────────────▼─────────────────────────────────┐
│  5. hybrid-rag.ts でクエリ → 関連 chunk 取得     │
└────────────────┬─────────────────────────────────┘
                 │ prompts.ts でプロンプト合成
┌────────────────▼─────────────────────────────────┐
│  6. Claude API 呼び出し（ai-gateway 経由）       │
└────────────────┬─────────────────────────────────┘
                 │ 自然文戻り
┌────────────────▼─────────────────────────────────┐
│  7. ks-generator.ts で .ks 変換                  │
│     - smartTagText で @r / @p 自動挿入           │
│     - キャラ・背景の Op 化                       │
└──────────────────────────────────────────────────┘
```

---

## 3. 各ステージの実装

### 3-1. Stage 1: 設定ファイル → Markdown

設定はリポジトリに **YAML frontmatter + Markdown** で書く:

```markdown
---
slug: hero
role: 主人公
---

## 性格
真面目で内気だが、芯は強い。

## 口調
標準語、丁寧。一人称「ぼく」。

## 経歴
...
```

これが `docs/projects/{id}/settings/characters.md` のような形でリポに入る。

### 3-2. Stage 2: md-parser.ts — 構造化

```ts
// apps/hono/src/lib/assist/md-parser.ts
export function parseFrontmatter(content: string): ParsedMd {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content.trim() };
  const meta = (yamlLib.load(match[1]) ?? {}) as Record<string, unknown>;
  return { meta, body: match[2].trim() };
}

export function parseCharacters(content: string): CharacterSetting[] {
  // ## 名前（slug） で区切ってパース
  ...
}
```

**フリーフォーマットではなく構造を強制** することで、LLM に渡すプロンプトの再現性を確保。

### 3-3. Stage 3: chunker.ts — 意味単位に分割

```ts
// apps/hono/src/lib/assist/chunker.ts
export function chunkWorkSetting(settings: WorkSetting): Chunk[] {
  const chunks: Chunk[] = [];

  // overview
  chunks.push({ key: 'overview', section: 'overview', content: '...', metadata: {} });

  // world
  if (settings.worldSetting) chunks.push({ key: 'world', ... });

  // character ごとに 1 chunk
  for (const char of settings.characters) {
    chunks.push({
      key: `character:${char.slug}`,
      section: 'character',
      content: `名前: ${char.name}\n性格: ${char.personality}\n...`,
      metadata: { characterSlug: char.slug, characterName: char.name },
    });
  }
  // ...
  return chunks;
}
```

**なぜキャラ単位の chunk か**:
- 「ヒロインのセリフを書いて」と言われた時 → ヒロイン chunk だけ取れば十分
- 全キャラ chunk を embedding すると意味がぼやける
- `metadata.characterSlug` で **後から絞り込み** できる

### 3-4. Stage 4: vector-store.ts — 永続化

`prisma-vector-store.ts` で Prisma + pgvector に保存:

```ts
// 概念コード
async function upsertChunk(chunk: Chunk) {
  const hash = sha256(chunk.content);
  const existing = await prisma.workChunk.findFirst({
    where: { projectId, key: chunk.key, contentHash: hash }
  });
  if (existing) return; // 差分更新でスキップ

  const embedding = await embClient.embed({ texts: [chunk.content] });
  await prisma.workChunk.upsert({
    where: { projectId_key: { projectId, key: chunk.key } },
    create: { ..., contentHash: hash, embedding: embedding.embeddings[0] },
    update: { ..., contentHash: hash, embedding: embedding.embeddings[0] },
  });
}
```

**差分更新**で OpenAI embedding API のコールを最小化。

### 3-5. Stage 5: hybrid-rag.ts — 関連 chunk 取得

ユーザーが「第 3 話のシーン 2」を要求すると、**ベクトル検索 + キーワード検索** のハイブリッド（前書 05）で:

```ts
const results = await ragService.search(query, { topK: 10, vectorWeight: 0.6 });
```

返ってきた `results[]` を **section ごとに整理** してプロンプトの素材にする。

### 3-6. Stage 6: prompts.ts — プロンプト合成

```ts
// 概念コード
function buildPrompt(settings: WorkSetting, scene: ScenePlot, ragResults: Chunk[]): string {
  return `
${RECOVERY_TONE_GUIDE}                  // 全体トーン
${formatCharacters(settings)}            // 登場キャラ
${formatRelevantChunks(ragResults)}      // 関連設定（RAG 結果）
${formatScenePlot(scene)}                // シーン指示

【執筆要領】
- 1 シーン 200〜400 字
- ト書き優先、セリフは必要最低限
- 各シーンに五感（特に温度・匂い）を 1 つ以上
`;
}
```

ポイント:
- **トーンガイド**を毎回先頭に入れる（`RECOVERY_TONE_GUIDE`）
- **ジャンル別ルール**（`genre-rules.ts`）を切り替え
- **RAG 結果**で「このシーンに関連する設定」を埋め込む

### 3-7. Stage 7: ai-gateway 経由で Claude API

```ts
import { createChatClient } from '@kaedevn/ai-gateway';

const client = createChatClient('anthropic', { apiKey });
const result = await client.chat({
  model: 'claude-opus-4-7',
  messages: [{ role: 'user', content: prompt }],
  maxTokens: 4000,
});
```

`ai-gateway` 経由（次の文書 21）で **OpenAI / Anthropic / Google を切り替え可能**。

### 3-8. Stage 8: ks-generator.ts — 自然文 → スクリプト

LLM が返す自然文:

```
（雨音が窓を叩いている。）
ヒロイン「……ねえ、聞こえる？」
```

これを `.ks` スクリプトに変換:

```ts
// 概念コード
function smartTagText(text: string, currentLineCount: number) {
  // 文末（。！？）で行送り（@r）
  // 一定行数で改ページ（@p）
  ...
}

function generateKs(scene: Stage3Result): string {
  return [
    '@bg rain_window',
    '@ch heroine smile center',
    `@text speaker:ヒロイン body:"……ねえ、聞こえる？"`,
    '@p',
  ].join('\n');
}
```

`@r` (改行) `@p` (改ページ) の自動挿入は **文字数 / 文章末** で判定。LLM の自然文を **エンジンが食える形式** に橋渡し。

---

## 4. なぜこの設計か（優位性）

### 4-1. 設定ファイル → 構造化 → chunk の三段で再現性

LLM の出力品質は **入力の品質** で決まる。フリーフォーマットの「設定」をそのまま投げると毎回違う結果が出る。

このパイプラインでは:
- **md + YAML** で構造を強制
- **WorkSetting 型** で TypeScript が検証
- **chunk** が意味単位

→ 「同じ設定 → 同じプロンプト」が保証される。

### 4-2. RAG で「関連する分だけ」渡す

全設定を毎回プロンプトに入れると:
- LLM のコンテキストを使い切る
- トークン課金が膨らむ

RAG で **シーンに関連する chunk だけ** 引けば:
- 1 リクエストあたり数千トークン
- コストが 5〜10 分の 1

### 4-3. ジャンル別ルール

`genre-rules/` 配下にジャンル別のプロンプト追加要件:

```
romance/    恋愛もの専用ルール
mystery/    ミステリー専用ルール
horror/     ホラー専用ルール
```

`resolveGenreRules(genre)` で動的に取得。**作品ごとに自動で適切なトーン**。

### 4-4. 自然文 → 構造化（.ks）の自動変換

LLM に **「.ks 形式で出力して」** と頼むと精度が落ちる（構文エラー多発）。代わりに:
- LLM は **自然文（小説）** だけ書く
- ks-generator が **コードで変換**

→ LLM の得意分野（文章）に集中させ、構造化は決定論的なコードで処理。**ハルシネーションを構文層から排除**。

### 4-5. ai-gateway 経由でモデル切り替え

```ts
const client = createChatClient('anthropic', { ... });
// → 'openai' / 'google' に変えるだけで切替
```

コスト最適化や障害時のフォールバックが容易。

---

## 5. 自分のプロジェクトへの移植手順

### Step 1: 設定の構造を決める

```
docs/projects/{id}/settings/
  overview.md
  characters.md
  plot.md
```

**フリーフォーマット禁止**、YAML frontmatter + Markdown に揃える。

### Step 2: parser を書く

```ts
function parseFrontmatter(content: string): { meta: any; body: string };
function parseCharacters(content: string): Character[];
function parseAll(projectId: string): WorkSetting;
```

各設定ファイルを **構造化 TypeScript 型** にパース。

### Step 3: chunker を書く

```ts
function chunkSettings(setting: WorkSetting): Chunk[] {
  // section 別に意味単位で分割
}
```

chunk 単位は **「LLM が 1 つの目的で読みたい単位」** を意識。

### Step 4: ベクトル DB セットアップ

PostgreSQL + pgvector（前書 05）で:

```sql
CREATE TABLE work_chunks (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  section TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  embedding VECTOR(1536),
  ...
);
```

差分更新は `content_hash` で。

### Step 5: hybrid-rag

ベクトル検索 + 全文検索のハイブリッド（前書 05 の手法をそのまま流用）。

### Step 6: プロンプトテンプレ

```ts
const TONE_GUIDE = `...`;
const RULES = `...`;

function buildPrompt(setting, request, ragResults) {
  return [TONE_GUIDE, formatCharacters(setting), formatRagResults(ragResults), RULES].join('\n\n');
}
```

**トーン → 登場物 → RAG → 要件** の順に並べる。

### Step 7: ai-gateway 抽象を入れる

OpenAI / Anthropic / Google を 1 つの `createChatClient(provider, opts)` で切り替え（次の文書 21 で詳述）。

### Step 8: 自然文 → 構造化変換

LLM の出力（自然文）を **コードで** 構造化形式に変換:
- 行送りタグ
- メタデータ（誰のセリフか）
- メディア参照（背景・キャラ ID）

### Step 9: API 化

```ts
app.post('/api/assist/scene', async (c) => {
  const { projectId, sceneSpec } = await c.req.json();
  const setting = await loadSettings(projectId);
  const ragResults = await ragService.search(sceneSpec.query);
  const prompt = buildPrompt(setting, sceneSpec, ragResults);
  const text = await chatClient.chat({ messages: [{ role: 'user', content: prompt }] });
  const ks = generateKs(text);
  return c.json({ ks, raw: text });
});
```

---

## 6. アンチパターン

### NG-1. LLM に構造化形式（JSON / .ks）を直書きさせる

→ 構文エラー多発。**自然文 → コードで変換**。

### NG-2. 全設定を毎回プロンプトに入れる

→ コンテキスト食いつぶし、コスト膨張。**RAG で絞る**。

### NG-3. プロバイダ抽象なし

→ OpenAI 専用に書くと切り替え不可。**ai-gateway 等の抽象** を最初から。

### NG-4. 差分更新なし

→ 設定変更のたびに全 chunk 再 embedding → 課金多大。**content_hash で差分化**。

### NG-5. プロンプトを散在させる

→ どこを直すと何が変わるか分からない。**prompts.ts に集約**。

---

## まとめ

- **8 ステージ**: md → 構造化 → chunk → embedding → DB → RAG → プロンプト合成 → LLM → 構造化変換
- **設定ファイル**は YAML frontmatter + Markdown で構造強制
- **RAG で関連 chunk だけ渡す**、コスト 5〜10 分の 1
- **LLM は自然文だけ**、構造化はコードで（ハルシネーション抑制）
- **ai-gateway 経由**でプロバイダ切り替え可能

「LLM をプロダクトに組み込む」全体像。各ステージは独立して差し替え可能で、**スケール時にチューニングしやすい構造**。
