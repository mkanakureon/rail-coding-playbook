---
title: "実践ログ — セキュリティ強化を 1 セッションで実施"
emoji: "🔒"
type: "idea"
topics: ["claudecode", "セキュリティ", "typescript"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のバックエンド API（Hono + TypeScript）に対して、セキュリティ強化を 1 セッションで実施しました。実装したのは以下の 4 項目です。

1. **レートリミット** — IP ベースのリクエスト制限
2. **JWT 認証ミドルウェア** — Bearer トークン検証
3. **所有者検証** — プロジェクト/アセットのアクセス制御
4. **Cookie 同意** — GDPR 対応の基盤

この記事では、各項目の実装内容とコードを示しながら、Claude Code と協働してセキュリティ強化を進めた過程を記録します。

## 1. レートリミット

### 設計方針

外部ライブラリ（express-rate-limit 等）を使わず、インメモリの Map で実装しました。理由は以下です。

- Hono は Express ではないため、Express 用ミドルウェアがそのまま使えない
- 単一プロセスで動かす前提のため、Redis 等の外部ストアは不要
- シンプルなスライディングウィンドウで十分

### 実装

```typescript
// apps/hono/src/middleware/rate-limit.ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// 期限切れエントリを5分ごとにクリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

`stores` は Map の Map です。用途別に名前空間を分けるため、外側の Map のキーにリミッター名（`'login'`, `'api'` 等）を使っています。

### IP アドレスの取得

```typescript
function getClientIP(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}
```

Azure Container Apps ではリバースプロキシを経由するため、`X-Forwarded-For` ヘッダーからクライアント IP を取得します。カンマ区切りの最初の値が実際のクライアント IP です。

### リミッター本体

```typescript
export function rateLimit(opts: { limit: number; windowMs: number; name: string }) {
  const { limit, windowMs, name } = opts;
  if (!stores.has(name)) stores.set(name, new Map());
  const store = stores.get(name)!;

  return async (c: Context, next: Next) => {
    const ip = getClientIP(c);
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      c.res.headers.set('X-RateLimit-Limit', String(limit));
      c.res.headers.set('X-RateLimit-Remaining', String(limit - 1));
      await next();
      return;
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return c.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    c.res.headers.set('X-RateLimit-Limit', String(limit));
    c.res.headers.set('X-RateLimit-Remaining', String(limit - entry.count));
    await next();
  };
}
```

レスポンスヘッダーに `X-RateLimit-Limit` と `X-RateLimit-Remaining` を含めることで、クライアント側で残りリクエスト数を把握できます。制限超過時は `429 Too Many Requests` と `Retry-After` ヘッダーを返します。

### 事前設定済みリミッター

用途別にリミッターを事前設定しています。

```typescript
export const loginLimiter = rateLimit({
  name: 'login',
  limit: 5,
  windowMs: 60 * 1000,         // 1分間に5回まで
});

export const registerLimiter = rateLimit({
  name: 'register',
  limit: 3,
  windowMs: 60 * 60 * 1000,    // 1時間に3回まで
});

export const forgotPasswordLimiter = rateLimit({
  name: 'forgot-password',
  limit: 3,
  windowMs: 60 * 60 * 1000,    // 1時間に3回まで
});

export const apiLimiter = rateLimit({
  name: 'api',
  limit: 200,
  windowMs: 60 * 1000,          // 1分間に200回まで
});
```

認証系エンドポイントは厳しく、一般 API は緩く設定しています。ブルートフォース攻撃への基本的な防御です。

## 2. JWT 認証ミドルウェア

### 実装

```typescript
// apps/hono/src/middleware/auth.ts
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: '認証が必要です' }, 401);
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return c.json({ error: '無効なトークンです' }, 401);
  }

  // データベースからユーザーを取得
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, username: true, email: true, role: true, status: true },
  });

  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404);
  }

  if (user.status === 'suspended') {
    return c.json({ error: 'アカウントが停止されています' }, 403);
  }

  // コンテキストにユーザー情報を設定
  c.set('userId', user.id);
  c.set('user', user);

  await next();
}
```

### 設計のポイント

1. **Bearer トークンのみ**: Cookie からのトークン取得は行わず、`Authorization: Bearer <token>` ヘッダーのみを受け付けます。CSRF 攻撃のリスクを軽減するためです。

2. **DB 参照あり**: JWT の署名検証だけでなく、必ず DB からユーザーを引きます。これにより、トークン発行後にアカウントが停止された場合も即座にブロックできます。

3. **status チェック**: `suspended` ステータスのユーザーは 403 で拒否します。管理者がユーザーを停止した場合、次のリクエストからすぐに効果が出ます。

## 3. 所有者検証

### プロジェクトのアクセス制御

アセット操作の各エンドポイントで、プロジェクトの所有者を検証しています。

```typescript
// apps/hono/src/routes/assets.ts — アップロード例
assets.post('/:projectId/upload', async (c) => {
  const projectId = c.req.param('projectId');

  // プロジェクトの所有者検証
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project || project.userId !== c.get('userId')) {
    return c.json({ error: 'このプロジェクトへのアクセス権限がありません' }, 403);
  }

  // ... アップロード処理
});
```

このパターンは全てのアセット操作（アップロード・取得・更新・削除）で共通です。

### なぜ毎回 DB を引くのか

「認証ミドルウェアで userId を取得済みなのに、なぜエンドポイントごとにプロジェクトの所有者を確認するのか」と思うかもしれません。理由は明確です。

```
認証: 「このリクエストを送ったのは誰か」
認可: 「この人はこのリソースにアクセスできるか」
```

認証ミドルウェアは前者を担い、所有者検証は後者を担います。認可をミドルウェアに集約すると、URL パラメータからリソース ID を取得する汎用処理が複雑になります。エンドポイントごとに検証するのがシンプルです。

### アセット削除時の共有パス検証

アセット削除時は、同じ blobPath を共有する他のレコードがないか確認してからファイルを削除します。

```typescript
// 削除前に共有チェック
const officialRef = await prisma.officialAsset.findFirst({
  where: { blobPath: asset.blobPath },
  select: { id: true },
});
const userAssetRef = await prisma.userAsset.findFirst({
  where: { blobPath: asset.blobPath },
  select: { id: true },
});
const otherAssetRef = await prisma.asset.findFirst({
  where: { blobPath: asset.blobPath, id: { not: assetId } },
  select: { id: true },
});

if (!officialRef && !userAssetRef && !otherAssetRef) {
  // ファイルを物理削除
  await deleteBlob(BLOB_CONTAINER, asset.blobPath);
} else {
  console.log(`[Asset Delete] Skipped file deletion (shared blobPath): ${asset.blobPath}`);
}
```

公式アセットをプロジェクトにインポートした場合、blobPath は共有されます。DB レコードを削除しても、同じファイルを参照する他のレコードがある限り、物理ファイルは残す必要があります。

## 4. エラーハンドリングの統一

セキュリティ強化の一環として、未処理エラーのハンドリングも統一しました。

```typescript
// apps/hono/src/middleware/error.ts
export const errorHandler: ErrorHandler = (err, c) => {
  const entry = {
    level: 'error',
    time: new Date().toISOString(),
    type: 'unhandled_error',
    method: c.req.method,
    path: c.req.path,
    message: err.message,
    stack: err.stack,
  };

  console.error(JSON.stringify(entry));

  return c.json(
    {
      error: {
        message: err.message || 'Internal Server Error',
        status: 500,
      },
    },
    500
  );
};
```

構造化 JSON でログを出力することで、Azure のログ分析（KQL）で `level:"error"` のフィルタが容易になります。

### 注意: スタックトレースの露出

上のコードではエラーメッセージをクライアントに返していますが、本番環境ではスタックトレースやデータベースのエラー詳細がクライアントに漏れないよう注意が必要です。現状は開発フェーズのため許容していますが、本番では汎用的なメッセージに差し替えるべきです。

## ミドルウェアの適用順序

```
リクエスト
  → errorHandler（未処理エラーキャッチ）
  → apiLimiter（レート制限）
  → authMiddleware（JWT 検証）
  → 所有者検証（各エンドポイント内）
  → ビジネスロジック
```

この順序は重要です。レートリミットは認証前に適用します。認証済みリクエストだけをカウントすると、大量の無効なトークンでリクエストを送りつける攻撃を防げません。

## ファイルサイズ制限

アセットアップロードにはファイルサイズの制限も設けています。

```typescript
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;   // 20MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024;     // 50MB
const MAX_ZIP_EXTRACTED = 200 * 1024 * 1024; // 200MB（zip bomb 防止）
```

ZIP ファイルの展開サイズ制限は zip bomb（圧縮爆弾）への対策です。フレームセットのアップロード時に、展開前にサイズを検査しています。

```typescript
let totalExtractedSize = 0;
for (const entry of zip.getEntries()) {
  totalExtractedSize += entry.header.size;
  if (totalExtractedSize > MAX_ZIP_EXTRACTED) {
    return c.json({
      error: `展開後のサイズが上限(${MAX_ZIP_EXTRACTED / 1024 / 1024}MB)を超えています`
    }, 400);
  }
}
```

## まとめ

1 セッションで 4 つのセキュリティ対策を実装しました。

| 対策 | 防御対象 |
|---|---|
| レートリミット | ブルートフォース、DoS |
| JWT 認証 | 不正アクセス |
| 所有者検証 | 権限外リソースへのアクセス |
| エラーハンドリング | 情報漏洩 |

セキュリティ対策は「後回し」にしがちですが、認証・認可・レートリミットは API の基本機能です。最初から組み込むことで、後から「穴を塞ぐ」作業を減らせます。

Claude Code との協働では、「セキュリティ強化」という大きなテーマをミドルウェア単位に分解して指示することで、一貫性のある実装が進みました。ミドルウェアパターンは責務が明確なため、AI にとっても実装しやすいようです。

---

レートリミット、JWT 検証、所有者検証、エラーハンドリング。いずれも「あって当然」の機能ですが、0 から 1 つずつ積み上げる過程をログとして残すことに意味があると考えています。セキュリティは「完成」がないテーマなので、今後も定期的に見直していく予定です。

　　　　　　　　　　Claude Opus 4.6
