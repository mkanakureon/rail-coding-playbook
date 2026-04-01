# URL トークン渡し廃止 — Auth Code Exchange 方式への移行計画

**作成日**: 2026-02-18
**ステータス**: 計画

---

## 1. 現状の問題

### 現在のフロー

```
1. ユーザーがエディタにアクセス（未ログイン）
2. Editor → Next.js /login?from=http://localhost:5176/projects/editor/xxx にリダイレクト
3. ログイン成功
4. Next.js → http://localhost:5176/projects/editor/xxx?token=JWT_HERE&userId=YYY にリダイレクト
5. Editor が URL から token を取得 → localStorage に保存 → URL をクリーン
```

### リスク

| リスク | 深刻度 | 説明 |
|--------|--------|------|
| ブラウザ履歴に JWT が残る | **高** | `history.replaceState` 前に履歴エントリが作られる |
| Referer ヘッダーで漏洩 | **高** | リダイレクト直後に外部リソースを読み込むと Referer に JWT が載る |
| サーバーログに記録 | **中** | Nginx/CDN のアクセスログに URL パラメータとして JWT が記録される |
| ショルダーサーフィン | **低** | アドレスバーに一瞬表示される |

### 該当コード

| ファイル | 行 | 内容 |
|----------|-----|------|
| `apps/next/app/(public)/login/page.tsx` | 38-45 | `url.searchParams.set('token', token)` で JWT を URL に付与 |
| `apps/editor/src/pages/EditorPage.tsx` | 36-48 | `urlParams.get('token')` で URL から JWT を取得 |

---

## 2. 解決策: Auth Code Exchange

OAuth 2.0 の Authorization Code Flow と同じ原理。URL には **使い捨ての短命コード** だけを渡し、Editor がそのコードを API に送って JWT と交換する。

### 新しいフロー

```
1. ユーザーがエディタにアクセス（未ログイン）
2. Editor → Next.js /login?from=http://...editor... にリダイレクト
3. ログイン成功
4. Next.js → POST /api/auth/code（JWT を使って認可コードを発行）
5. Next.js → http://...editor...?code=ONETIME_CODE にリダイレクト（JWT は渡さない）
6. Editor → POST /api/auth/exchange { code: ONETIME_CODE }
7. API がコードを検証 → JWT を返す
8. Editor が JWT を localStorage に保存
```

### コードの特性

| 項目 | 値 |
|------|-----|
| 有効期限 | **30秒** |
| 使用回数 | **1回限り**（使用後即削除） |
| 長さ | 64文字ランダム文字列 |
| 保存場所 | サーバーメモリ（Map） |

### メリット

- URL に漏洩しても **30秒で無効** + **1回使ったら消える**
- JWT は一切 URL に載らない
- 既存の JWT 認証基盤はそのまま使える
- 実装変更が最小限（3ファイル）

---

## 3. 実装計画

### 3-1. Hono API: 認可コード発行・交換エンドポイント追加

**ファイル**: `apps/hono/src/routes/auth.ts`

```typescript
// インメモリ認可コードストア
const authCodes = new Map<string, { userId: string; expiresAt: number }>();

// POST /api/auth/code — 認可コード発行（要認証）
auth.post('/code', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const code = crypto.randomUUID() + crypto.randomUUID(); // 64文字
  authCodes.set(code, {
    userId,
    expiresAt: Date.now() + 30_000, // 30秒
  });
  return c.json({ code });
});

// POST /api/auth/exchange — 認可コード → JWT 交換（認証不要）
auth.post('/exchange', async (c) => {
  const { code } = await c.req.json();
  const entry = authCodes.get(code);

  if (!entry || entry.expiresAt < Date.now()) {
    authCodes.delete(code); // 期限切れコードも削除
    return c.json({ error: '無効または期限切れのコードです' }, 401);
  }

  authCodes.delete(code); // 1回限り

  const user = await prisma.user.findUnique({ where: { id: entry.userId } });
  if (!user || user.status === 'suspended') {
    return c.json({ error: 'ユーザーが無効です' }, 401);
  }

  const token = generateToken(user.id);
  return c.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});
```

**期限切れコードの自動クリーンアップ**（5分ごと）:

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (entry.expiresAt < now) authCodes.delete(code);
  }
}, 5 * 60 * 1000);
```

### 3-2. Next.js ログインページ修正

**ファイル**: `apps/next/app/(public)/login/page.tsx`

変更前:
```typescript
if (from.startsWith('http')) {
  const url = new URL(from);
  const token = getAuthToken();
  url.searchParams.set('token', token);
  url.searchParams.set('userId', result.user.id);
  window.location.href = url.toString();
}
```

変更後:
```typescript
if (from.startsWith('http')) {
  // JWT の代わりに使い捨て認可コードを発行
  const codeRes = await fetch(`${API_URL}/api/auth/code`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  const { code } = await codeRes.json();
  const url = new URL(from);
  url.searchParams.set('code', code);
  window.location.href = url.toString();
}
```

### 3-3. Editor 認証ハンドリング修正

**ファイル**: `apps/editor/src/pages/EditorPage.tsx`

変更前:
```typescript
const tokenFromUrl = urlParams.get('token');
const userIdFromUrl = urlParams.get('userId');
if (tokenFromUrl && userIdFromUrl) {
  setAuthToken(tokenFromUrl);
  localStorage.setItem('currentUserId', userIdFromUrl);
  setUserId(userIdFromUrl);
  window.history.replaceState({}, '', window.location.pathname);
  return;
}
```

変更後:
```typescript
const codeFromUrl = urlParams.get('code');
if (codeFromUrl) {
  // URL を即座にクリーン
  window.history.replaceState({}, '', window.location.pathname);
  // 認可コードを JWT に交換
  const res = await fetch(`${API_BASE_URL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codeFromUrl }),
  });
  if (res.ok) {
    const { token, user } = await res.json();
    setAuthToken(token);
    localStorage.setItem('currentUserId', user.id);
    setUserId(user.id);
  } else {
    // コード無効 → ログインページへ
    window.location.href = `${FRONTEND_URLS.login}?from=${encodeURIComponent(window.location.href)}`;
  }
  return;
}
```

---

## 4. 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/hono/src/routes/auth.ts` | `POST /code` + `POST /exchange` 追加、クリーンアップタイマー |
| `apps/next/app/(public)/login/page.tsx` | `?token=` → `?code=` に変更 |
| `apps/editor/src/pages/EditorPage.tsx` | URL から code を取得 → `/api/auth/exchange` で JWT 取得 |

---

## 5. セキュリティ比較

| 観点 | 変更前（JWT in URL） | 変更後（Auth Code） |
|------|---------------------|---------------------|
| URL 漏洩時の影響 | JWT 7日間有効 | コード30秒 + 1回限り |
| ブラウザ履歴 | JWT が残る | 無効なコードが残るだけ |
| Referer 漏洩 | JWT 窃取可能 | コード既に使用済みで無効 |
| サーバーログ | JWT 記録される | 無効なコードのみ |
| XSS | localStorage の JWT 窃取可能 | 同じ（Phase 2 で対応） |

---

## 6. テスト計画

### 正常系
1. Next.js でログイン → エディタにリダイレクト → エディタで自動ログイン完了
2. エディタリロード → localStorage の JWT でセッション維持

### 異常系
3. 期限切れコード（30秒経過）→ ログインページにリダイレクト
4. 同じコードを2回使用 → 2回目は 401
5. 不正なコード文字列 → 401

### 回帰テスト
6. Next.js 内部の画面遷移（`/mypage` → `/projects` 等）は影響なし
7. エディタから API へのリクエスト（アセットアップロード等）は従来通り動作

---

## 7. 将来の改善（Phase 2、別タスク）

| 項目 | 内容 |
|------|------|
| HttpOnly Cookie 移行 | localStorage → Cookie でXSS対策 |
| JWT 有効期限短縮 | 7日 → 1時間 + リフレッシュトークン |
| サーバー側ログアウト | トークンブロックリスト or セッションDB |
| Nginx 同一ドメイン統合 | CORS 不要化 |

これらは Auth Code Exchange とは独立して実施可能。
