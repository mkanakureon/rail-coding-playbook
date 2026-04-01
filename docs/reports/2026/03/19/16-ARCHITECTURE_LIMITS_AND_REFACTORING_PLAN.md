# アーキテクチャ限界分析 & リファクタリング計画

> **作成日**: 2026-03-19
> **担当**: Claude Opus 4.6
> **対象**: kaedevn-monorepo 全体
> **想定規模**: 作品 10,000件 / 同時接続 100,000人 / コード 1,000,000行超

---

## 1. 「最初の一歩が崩れる場所」— 致命的ボトルネック 11 箇所

### Tier 1: 100人で壊れる（今すぐ修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 1 | **DB接続プール未設定** | `apps/hono/src/lib/db.ts` | Prisma デフォルト 10 接続。100 同時リクエストでキュー詰まり | ~100 users |
| 2 | **認証で毎回 DB lookup** | `apps/hono/src/middleware/auth.ts:59-87` | JWT 検証後に `prisma.user.findUnique()` が走る。100K users = 100K queries/sec | ~5K users |
| 3 | **レート制限がインメモリ** | `apps/hono/src/middleware/rate-limit.ts:8` | `Map<string, Map<string, RateLimitEntry>>`。複数インスタンスで分散不可 | 2台目のインスタンス |

### Tier 2: 1,000人で壊れる（Phase 3 前に修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 4 | **アセット配信がローカルFS** | `apps/hono/src/storage/LocalFileStorage.ts` | CDN なし。100K users × 10 assets = 1M req/sec を 1 台で処理不可 | ~1K users |
| 5 | **Works 一覧の playCount ソートにインデックスなし** | `schema.prisma` Work モデル | `ORDER BY playCount DESC` がフルテーブルスキャン | ~1K works |
| 6 | **Preview API が毎回スクリプト全生成** | `apps/hono/src/routes/preview.ts:17-209` | 5 DB クエリ + CPU bound な文字列生成。キャッシュなし | ~500 concurrent |
| 7 | **クライアント側コンパイルがメインスレッド** | `packages/compiler/src/compiler/Compiler.ts:24-50` | 10K行スクリプトで 200-300ms ブロック。ペイウォール解除時にも再コンパイル | 全ユーザー |

### Tier 3: 10,000人で壊れる（スケール前に修正）

| # | 箇所 | ファイル | 問題 | 崩壊閾値 |
|---|------|---------|------|---------|
| 8 | **Next.js SSR が API を毎回 fetch** | `apps/next/app/(public)/play/[id]/page.tsx` | revalidate: 60 だが、100K users × 異なる work = キャッシュヒット率低下 | ~10K users |
| 9 | **N+1 クエリ（Work タグ解決）** | `apps/hono/src/routes/works.ts:129-204` | タグ数 N 本 → N+1 クエリ。3 tags × 100K = 400K queries/sec | ~100 concurrent |
| 10 | **画像最適化が同期** | `apps/hono/src/routes/assets.ts:141-147` | Sharp が request handler でブロック。10MB 画像 = 2-3 秒停止 | ~100 uploads |
| 11 | **テクスチャキャッシュ 128MB/セッション** | `packages/web/src/renderer/TextureCache.ts:9-10` | 100K concurrent × 128MB = 理論上 12.8TB。ブラウザ GC 圧迫 | 50+ sprites |

---

## 2. リファクタリング計画

### Phase A: 即座に実行（1-2日）

#### A-1. DB 接続プール設定
```typescript
// apps/hono/src/lib/db.ts
export const prisma = new PrismaClient({
  datasources: {
    db: { url: `${process.env.DATABASE_URL}?connection_limit=50&pool_timeout=30` }
  },
});
```

#### A-2. 認証キャッシュ（JWT claims に必要情報を埋め込み）
```typescript
// middleware/auth.ts — DB lookup をスキップ
// JWT payload に role, status を含める → DB 不要
const decoded = verifyToken(token);
if (decoded.role && decoded.status === 'active') {
  c.set('userId', decoded.userId);
  c.set('userRole', decoded.role);
  return next(); // DB lookup スキップ
}
```

#### A-3. playCount インデックス追加
```sql
CREATE INDEX "works_status_play_count_idx" ON "works"("status", "play_count" DESC);
CREATE INDEX "works_status_created_at_idx" ON "works"("status", "created_at" DESC);
```

#### A-4. ページネーション上限強制
```typescript
// works.ts — limit のサニタイズ
const take = Math.min(parseInt(limit) || 20, 100);
```

---

### Phase B: 1週間以内に実行

#### B-1. Redis 導入（レート制限 + セッションキャッシュ）
- レート制限: `Map` → Redis INCR + EXPIRE
- ユーザーキャッシュ: JWT 検証後に Redis で user を 5 分キャッシュ
- Preview キャッシュ: 生成済みスクリプトを Redis に 60 秒キャッシュ

#### B-2. アセット配信を CDN 化
- Azure Blob Storage は既に `resolveAssetUrl()` で対応済み（`config.ts:45-71`）
- ローカル開発以外は `ASSET_BASE_URL` を Azure CDN エンドポイントに設定
- `Cache-Control: public, max-age=31536000, immutable` をアセットに付与

#### B-3. Preview API キャッシュ
```typescript
// preview.ts — ETag + 304 対応
const etag = crypto.createHash('md5').update(script).digest('hex');
if (c.req.header('if-none-match') === etag) {
  return c.body(null, 304);
}
c.header('ETag', etag);
c.header('Cache-Control', 'public, max-age=60');
```

#### B-4. N+1 解消（タグ一括取得）
```typescript
// works.ts — include ではなく select + join
const work = await prisma.work.findUnique({
  where: { id: workId },
  include: {
    workTags: { include: { tag: true } }, // 1 query with join
    project: { select: { user: { select: { id: true, username: true } }, data: true } },
  },
});
```

---

### Phase C: Phase 3 開始前に実行（2-3週間）

#### C-1. コンパイラを Web Worker 化
```typescript
// packages/web/src/workers/compiler.worker.ts（新規）
self.onmessage = (e) => {
  const { script, scenarioId } = e.data;
  const scenario = compile(script, { scenarioId, validate: false });
  self.postMessage(scenario);
};

// ksc-demo.ts — Worker 経由でコンパイル
const worker = new Worker(new URL('./workers/compiler.worker.ts', import.meta.url));
worker.postMessage({ script, scenarioId });
worker.onmessage = (e) => { runner.start(e.data, handler); };
```

#### C-2. 画像最適化をバックグラウンドジョブ化
- アップロード時: 元画像を即座に保存 → 200 OK 返却
- バックグラウンド: Sharp で最適化 → 元画像を置き換え
- BullMQ + Redis でジョブキュー

#### C-3. テクスチャキャッシュの動的サイズ制御
```typescript
// TextureCache.ts — デバイスメモリに応じて上限調整
const maxMemory = navigator.deviceMemory
  ? Math.min(navigator.deviceMemory * 16, 256) // デバイスメモリの 1/4、最大 256MB
  : 64; // 不明なら控えめ
```

#### C-4. オーディオキャッシュ追加
```typescript
// AudioManager.ts — デコード済みバッファをキャッシュ
private audioCache = new Map<string, AudioBuffer>();

async play(category, asset, loop) {
  let decoded = this.audioCache.get(asset);
  if (!decoded) {
    const buf = await (await fetch(asset)).arrayBuffer();
    decoded = await this.ctx.decodeAudioData(buf);
    this.audioCache.set(asset, decoded);
  }
  // ... 再生
}
```

#### C-5. 全文検索インデックス
```sql
ALTER TABLE works ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('japanese', title || ' ' || COALESCE(description, ''))) STORED;
CREATE INDEX works_search_idx ON works USING GIN(search_vector);
```

---

## 3. 崩壊シミュレーション

### シナリオ: 10,000 作品 / 100,000 同時接続

```
ユーザーが /play/:id にアクセス
  ↓
Next.js SSR: fetchWork() → API へ HTTP リクエスト [Tier 3: #8]
  ↓
API: authMiddleware → DB lookup [Tier 1: #2]
  ↓
API: prisma.work.findUnique() → DB 接続プール待ち [Tier 1: #1]
  ↓
API: workTags N+1 クエリ [Tier 3: #9]
  ↓
レスポンス返却 → Next.js が HTML 生成
  ↓
ブラウザ: PlayPageClient レンダリング → iframe 作成
  ↓
iframe: ksc-demo.ts → fetch(/api/preview/:id) [Tier 2: #6]
  ↓
API: preview 5 DB クエリ + スクリプト生成 [Tier 2: #6]
  ↓
iframe: compile() がメインスレッドブロック [Tier 2: #7]
  ↓
iframe: 背景・キャラ画像を fetch [Tier 2: #4]
  ↓
API: ローカルFS から画像配信 [Tier 2: #4]
  ↓
ブラウザ: createImageBitmap(premultiply) → テクスチャ作成 [Tier 3: #11]
  ↓
ブラウザ: 音声 fetch + decodeAudioData（キャッシュなし）
  ↓
ゲーム開始
```

**上記フローで API は 1 ユーザーあたり最低 8 DB クエリを発行。** 100K 同時 = 800K queries/sec。DB 接続プール 10 本ではキュー長が無限に伸びる。

---

## 4. 優先度マトリクス

```
            影響大                     影響小
         ┌──────────────────────┬──────────────────────┐
修正容易  │ A-1 DB接続プール     │ A-4 ページネーション  │
         │ A-2 認証キャッシュ   │ C-4 オーディオキャッシュ│
         │ A-3 インデックス追加  │                      │
         ├──────────────────────┼──────────────────────┤
修正困難  │ B-1 Redis 導入       │ C-5 全文検索         │
         │ B-2 CDN 化           │ C-3 テクスチャ動的制御│
         │ C-1 Worker コンパイラ │                      │
         │ C-2 画像最適化非同期  │                      │
         └──────────────────────┴──────────────────────┘
```

**今夜やるべき順序**: A-1 → A-2 → A-3 → A-4 → B-4（ここまでで最大の効果）

---

## 5. 結論

**最初の一歩が崩れる場所は「DB 接続プール」（10 接続 × 8 クエリ/ユーザー）。** 100 人で詰まり、1,000 人で停止する。次に「認証の毎回 DB lookup」と「playCount のフルスキャン」が連鎖的に崩壊を加速する。

Phase A の 4 項目（接続プール・認証キャッシュ・インデックス・ページネーション上限）を今夜中に適用すれば、1,000〜5,000 同時接続まで耐えられる。Phase B の Redis 導入で 10,000、Phase C の Worker 化 + CDN で 100,000 への道が開ける。
