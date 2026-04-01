# スケーラビリティ・マスタープラン — 10万同時接続への道

> **作成日**: 2026-03-20
> **統合元**: Gemini CLI 分析（16-SCALABILITY_REFACTOR_PLAN）+ Claude Opus 4.6 分析（16-ARCHITECTURE_LIMITS_AND_REFACTORING_PLAN）
> **想定規模**: 作品 10,000件 / 同時接続 100,000人 / コード 1,000,000行超

---

## 1. 致命的ボトルネック — 14 箇所の「死角」

### Tier 1: 100人で壊れる（即座に修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 1 | **DB 接続プール未設定** | `apps/hono/src/lib/db.ts` | Prisma デフォルト 10 接続。100 同時リクエストでキュー詰まり | ~100 users |
| 2 | **認証で毎回 DB lookup** | `apps/hono/src/middleware/auth.ts:59-87` | JWT 検証後に `prisma.user.findUnique()` が走る | ~5K users |
| 3 | **レート制限がインメモリ** | `apps/hono/src/middleware/rate-limit.ts:8` | `Map` ベース。複数インスタンスで分散不可 | 2台目のインスタンス |

### Tier 2: 1,000人で壊れる（Phase 3 前に修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 4 | **アセット配信がローカル FS** | `apps/hono/src/storage/LocalFileStorage.ts` | CDN なし。1M req/sec を 1 台で処理不可 | ~1K users |
| 5 | **playCount ソートにインデックスなし** | `schema.prisma` Work モデル | `ORDER BY playCount DESC` がフルスキャン | ~1K works |
| 6 | **Preview API が毎回スクリプト全生成** | `apps/hono/src/routes/preview.ts:17-209` | 5 DB クエリ + CPU bound 文字列生成。キャッシュなし | ~500 concurrent |
| 7 | **クライアント側コンパイルがメインスレッド** | `packages/compiler/src/compiler/Compiler.ts:24-50` | 10K 行で 200-300ms ブロック | 全ユーザー |
| 8 | **プロジェクトデータが巨大 JSON 一括送信** | `apps/hono/src/routes/projects.ts` | 長編作品で数 MB の JSON をシリアライズ→パース | ~100 ページ超 |

### Tier 3: 10,000人で壊れる（スケール前に修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 9 | **Next.js SSR が API を毎回 fetch** | `apps/next/app/(public)/play/[id]/page.tsx` | revalidate: 60、異なる work でキャッシュヒット率低下 | ~10K users |
| 10 | **N+1 クエリ（Work タグ解決）** | `apps/hono/src/routes/works.ts:129-204` | 3 tags × 100K = 400K queries/sec | ~100 concurrent |
| 11 | **画像最適化が同期** | `apps/hono/src/routes/assets.ts:141-147` | Sharp がリクエストハンドラでブロック | ~100 uploads |
| 12 | **テクスチャキャッシュ 128MB/セッション** | `packages/web/src/renderer/TextureCache.ts:9-10` | 50+ スプライトで GC 圧迫 | 50+ sprites |
| 13 | **ViewState の全量評価** | `packages/web/src/renderer/WebOpHandler.ts` | オブジェクト数増大で描画パフォーマンス低下 | 50+ オブジェクト |
| 14 | **オーディオキャッシュなし** | `packages/web/src/audio/AudioManager.ts` | 同じ BGM を毎回 fetch + decode | 全ユーザー |

---

## 2. 崩壊シミュレーション

1 ユーザーが `/play/:id` にアクセスしたときの全フロー:

```
ブラウザ → Next.js SSR
  │  fetchWork() → API HTTP リクエスト                [#9]
  ↓
API: authMiddleware → DB lookup                       [#2]
  ↓
API: prisma.work.findUnique() → DB 接続プール待ち     [#1]
  ↓
API: workTags N+1 クエリ                              [#10]
  ↓
Next.js: HTML 生成 → ブラウザ返却
  ↓
ブラウザ: PlayPageClient → iframe 作成
  ↓
iframe: fetch(/api/preview/:id)                       [#6]
  ↓
API: preview 5 DB クエリ + スクリプト全生成            [#6]
  ↓
iframe: compile() メインスレッドブロック                [#7]
  ↓
iframe: 背景・キャラ画像 fetch                        [#4]
  ↓
API: ローカル FS から画像配信                          [#4]
  ↓
ブラウザ: createImageBitmap(premultiply)               [#12]
  ↓
ブラウザ: 音声 fetch + decodeAudioData（キャッシュなし） [#14]
  ↓
ゲーム開始
```

**1 ユーザーあたり最低 8 DB クエリ。** 100K 同時 = 800K queries/sec。DB 接続プール 10 本では即死。

---

## 3. リファクタリング計画

### Phase A: 即座に実行（1-2日） — 100→5,000 人

| # | 施策 | 変更箇所 | 工数 |
|---|------|---------|------|
| A-1 | **DB 接続プール設定** | `apps/hono/src/lib/db.ts` | 0.5h |
| A-2 | **認証キャッシュ**（JWT claims に role/status 埋め込み） | `middleware/auth.ts` + トークン生成 | 2h |
| A-3 | **playCount インデックス追加** | `schema.prisma` + SQL | 0.5h |
| A-4 | **ページネーション上限強制** | `works.ts` | 0.5h |
| A-5 | **N+1 解消**（タグ一括取得） | `works.ts` | 1h |

```typescript
// A-1: DB 接続プール
export const prisma = new PrismaClient({
  datasources: {
    db: { url: `${process.env.DATABASE_URL}?connection_limit=50&pool_timeout=30` }
  },
});

// A-2: 認証キャッシュ
const decoded = verifyToken(token);
if (decoded.role && decoded.status === 'active') {
  c.set('userId', decoded.userId);
  c.set('userRole', decoded.role);
  return next(); // DB lookup スキップ
}

// A-3: インデックス
CREATE INDEX "works_status_play_count_idx" ON "works"("status", "play_count" DESC);
CREATE INDEX "works_status_created_at_idx" ON "works"("status", "created_at" DESC);

// A-4: ページネーション上限
const take = Math.min(parseInt(limit) || 20, 100);
```

---

### Phase B: 1週間以内（5,000→10,000 人）

| # | 施策 | 変更箇所 | 工数 |
|---|------|---------|------|
| B-1 | **Redis 導入**（レート制限 + セッション + Preview キャッシュ） | `rate-limit.ts`, `auth.ts`, `preview.ts` | 3d |
| B-2 | **アセット CDN 化** | `config.ts` + Azure CDN 設定 | 1d |
| B-3 | **Preview API キャッシュ**（ETag + 304） | `preview.ts` | 0.5d |
| B-4 | **プロジェクトデータのページ単位分割** | `projects.ts` + エンジン側ローダー | 2d |

```typescript
// B-3: Preview ETag
const etag = crypto.createHash('md5').update(script).digest('hex');
if (c.req.header('if-none-match') === etag) return c.body(null, 304);
c.header('ETag', etag);
c.header('Cache-Control', 'public, max-age=60');
```

**B-4: プロジェクト構造のデカップリング（Gemini 提案）**

現在 `Project.data` に全ページが1つの JSON Blob として保存されている。長編作品（100ページ超）で致命的。

```
Before: Project.data = { pages: [page1, page2, ... page100] }  ← 数MB一括

After:  ProjectMetadata = { id, title, pageCount }
        ProjectPage     = { id, projectId, pageIndex, data }   ← ページ単位で取得
```

エンジン側に「ページローダー」を導入し、`OpRunner` が次のジャンプ先を予測してバックグラウンドで先読み。

---

### Phase C: Phase 3 開始前（10,000→100,000 人）

| # | 施策 | 変更箇所 | 工数 |
|---|------|---------|------|
| C-1 | **コンパイラ Web Worker 化** | `packages/web/src/workers/compiler.worker.ts`（新規） | 2d |
| C-2 | **画像最適化バックグラウンドジョブ化** | `assets.ts` + BullMQ | 2d |
| C-3 | **テクスチャキャッシュ動的サイズ制御** | `TextureCache.ts` | 1d |
| C-4 | **オーディオキャッシュ** | `AudioManager.ts` | 0.5d |
| C-5 | **全文検索インデックス** | `schema.prisma` + PostgreSQL tsvector | 1d |
| C-6 | **ViewState Dirty Flag** | `WebOpHandler.ts` + `LayerManager.ts` | 2d |

```typescript
// C-1: Web Worker コンパイラ
// packages/web/src/workers/compiler.worker.ts（新規）
self.onmessage = (e) => {
  const { script, scenarioId } = e.data;
  const scenario = compile(script, { scenarioId, validate: false });
  self.postMessage(scenario);
};
```

**C-6: ViewState Dirty Flag（Gemini 提案）**

`sceneLayer` の各コンポーネントに `isDirty` フラグを持たせ、`ViewState` のプロパティが実際に変更された場合のみ PixiJS の setter を呼ぶ。高負荷なテクスチャバインド更新を最小限に抑える。

```typescript
// WebOpHandler 内
if (sprite._lastX !== newX) {
  sprite.x = newX;
  sprite._lastX = newX;
}
```

---

## 4. 優先度マトリクス

```
            影響大                        影響小
         ┌─────────────────────────┬─────────────────────────┐
修正容易  │ A-1 DB接続プール        │ A-4 ページネーション     │
         │ A-2 認証キャッシュ      │ C-4 オーディオキャッシュ  │
         │ A-3 インデックス追加     │ A-5 N+1 解消            │
         ├─────────────────────────┼─────────────────────────┤
修正困難  │ B-1 Redis 導入          │ C-5 全文検索            │
         │ B-2 CDN 化              │ C-3 テクスチャ動的制御   │
         │ B-4 データ分割           │ C-6 Dirty Flag          │
         │ C-1 Worker コンパイラ    │                         │
         │ C-2 画像最適化非同期     │                         │
         └─────────────────────────┴─────────────────────────┘
```

---

## 5. スケール到達ロードマップ

```
現在        Phase A       Phase B       Phase C        目標
~100人  →  ~5,000人  →  ~10,000人  →  ~100,000人
            (1-2日)       (1週間)       (2-3週間)

DB接続10    接続50       Redis導入     Worker化
認証毎回DB  JWT claims   CDN化        ジョブキュー
Index無     Index追加     Preview ETag  全文検索
制限無      take≤100     データ分割    Dirty Flag
```

---

## 6. 結論

**最初の一歩が崩れる場所は「DB 接続プール」。** 100人で詰まり、1,000人で停止する。

2つの分析を統合した結果、ボトルネックは3層に分かれる:

1. **サーバー層**（DB接続・認証・レート制限・キャッシュ）— Phase A+B で対処
2. **データ層**（巨大 JSON・N+1・インデックス欠如）— Phase A+B で対処
3. **クライアント層**（メインスレッドコンパイル・テクスチャ・ViewState 全量評価）— Phase C で対処

Phase A（5項目・1-2日）を適用するだけで、100人→5,000人に耐久性が跳ね上がる。これが最もコスパの高い投資。
