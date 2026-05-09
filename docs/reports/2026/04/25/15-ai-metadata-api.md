# AI Metadata API — ハルシネーションを構造的に防ぐ API 設計

シリーズ: 11-documentation-plan / 関連: 03-typescript-with-genai / 12-mcp-server-implementation

## この文書の狙い

LLM に「実在する ID」を使わせるのは難しい。ナイーブな API だと、LLM は `"asset-12345"` のような **存在しない ID** を平気で書く。本リポジトリは **静的スキーマ + 動的コンテキスト** の二段で、ハルシネーションを **構造的に防いでいる**。本書はその設計を解説する。

---

## 1. ハルシネーションとは（一般論）

### 1-1. なぜ起きるか

LLM は確率的にトークンを生成する。「この場面で `assetId` は文字列だな」と判断したら、**もっともらしい文字列** を生成する。実在しない ID でも、構文的に正しければ通してしまう。

### 1-2. ナイーブな API の限界

```
LLM:「背景を森にしたい」
   ↓
LLM が生成: { type: "bg", assetId: "asset-forest-12345" }
   ↓
DB: そんな ID は存在しない → 500 エラー
```

LLM は **「DB に何が入っているか」を知らない**。だから推測で書く。

### 1-3. 解決の方向性

LLM に **「使える ID 一覧」を実行時に渡す** こと。これを「動的コンテキスト」と呼ぶ。

加えて **「フィールド構造」を静的スキーマで渡す** ことで、LLM が「どこに何を入れるか」を確定できる。この二段が AI Metadata API の核。

---

## 2. このリポジトリの実装

### 2-1. 二段構え

```
┌─────────────────────────────────────────┐
│ GET /api/editor-schema                  │  ← 静的スキーマ（24h キャッシュ、認証不要）
│   → 14 ブロック型の構造・制約・enum     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ GET /api/projects/:id                   │  ← 動的コンテキスト
│   → project.data + project._ai_context  │
│        ├─ availableAssets               │
│        ├─ availableCharacters           │
│        ├─ availablePages                │
│        └─ knownVariables                │
└─────────────────────────────────────────┘
```

LLM は両方読んで、**実在する ID を入れた構造的に正しいデータ** を生成する。

### 2-2. 静的スキーマ — `apps/hono/src/lib/editor-schema.ts`

`EDITOR_SCHEMA` オブジェクトを `GET /api/editor-schema` で返す:

```ts
export const EDITOR_SCHEMA = {
  version: 1,
  idPattern: '{type}-{Date.now()}',
  rules: {
    startBlock: '各ページの先頭ブロック。削除・移動不可。',
    idUniqueness: 'ブロック ID はプロジェクト内で一意でなければならない。',
    referentialIntegrity:
      'assetId / characterId / expressionId / toPageId は実在する ID を参照すること。',
  },
  blockTypes: {
    bg: {
      description: '背景画像を表示する。assetId は category=bg のアセットを参照。',
      properties: {
        id: { type: 'string', readOnly: true },
        type: { type: '"bg"', readOnly: true },
        assetId: { type: 'string', ref: 'assets (category=bg)' },
      },
    },
    ch: {
      description: 'キャラクターを表示・非表示する。',
      properties: {
        characterId: { type: 'string', ref: 'characters' },
        expressionId: { type: 'string', ref: 'characters[].expressions[]' },
        pos: { type: 'string', enum: ['L', 'C', 'R'] },
      },
    },
    // ... 全 14 ブロック型 ...
  },
};
```

#### 重要なフィールド

| フィールド | 役割 |
|---|---|
| `description` | LLM への自然言語説明 |
| `type: '"bg"'` | リテラル型（タイポ防止） |
| `readOnly: true` | LLM に「変更不可」と伝達 |
| `ref: 'assets (category=bg)'` | **どこから ID を取るか** を明示 |
| `enum: ['L', 'C', 'R']` | 取りうる値 |

### 2-3. ルートハンドラ — `apps/hono/src/routes/editor-schema.ts`

```ts
import { Hono } from 'hono';
import { EDITOR_SCHEMA } from '../lib/editor-schema.js';

const editorSchema = new Hono();

editorSchema.get('/', (c) => {
  c.header('Cache-Control', 'public, max-age=86400');
  return c.json(EDITOR_SCHEMA);
});

export default editorSchema;
```

- **認証不要** — Claude Code が直接 fetch できる
- **24h キャッシュ** — リリースごとに変わるが頻繁ではない
- 単純な GET ハンドラ、わずか 10 行

### 2-4. 動的コンテキスト — `apps/hono/src/routes/projects.ts`

`GET /api/projects/:id` のレスポンスに `_ai_context` を埋め込む:

```ts
// projects.ts:403-430
const aiContext = {
  schemaEndpoint: '/api/editor-schema',
  availableAssets: {
    backgrounds: assets
      .filter((a: any) => a.category === 'bg')
      .map((a: any) => ({ id: a.id, name: a.name, slug: a.slug })),
    overlays: assets
      .filter((a: any) => a.category === 'ovl')
      .map((a: any) => ({ id: a.id, name: a.name })),
  },
  availableCharacters: characters.map((ch: any) => ({
    id: ch.id,
    slug: ch.slug,
    name: ch.name,
    expressions: (ch.expressions ?? []).map((e: any) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
    })),
  })),
  availablePages: pages.map((p: any) => ({ id: p.id, name: p.name })),
  knownVariables: extractVariables(pages),
};

return c.json({
  project: {
    id: project.id,
    title: project.title,
    data: projectData,
    _ai_context: aiContext,
    // ...
  },
});
```

#### 設計のポイント

1. **`_ai_context` という命名** — `_` プレフィックスで「内部用」「読み取り専用」を示唆
2. **既存のクエリ結果を再利用** — `pages`, `assets`, `characters` は既に取得済み、追加 DB クエリなし
3. **`schemaEndpoint` でセルフリンク** — LLM が「もっと詳しい型を見たい」時にすぐ取りに行ける
4. **`knownVariables`** — `extractVariables(pages)` でシナリオ内の変数宣言を集計

### 2-5. 書き戻し時に `_ai_context` を剥がす — projects.ts:493

```ts
if (data?._ai_context) delete data._ai_context;
```

PUT 時には **AI が誤って `_ai_context` を含めて送ってきても無視**。読み取り専用フィールドの徹底。

---

## 3. 使い方（LLM 側）

### 3-1. 全体フロー

```
ユーザー:「森の背景に主人公を出して」
   ↓
LLM: GET /api/editor-schema   → ブロック型構造を取得
LLM: GET /api/projects/:id    → 実在 ID を取得
   ↓
LLM 生成（schema 通り、context にある ID で）:
  {
    type: "bg",
    assetId: "asset-bg-forest-real-id",     // ← _ai_context.availableAssets.backgrounds から
  },
  {
    type: "ch",
    characterId: "char-hero-real-id",        // ← _ai_context.availableCharacters から
    expressionId: "expr-hero-smile-real-id", // ← .expressions から
    pos: "C",
  }
   ↓
PUT /api/projects/:id    → 通る（実在 ID なので）
```

### 3-2. プロンプト例

```
ユーザー: プロジェクト abc123 に「森の背景 + 主人公が驚く」シーンを追加して

[AI が裏で実行]
1. GET /api/editor-schema
2. GET /api/projects/abc123
3. _ai_context.availableAssets.backgrounds から「森」っぽい slug を選ぶ
4. _ai_context.availableCharacters から hero を見つけ、expressions の "surprised" を選ぶ
5. schema の bg / ch 型に従って構造化
6. PUT /api/projects/abc123
```

LLM は **「ID を推測する余地がない」** ため、ハルシネーションが構造的に発生しない。

---

## 4. なぜそうするか（優位性）

### 4-1. 静的型と動的データの **分離**

| 種類 | 何 | 寿命 |
|---|---|---|
| 静的スキーマ (`/api/editor-schema`) | ブロック型構造 | リリース単位（24h キャッシュ） |
| 動的コンテキスト (`_ai_context`) | 実在 ID | プロジェクト単位（リアルタイム） |

役割を分けると:
- スキーマが安定（変更時に CI で検出）
- コンテキストが軽い（既存 query の再利用、追加 DB なし）
- LLM が **両方読むべき** と認識（`schemaEndpoint` でセルフリンク）

### 4-2. 「読み取り専用」を物理的に守る

```ts
// PUT 時に削除
if (data?._ai_context) delete data._ai_context;
```

AI が `_ai_context` を編集して送ってきても、**サーバーで無視**。**LLM が誤書きしても DB に影響しない**。

### 4-3. 既存 DB クエリを再利用

```ts
const pages = projectData.pages ?? [];
const assets = projectData.assets ?? [];
const characters = projectData.characters ?? [];
```

`projectData` を取る時点で全部取れている。**追加 DB query 0 回** で AI コンテキストが作れる。N+1 問題が起きない。

### 4-4. 「LLM に何を期待するか」を `description` で書ける

```ts
{
  description: '背景画像を表示する。assetId は category=bg のアセットを参照。',
  // ...
}
```

LLM は **自然言語の説明を読んで判断**。型だけだと「`assetId` がどこのアセットか」分からないが、`description` で意図が伝わる。

### 4-5. キャッシュ戦略

```ts
c.header('Cache-Control', 'public, max-age=86400');
```

スキーマは **24h キャッシュ**。LLM が毎リクエスト fetch しても、CDN/ブラウザでヒットする。コスト最適化。

### 4-6. 認証不要の境界線

`/api/editor-schema` は **認証不要**:
- スキーマは公開情報（DB 構造ではなく型定義）
- Claude Code が認証ヘッダなしで叩ける
- セキュリティリスクなし

`_ai_context` は **認証必要**（プロジェクト単位の実データ）。境界線が明確。

---

## 5. 自分のプロジェクトへの移植手順

### Step 1: スキーマ定義を 1 ファイルに集約

```ts
// lib/editor-schema.ts
export const EDITOR_SCHEMA = {
  version: 1,
  blockTypes: {
    yourBlock: {
      description: '...',
      properties: {
        id: { type: 'string', readOnly: true },
        someField: { type: 'string', ref: '...' },
      },
    },
  },
};
```

「**型定義の単一情報源**」として置く。

### Step 2: 静的エンドポイント

```ts
app.get('/api/schema', (c) => {
  c.header('Cache-Control', 'public, max-age=86400');
  return c.json(EDITOR_SCHEMA);
});
```

3 行で済む。

### Step 3: リソース取得 API に `_ai_context` を埋める

```ts
app.get('/api/things/:id', async (c) => {
  const thing = await db.thing.findUnique({ where: { id }, include: { ... } });

  const aiContext = {
    schemaEndpoint: '/api/schema',
    availableX: thing.related.map(r => ({ id: r.id, name: r.name })),
    availableY: extractY(thing),
  };

  return c.json({ thing: { ...thing, _ai_context: aiContext } });
});
```

**追加クエリ無し** で構築できるよう、`include` で関連を一気に取る。

### Step 4: 書き戻しで剥がす

```ts
app.put('/api/things/:id', async (c) => {
  const data = await c.req.json();
  if (data?._ai_context) delete data._ai_context;
  // ... 通常の更新
});
```

### Step 5: LLM への指示文に `_ai_context` を引用するよう促す

CLAUDE.md / プロンプト:

```markdown
## AI Metadata
- API の `_ai_context` を読み取って、その中の実在 ID のみを使う
- 推測で ID を生成しない
- スキーマは `GET /api/schema` で取得（24h キャッシュ）
```

これで LLM が AI Metadata を **能動的に使うようになる**。

---

## 6. アンチパターン

### NG-1. `_ai_context` を別エンドポイントにする

```
GET /api/things/:id           → データ
GET /api/things/:id/ai-context → コンテキスト
```

→ LLM が両方叩く必要があり、**コンテキストが不一致** になり得る（race condition）。**1 レスポンスに同梱** が正解。

### NG-2. 静的スキーマを動的に生成

リクエストごとに型情報を組み立てると、CDN キャッシュが効かない。**静的オブジェクト + 24h キャッシュ** にする。

### NG-3. ID をベタ書きで返す

```ts
availableAssets: assets  // 全フィールドを返す（password, internal flags も含む）
```

→ 機密漏洩。**`{ id, name, slug }` のような最小フィールド** に絞る。

### NG-4. `description` を書かない

```ts
{ properties: { assetId: { type: 'string' } } }
```

→ LLM がどこの ID か分からず推測。`ref: 'assets (category=bg)'` と `description` を必ず添える。

---

## まとめ

- **AI Metadata = 静的スキーマ + 動的コンテキスト** の二段
- 静的: `/api/editor-schema` で型構造、24h キャッシュ、認証不要
- 動的: `_ai_context` をリソースレスポンスに同梱、追加クエリ 0 回
- **書き戻しで `_ai_context` を剥がす** ことで読み取り専用を物理保証
- **`description` + `ref` + `enum`** で LLM に意図を伝える

ナイーブな API に AI を当てるとハルシネーションが頻発する。AI Metadata 二段で **「LLM が ID を推測する余地」を消す**。これが AI 連携 API 設計の核心。
